const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validatePositiveNumber } = require('../utils/validation');

exports.getCart = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    const carts = await conn.query(
      `SELECT c.*, p.name as product_name, p. slug as product_slug, p.image as product_image,
              pv.name as variant_name, pv. sku, pv.price, pv. discount, pv.discount_percent, pv.status as variant_status
       FROM carts c
       LEFT JOIN products p ON c.product_id = p.id
       LEFT JOIN product_variants pv ON c.variant_id = pv.id
       WHERE c.user_id = ? 
       ORDER BY c.created_at DESC`,
      [userId]
    );

    let totalItems = 0;
    let totalPrice = 0;

    const cartData = convertBigInt(carts).map(item => {
      let itemPrice = item.price;
      
      if (item.discount > 0) {
        if (item.discount_percent === 'percent') {
          itemPrice = itemPrice - (itemPrice * item.discount / 100);
        } else {
          itemPrice = itemPrice - item.discount;
        }
      }

      const itemTotal = itemPrice * item. quantity;
      
      if (item.checked) {
        totalItems += item.quantity;
        totalPrice += itemTotal;
      }

      return {
        ...item,
        item_price: itemPrice,
        item_total: itemTotal
      };
    });

    return ApiResponse.success(res, {
      items: cartData,
      summary: {
        total_items: totalItems,
        total_price: totalPrice
      }
    }, 'Cart retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.addToCart = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { product_id, variant_id, quantity, note } = req.body;

  validateRequired(req.body, ['product_id', 'variant_id', 'quantity']);
  validatePositiveNumber(quantity, 'quantity');

  const sanitizedData = {
    product_id: product_id,
    variant_id: variant_id,
    quantity: quantity,
    note: note ? sanitizeInput(note) : null
  };

  const conn = await getConnection();

  try {
    const products = await conn.query('SELECT id, status FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }
    if (! products[0].status) {
      throw new ApiError(400, 'Product is not available');
    }

    const variants = await conn.query(
      'SELECT id, product_id, price, min_order, status FROM product_variants WHERE id = ? ',
      [variant_id]
    );
    if (variants.length === 0) {
      throw new ApiError(404, 'Product variant not found');
    }
    if (variants[0].product_id !== product_id) {
      throw new ApiError(400, 'Variant does not belong to this product');
    }
    if (variants[0].status !== 'on') {
      throw new ApiError(400, 'Product variant is not available');
    }
    if (quantity < variants[0].min_order) {
      throw new ApiError(400, `Minimum order is ${variants[0].min_order}`);
    }

    const existing = await conn.query(
      'SELECT id, quantity FROM carts WHERE user_id = ? AND product_id = ?  AND variant_id = ?',
      [userId, product_id, variant_id]
    );

    if (existing.length > 0) {
      const newQuantity = existing[0].quantity + quantity;
      await conn. query(
        'UPDATE carts SET quantity = ?, note = ? WHERE id = ? ',
        [newQuantity, sanitizedData.note, existing[0].id]
      );

      return ApiResponse.success(res, {
        id: Number(existing[0].id),
        quantity: newQuantity
      }, 'Cart updated successfully');
    } else {
      const result = await conn.query(
        'INSERT INTO carts (user_id, product_id, variant_id, quantity, checked, note) VALUES (?, ?, ?, ?, 1, ?)',
        [userId, product_id, variant_id, quantity, sanitizedData.note]
      );

      return ApiResponse.created(res, {
        id: Number(result.insertId),
        ...sanitizedData
      }, 'Item added to cart successfully');
    }

  } finally {
    if (conn) conn.release();
  }
});

exports.updateCartItem = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { quantity, checked, note } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid cart item ID');
  }

  if (quantity !== undefined) {
    validatePositiveNumber(quantity, 'quantity');
  }

  const conn = await getConnection();

  try {
    const carts = await conn.query(
      'SELECT c.id, pv.min_order FROM carts c LEFT JOIN product_variants pv ON c.variant_id = pv. id WHERE c.id = ? AND c.user_id = ?',
      [id, userId]
    );

    if (carts.length === 0) {
      throw new ApiError(404, 'Cart item not found');
    }

    if (quantity !== undefined && quantity < carts[0].min_order) {
      throw new ApiError(400, `Minimum order is ${carts[0].min_order}`);
    }

    const updates = [];
    const params = [];

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(quantity);
    }

    if (checked !== undefined) {
      updates.push('checked = ?');
      params.push(checked ?  1 : 0);
    }

    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note ?  sanitizeInput(note) : null);
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    params.push(id);
    await conn.query(`UPDATE carts SET ${updates.join(', ')} WHERE id = ?`, params);

    return ApiResponse.success(res, null, 'Cart item updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.deleteCartItem = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid cart item ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query(
      'DELETE FROM carts WHERE id = ? AND user_id = ? ',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Cart item not found');
    }

    return ApiResponse.noContent(res, 'Cart item deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.clearCart = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    await conn.query('DELETE FROM carts WHERE user_id = ?', [userId]);

    return ApiResponse. noContent(res, 'Cart cleared successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.toggleCheckAll = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { checked } = req. body;

  if (checked === undefined) {
    throw new ApiError(400, 'Checked status is required');
  }

  const conn = await getConnection();

  try {
    await conn.query(
      'UPDATE carts SET checked = ?  WHERE user_id = ?',
      [checked ?  1 : 0, userId]
    );

    return ApiResponse.success(res, null, `All items ${checked ? 'checked' : 'unchecked'} successfully`);

  } finally {
    if (conn) conn.release();
  }
});
