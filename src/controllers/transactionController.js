const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput, generateInvoice } = require('../utils/helpers');
const { validateRequired, validateEnum, validatePositiveNumber } = require('../utils/validation');

exports.getAllTransactions = catchAsync(async (req, res, next) => {
  const { status, search, page = 1, limit = 10, sort = 'created_at', order = 'DESC' } = req.query;

  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'invoice', 'status', 'amount'];
  const allowedOrder = ['ASC', 'DESC'];

  if (!allowedSort.includes(sort)) {
    throw new ApiError(400, `Invalid sort field.  Allowed:  ${allowedSort.join(', ')}`);
  }

  if (!allowedOrder.includes(order. toUpperCase())) {
    throw new ApiError(400, `Invalid order. Allowed: ${allowedOrder.join(', ')}`);
  }

  const conn = await getConnection();

  try {
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (invoice LIKE ? OR buyer LIKE ?  OR contact LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    query += ` ORDER BY ${sort} ${order. toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const transactions = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(transactions),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Transactions retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getUserTransactions = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = `
      SELECT DISTINCT t.* FROM transactions t
      INNER JOIN order_items oi ON t.id = oi.transaction_id
      WHERE oi.user_id = ? 
    `;
    const params = [userId];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const transactions = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(transactions),
      {
        page:  parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Transactions retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getTransactionById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  if (! id || isNaN(id)) {
    throw new ApiError(400, 'Invalid transaction ID');
  }

  const conn = await getConnection();

  try {
    const transactions = await conn.query('SELECT * FROM transactions WHERE id = ? ', [id]);

    if (transactions.length === 0) {
      throw new ApiError(404, 'Transaction not found');
    }

    if (userRole !== 'admin') {
      const orderItems = await conn.query(
        'SELECT id FROM order_items WHERE transaction_id = ?  AND user_id = ?',
        [id, userId]
      );

      if (orderItems. length === 0) {
        throw new ApiError(403, 'Access denied to this transaction');
      }
    }

    const items = await conn.query(
      `SELECT oi.*, pv.name as variant_name, pv. sku, p.name as product_name
       FROM order_items oi
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p. id
       WHERE oi.transaction_id = ?`,
      [id]
    );

    const transaction = convertBigInt(transactions[0]);
    transaction.items = convertBigInt(items);

    return ApiResponse.success(res, transaction, 'Transaction retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.getTransactionByInvoice = catchAsync(async (req, res, next) => {
  const { invoice } = req.params;

  if (!invoice) {
    throw new ApiError(400, 'Invoice is required');
  }

  const conn = await getConnection();

  try {
    const transactions = await conn.query('SELECT * FROM transactions WHERE invoice = ? ', [invoice]);

    if (transactions.length === 0) {
      throw new ApiError(404, 'Transaction not found');
    }

    const items = await conn. query(
      `SELECT oi.*, pv.name as variant_name, pv.sku, p.name as product_name
       FROM order_items oi
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       WHERE oi.transaction_id = ?`,
      [transactions[0].id]
    );

    const transaction = convertBigInt(transactions[0]);
    transaction.items = convertBigInt(items);

    return ApiResponse.success(res, transaction, 'Transaction retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.createTransaction = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { buyer, contact, coupon_code, note } = req.body;

  validateRequired(req.body, ['buyer', 'contact']);

  const sanitizedData = {
    buyer: sanitizeInput(buyer),
    contact: sanitizeInput(contact),
    coupon_code: coupon_code ? sanitizeInput(coupon_code) : null,
    note: note ? sanitizeInput(note) : null
  };

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    const cartItems = await conn.query(
      `SELECT c.*, pv.price, pv.discount, pv.discount_percent, pv.min_order, pv.status
       FROM carts c
       LEFT JOIN product_variants pv ON c.variant_id = pv.id
       WHERE c.user_id = ?  AND c.checked = 1`,
      [userId]
    );

    if (cartItems.length === 0) {
      throw new ApiError(400, 'No items in cart selected for checkout');
    }

    let totalQuantity = 0;
    let totalPrice = 0;

    for (const item of cartItems) {
      if (item.status !== 'on') {
        throw new ApiError(400, `Product variant ${item.variant_id} is not available`);
      }

      if (item.quantity < item.min_order) {
        throw new ApiError(400, `Minimum order for variant ${item.variant_id} is ${item.min_order}`);
      }

      let itemPrice = item.price;
      
      if (item.discount > 0) {
        if (item.discount_percent === 'percent') {
          itemPrice = itemPrice - (itemPrice * item.discount / 100);
        } else {
          itemPrice = itemPrice - item.discount;
        }
      }

      totalQuantity += item.quantity;
      totalPrice += itemPrice * item.quantity;
    }

    let discountAmount = 0;
    if (sanitizedData.coupon_code) {
      const coupons = await conn.query(
        `SELECT * FROM coupons WHERE description = ? AND status = 1 
         AND (starts_at IS NULL OR starts_at <= NOW()) 
         AND (expires_at IS NULL OR expires_at >= NOW())`,
        [sanitizedData.coupon_code]
      );

      if (coupons.length > 0) {
        const coupon = coupons[0];

        if (coupon. limit && coupon.used >= coupon.limit) {
          throw new ApiError(400, 'Coupon usage limit reached');
        }

        if (coupon.min_purchase && totalPrice < coupon.min_purchase) {
          throw new ApiError(400, `Minimum purchase for this coupon is ${coupon.min_purchase}`);
        }

        if (coupon.type === 'percent') {
          discountAmount = totalPrice * coupon.value / 100;
          if (coupon.max_value && discountAmount > coupon. max_value) {
            discountAmount = coupon.max_value;
          }
        } else {
          discountAmount = coupon.value;
        }

        await conn. query('UPDATE coupons SET used = used + 1 WHERE id = ? ', [coupon.id]);
      }
    }

    const finalAmount = totalPrice - discountAmount;
    const invoice = generateInvoice();

    const transactionResult = await conn.query(
      `INSERT INTO transactions (invoice, buyer, contact, quantity, price, fees, amount, coupon_code, note, status, ip_address) 
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'pending', ?)`,
      [
        invoice,
        sanitizedData.buyer,
        sanitizedData.contact,
        totalQuantity,
        totalPrice,
        finalAmount,
        sanitizedData.coupon_code,
        sanitizedData.note,
        req.ip
      ]
    );

    const transactionId = Number(transactionResult.insertId);

    for (const item of cartItems) {
      let itemPrice = item.price;
      
      if (item.discount > 0) {
        if (item.discount_percent === 'percent') {
          itemPrice = itemPrice - (itemPrice * item. discount / 100);
        } else {
          itemPrice = itemPrice - item.discount;
        }
      }

      await conn.query(
        'INSERT INTO order_items (transaction_id, user_id, variant_id, quantity, price, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [transactionId, userId, item.variant_id, item.quantity, itemPrice, 'pending', item.note]
      );
    }

    await conn.query('DELETE FROM carts WHERE user_id = ? AND checked = 1', [userId]);

    await conn. commit();

    return ApiResponse.created(res, {
      transaction_id: transactionId,
      invoice: invoice,
      total_quantity: totalQuantity,
      total_price: totalPrice,
      discount:  discountAmount,
      final_amount: finalAmount
    }, 'Transaction created successfully');

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    if (conn) conn.release();
  }
});

exports.updateTransactionStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (! id || isNaN(id)) {
    throw new ApiError(400, 'Invalid transaction ID');
  }

  validateRequired(req.body, ['status']);

  const validStatuses = ['pending', 'paid', 'processed', 'completed', 'cancelled'];
  validateEnum(status, validStatuses, 'status');

  const conn = await getConnection();

  try {
    const transactions = await conn.query('SELECT id, status FROM transactions WHERE id = ?', [id]);
    if (transactions.length === 0) {
      throw new ApiError(404, 'Transaction not found');
    }

    const oldStatus = transactions[0].status;

    await conn.query('UPDATE transactions SET status = ?, activity_at = CURRENT_TIMESTAMP WHERE id = ? ', [status, id]);

    if (status === 'completed' && oldStatus !== 'completed') {
      const items = await conn.query(
        `SELECT oi.variant_id, oi.quantity, pv.product_id 
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.variant_id = pv.id
         WHERE oi. transaction_id = ?`,
        [id]
      );

      for (const item of items) {
        await conn.query(
          'UPDATE products SET sold = sold + ?  WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    return ApiResponse.success(res, null, `Transaction status updated to ${status}`);

  } finally {
    if (conn) conn.release();
  }
});

exports.cancelTransaction = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { id } = req. params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid transaction ID');
  }

  const conn = await getConnection();

  try {
    const transactions = await conn.query('SELECT * FROM transactions WHERE id = ? ', [id]);

    if (transactions.length === 0) {
      throw new ApiError(404, 'Transaction not found');
    }

    const transaction = transactions[0];

    if (userRole !== 'admin') {
      const orderItems = await conn.query(
        'SELECT id FROM order_items WHERE transaction_id = ? AND user_id = ?',
        [id, userId]
      );

      if (orderItems.length === 0) {
        throw new ApiError(403, 'Access denied to this transaction');
      }

      if (transaction.status !== 'pending') {
        throw new ApiError(400, 'Only pending transactions can be cancelled by users');
      }
    }

    if (transaction.status === 'completed') {
      throw new ApiError(400, 'Cannot cancel completed transaction');
    }

    await conn.query('UPDATE transactions SET status = ? WHERE id = ?', ['cancelled', id]);

    return ApiResponse.success(res, null, 'Transaction cancelled successfully');

  } finally {
    if (conn) conn.release();
  }
});
