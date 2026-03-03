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
      `SELECT c.*, p.name as product_name, p.slug as product_slug, p.image as product_image, p.status as product_status,
              pv.name as variant_name, pv.sku, pv.price, pv.discount, pv.discount_percent, pv.status as variant_status, pv.min_order
       FROM carts c
       LEFT JOIN products p ON c.product_id = p.id
       LEFT JOIN product_variants pv ON c.variant_id = pv.id
       WHERE c.user_id = ? 
       ORDER BY c.created_at DESC`,
      [userId]
    );

    let totalItems = 0;
    let subtotal = 0;
    let totalDiscount = 0;

    const cartData = convertBigInt(carts).map(item => {
      // Calculate price after product-level discount
      let itemPrice = item.price || 0;
      let itemDiscount = 0;
      
      if (item.discount && item.discount > 0) {
        if (item.discount_percent === 'percent') {
          itemDiscount = itemPrice * (item.discount / 100);
          itemPrice = itemPrice - itemDiscount;
        } else {
          itemDiscount = Math.min(item.discount, itemPrice);
          itemPrice = Math.max(0, itemPrice - itemDiscount);
        }
      }

      const itemTotal = itemPrice * item.quantity;
      const totalItemDiscount = itemDiscount * item.quantity;
      
      // Only count checked items in totals
      if (item.checked) {
        totalItems += item.quantity;
        subtotal += itemTotal;
        totalDiscount += totalItemDiscount;
      }

      return {
        ...item,
        item_price: Math.round(itemPrice),
        item_discount: Math.round(totalItemDiscount),
        item_total: Math.round(itemTotal),
        is_available: item.product_status === 1 && item.variant_status === 'on'
      };
    });

    // Calculate estimated fees (2%)
    const estimatedFees = Math.floor(subtotal * 0.02);
    const estimatedTotal = subtotal + estimatedFees;

    return ApiResponse.success(res, {
      items: cartData,
      summary: {
        total_items: totalItems,
        subtotal: Math.round(subtotal),
        total_discount: Math.round(totalDiscount),
        estimated_fees: estimatedFees,
        estimated_total: Math.round(estimatedTotal),
        item_count: cartData.length,
        checked_count: cartData.filter(i => i.checked).length
      }
    }, 'Cart retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.addToCart = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // IMPORTANT: coerce types early (req.body values often arrive as strings)
  let { product_id, variant_id, quantity, note } = req.body;

  product_id = Number(product_id);
  variant_id = Number(variant_id);
  quantity = Number(quantity);

  // Now validate required after coercion
  validateRequired({ product_id, variant_id, quantity }, ['product_id', 'variant_id', 'quantity']);
  validatePositiveNumber(quantity, 'quantity');

  // Validate quantity is an integer
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Quantity must be a positive integer');
  }

  // Validate quantity doesn't exceed maximum limit
  if (quantity > 999) {
    throw new ApiError(400, 'Quantity cannot exceed 999 units per item');
  }

  const sanitizedData = {
    product_id,
    variant_id,
    quantity,
    note: note ? sanitizeInput(note).substring(0, 255) : null
  };

  const conn = await getConnection();

  try {
    // Verify product exists and is active
    const products = await conn.query(
      'SELECT id, status, name, slug, image FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0) throw new ApiError(404, 'Product not found');

    const product = products[0];
    if (!product.status) {
      throw new ApiError(400, `Product "${product.name}" is currently unavailable`);
    }

    // Verify variant exists, belongs to product, and is active
    const variants = await conn.query(
      `SELECT id, product_id, price, min_order, status, name, sku
       FROM product_variants
       WHERE id = ? AND product_id = ?`,
      [variant_id, product_id]
    );

    if (variants.length === 0) {
      throw new ApiError(404, 'Product variant not found for this product');
    }

    const variant = variants[0];

    if (variant.status !== 'on') {
      throw new ApiError(400, `Variant "${variant.name}" is not available`);
    }

    // Validate quantity meets minimum order requirement
    if (quantity < Number(variant.min_order)) {
      throw new ApiError(
        400,
        `Minimum order quantity is ${variant.min_order}, you requested ${quantity}`
      );
    }

    // Check stock availability
    const stockRecords = await conn.query(
      `SELECT COALESCE(SUM(quantity),0) as available_stock
       FROM data_stocks
       WHERE variant_id = ? AND status = 'available'`,
      [variant_id]
    );

    const availableStock = Number(stockRecords[0]?.available_stock || 0);

    if (availableStock < quantity) {
      throw new ApiError(400, `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
    }

    // Check if item already exists in cart
    const existing = await conn.query(
      'SELECT id, quantity FROM carts WHERE user_id = ? AND product_id = ? AND variant_id = ?',
      [userId, product_id, variant_id]
    );

    if (existing.length > 0) {
      const newQuantity = Number(existing[0].quantity) + quantity;

      if (newQuantity > 999) {
        throw new ApiError(
          400,
          `Total quantity exceeds maximum of 999. Current: ${existing[0].quantity}, Adding: ${quantity}`
        );
      }

      if (availableStock < newQuantity) {
        throw new ApiError(
          400,
          `Insufficient stock for total quantity. Available: ${availableStock}, Total needed: ${newQuantity}`
        );
      }

      await conn.query(
        'UPDATE carts SET quantity = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, sanitizedData.note, existing[0].id]
      );

      return ApiResponse.success(res, {
        id: Number(existing[0].id),
        product_id,
        product_name: product.name,
        variant_id,
        variant_name: variant.name,
        quantity: newQuantity,
        price: variant.price,
        note: sanitizedData.note
      }, `Quantity updated to ${newQuantity}`);
    }

    const result = await conn.query(
      `INSERT INTO carts (user_id, product_id, variant_id, quantity, checked, note, created_at)
       VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
      [userId, product_id, variant_id, quantity, sanitizedData.note]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      product_id,
      product_name: product.name,
      variant_id,
      variant_name: variant.name,
      quantity,
      price: variant.price,
      note: sanitizedData.note
    }, 'Item added to cart successfully');
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

  // Validate at least one field is provided
  if (quantity === undefined && checked === undefined && note === undefined) {
    throw new ApiError(400, 'At least one field (quantity, checked, or note) must be provided');
  }

  // Validate quantity if provided
  if (quantity !== undefined) {
    validatePositiveNumber(quantity, 'quantity');
    
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Quantity must be a positive integer');
    }
    
    if (quantity > 999) {
      throw new ApiError(400, 'Maximum quantity per item is 999');
    }
  }

  // Validate checked if provided
  if (checked !== undefined && typeof checked !== 'boolean' && ![0, 1].includes(checked)) {
    throw new ApiError(400, 'Checked must be a boolean (true/false) or 0/1');
  }

  const conn = await getConnection();

  try {
    // Fetch cart item with variant details
    const carts = await conn.query(
      `SELECT c.id, c.quantity, c.user_id, pv.min_order, pv.status, pv.name as variant_name
       FROM carts c 
       LEFT JOIN product_variants pv ON c.variant_id = pv.id 
       WHERE c.id = ? AND c.user_id = ?`,
      [id, userId]
    );

    if (carts.length === 0) {
      throw new ApiError(404, 'Cart item not found');
    }

    const cart = carts[0];

    // Validate quantity meets minimum order if being updated
    if (quantity !== undefined && quantity < cart.min_order) {
      throw new ApiError(400, `Minimum order quantity for this variant is ${cart.min_order}`);
    }

    // Validate variant is still available if quantity is being increased
    if (quantity !== undefined && quantity > cart.quantity && cart.status !== 'on') {
      throw new ApiError(400, `Variant "${cart.variant_name}" is no longer available`);
    }

    // Build update query
    const updates = [];
    const params = [];

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(quantity);
    }

    if (checked !== undefined) {
      updates.push('checked = ?');
      params.push(checked ? 1 : 0);
    }

    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note ? sanitizeInput(note).substring(0, 255) : null);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    // Execute update
    await conn.query(
      `UPDATE carts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

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
    // Verify cart item belongs to user before deleting
    const cartItem = await conn.query(
      'SELECT id, product_id, variant_id FROM carts WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (cartItem.length === 0) {
      throw new ApiError(404, 'Cart item not found');
    }

    // Delete the cart item
    const result = await conn.query(
      'DELETE FROM carts WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      throw new ApiError(500, 'Failed to delete cart item');
    }

    return ApiResponse.success(res, null, 'Item removed from cart successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.clearCart = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    // Get count before clearing
    const countResult = await conn.query(
      'SELECT COUNT(*) as count FROM carts WHERE user_id = ?',
      [userId]
    );

    const itemCount = countResult[0]?.count || 0;

    if (itemCount === 0) {
      return ApiResponse.success(res, { items_cleared: 0 }, 'Cart is already empty');
    }

    // Clear all items
    await conn.query('DELETE FROM carts WHERE user_id = ?', [userId]);

    return ApiResponse.success(res, { items_cleared: itemCount }, 'Cart cleared successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.toggleCheckAll = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { checked } = req.body;

  // Validate checked is boolean
  if (checked === undefined || typeof checked !== 'boolean') {
    throw new ApiError(400, 'Checked status must be provided as boolean (true/false)');
  }

  const conn = await getConnection();

  try {
    // Get count of items before update
    const countResult = await conn.query(
      'SELECT COUNT(*) as count FROM carts WHERE user_id = ?',
      [userId]
    );

    const itemCount = countResult[0]?.count || 0;

    if (itemCount === 0) {
      return ApiResponse.success(res, { items_updated: 0 }, 'Cart is empty');
    }

    // Update all cart items with the new checked status
    await conn.query(
      'UPDATE carts SET checked = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [checked ? 1 : 0, userId]
    );

    return ApiResponse.success(res, 
      { items_updated: itemCount, checked: checked },
      `All ${itemCount} item(s) have been ${checked ? 'selected' : 'deselected'}`
    );

  } finally {
    if (conn) conn.release();
  }
});
