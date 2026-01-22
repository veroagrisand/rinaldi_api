const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt } = require('../utils/helpers');
const { validateRequired, validateEnum } = require('../utils/validation');

exports.getAllOrderItems = catchAsync(async (req, res, next) => {
  const { transaction_id, status, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = `
      SELECT oi.*, pv.name as variant_name, pv. sku, p.name as product_name,
             u.name as user_name, t.invoice
      FROM order_items oi
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      LEFT JOIN users u ON oi.user_id = u.id
      LEFT JOIN transactions t ON oi. transaction_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (transaction_id) {
      query += ' AND oi.transaction_id = ?';
      params.push(transaction_id);
    }

    if (status) {
      query += ' AND oi.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    query += ' ORDER BY oi.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orderItems = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(orderItems),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Order items retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getOrderItemById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user. id;
  const userRole = req.user.role;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid order item ID');
  }

  const conn = await getConnection();

  try {
    const orderItems = await conn.query(
      `SELECT oi.*, pv. name as variant_name, pv.sku, p.name as product_name,
              u.name as user_name, t.invoice
       FROM order_items oi
       LEFT JOIN product_variants pv ON oi. variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p. id
       LEFT JOIN users u ON oi.user_id = u.id
       LEFT JOIN transactions t ON oi.transaction_id = t.id
       WHERE oi.id = ?`,
      [id]
    );

    if (orderItems.length === 0) {
      throw new ApiError(404, 'Order item not found');
    }

    if (userRole !== 'admin' && orderItems[0].user_id !== userId) {
      throw new ApiError(403, 'Access denied to this order item');
    }

    return ApiResponse.success(res, convertBigInt(orderItems[0]), 'Order item retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.updateOrderItemStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid order item ID');
  }

  validateRequired(req.body, ['status']);

  const validStatuses = ['pending', 'sent', 'received'];
  validateEnum(status, validStatuses, 'status');

  const conn = await getConnection();

  try {
    const result = await conn.query(
      'UPDATE order_items SET status = ?  WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Order item not found');
    }

    return ApiResponse.success(res, null, `Order item status updated to ${status}`);

  } finally {
    if (conn) conn.release();
  }
});

exports.getUserOrderItems = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 10 } = req. query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = `
      SELECT oi.*, pv.name as variant_name, pv.sku, p.name as product_name,
             t.invoice, t.status as transaction_status
      FROM order_items oi
      LEFT JOIN product_variants pv ON oi.variant_id = pv. id
      LEFT JOIN products p ON pv.product_id = p.id
      LEFT JOIN transactions t ON oi.transaction_id = t.id
      WHERE oi.user_id = ? 
    `;
    const params = [userId];

    if (status) {
      query += ' AND oi.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0]. total;

    query += ' ORDER BY oi.created_at DESC LIMIT ?  OFFSET ?';
    params. push(parseInt(limit), parseInt(offset));

    const orderItems = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(orderItems),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math. ceil(total / limit)
      },
      'Your order items retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});
