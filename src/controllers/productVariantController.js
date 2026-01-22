const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEnum, validatePositiveNumber } = require('../utils/validation');

exports.getVariantsByProduct = catchAsync(async (req, res, next) => {
  const { product_id } = req.params;

  if (!product_id || isNaN(product_id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const conn = await getConnection();

  try {
    const products = await conn.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }

    const variants = await conn.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC',
      [product_id]
    );

    return ApiResponse. success(
      res,
      convertBigInt(variants),
      'Product variants retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getVariantById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid variant ID');
  }

  const conn = await getConnection();

  try {
    const variants = await conn.query(
      `SELECT pv.*, p.name as product_name, p.slug as product_slug
       FROM product_variants pv
       LEFT JOIN products p ON pv.product_id = p.id
       WHERE pv.id = ?`,
      [id]
    );

    if (variants.length === 0) {
      throw new ApiError(404, 'Product variant not found');
    }

    return ApiResponse.success(res, convertBigInt(variants[0]), 'Variant retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.getVariantBySku = catchAsync(async (req, res, next) => {
  const { sku } = req.params;

  if (! sku) {
    throw new ApiError(400, 'SKU is required');
  }

  const conn = await getConnection();

  try {
    const variants = await conn.query(
      `SELECT pv.*, p.name as product_name, p. slug as product_slug
       FROM product_variants pv
       LEFT JOIN products p ON pv.product_id = p.id
       WHERE pv.sku = ? `,
      [sanitizeInput(sku)]
    );

    if (variants.length === 0) {
      throw new ApiError(404, 'Product variant not found');
    }

    return ApiResponse.success(res, convertBigInt(variants[0]), 'Variant retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.createVariant = catchAsync(async (req, res, next) => {
  const {
    sort, product_id, sku, name, price, discount_percent, discount,
    min_order, discount_start, discount_end, status, label,
    is_label_required, note, seller_note, description
  } = req.body;

  validateRequired(req.body, ['product_id', 'sku', 'name', 'price']);

  validatePositiveNumber(price, 'price');
  if (discount) validatePositiveNumber(discount, 'discount');
  if (min_order) validatePositiveNumber(min_order, 'min_order');

  const validDiscountTypes = ['percent', 'nominal'];
  const discountType = discount_percent || 'percent';
  validateEnum(discountType, validDiscountTypes, 'discount_percent');

  const validStatuses = ['on', 'off', 'out'];
  const variantStatus = status || 'on';
  validateEnum(variantStatus, validStatuses, 'status');

  const sanitizedData = {
    sort: sort || 0,
    product_id: product_id,
    sku: sanitizeInput(sku).toUpperCase(),
    name: sanitizeInput(name),
    price: price,
    discount_percent: discountType,
    discount: discount || 0,
    min_order: min_order || 1,
    discount_start: discount_start || null,
    discount_end: discount_end || null,
    status: variantStatus,
    label: label ?  sanitizeInput(label) : null,
    is_label_required: is_label_required || 0,
    note: note ?  sanitizeInput(note) : null,
    seller_note: seller_note ? sanitizeInput(seller_note) : null,
    description: description ? sanitizeInput(description) : null
  };

  const conn = await getConnection();

  try {
    const products = await conn.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }

    const existing = await conn.query('SELECT id FROM product_variants WHERE sku = ?', [sanitizedData. sku]);
    if (existing.length > 0) {
      throw new ApiError(409, 'Variant with this SKU already exists');
    }

    const result = await conn.query(
      `INSERT INTO product_variants 
       (sort, product_id, sku, name, price, discount_percent, discount, min_order, 
        discount_start, discount_end, status, label, is_label_required, note, seller_note, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizedData.sort, sanitizedData.product_id, sanitizedData.sku, sanitizedData.name,
        sanitizedData.price, sanitizedData. discount_percent, sanitizedData. discount, sanitizedData.min_order,
        sanitizedData.discount_start, sanitizedData.discount_end, sanitizedData.status, sanitizedData.label,
        sanitizedData.is_label_required, sanitizedData.note, sanitizedData.seller_note, sanitizedData.description
      ]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ...sanitizedData
    }, 'Variant created successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.updateVariant = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    sort, product_id, sku, name, price, discount_percent, discount,
    min_order, discount_start, discount_end, status, label,
    is_label_required, note, seller_note, description
  } = req. body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid variant ID');
  }

  validateRequired(req. body, ['product_id', 'sku', 'name', 'price']);

  validatePositiveNumber(price, 'price');
  if (discount) validatePositiveNumber(discount, 'discount');
  if (min_order) validatePositiveNumber(min_order, 'min_order');

  const validDiscountTypes = ['percent', 'nominal'];
  const discountType = discount_percent || 'percent';
  validateEnum(discountType, validDiscountTypes, 'discount_percent');

  const validStatuses = ['on', 'off', 'out'];
  const variantStatus = status || 'on';
  validateEnum(variantStatus, validStatuses, 'status');

  const sanitizedData = {
    sort: sort || 0,
    product_id: product_id,
    sku: sanitizeInput(sku).toUpperCase(),
    name: sanitizeInput(name),
    price: price,
    discount_percent: discountType,
    discount: discount || 0,
    min_order: min_order || 1,
    discount_start: discount_start || null,
    discount_end: discount_end || null,
    status: variantStatus,
    label: label ? sanitizeInput(label) : null,
    is_label_required:  is_label_required || 0,
    note: note ? sanitizeInput(note) : null,
    seller_note: seller_note ? sanitizeInput(seller_note) : null,
    description: description ? sanitizeInput(description) : null
  };

  const conn = await getConnection();

  try {
    const variants = await conn.query('SELECT id FROM product_variants WHERE id = ?', [id]);
    if (variants.length === 0) {
      throw new ApiError(404, 'Variant not found');
    }
    const products = await conn.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }
    const existing = await conn.query('SELECT id FROM product_variants WHERE sku = ? AND id != ?', [sanitizedData.sku, id]);
    if (existing.length > 0) {
      throw new ApiError(409, 'Variant with this SKU already exists');
    }

    await conn.query(
      `UPDATE product_variants SET 
       sort = ?, product_id = ?, sku = ?, name = ?, price = ?, discount_percent = ?, discount = ?, 
       min_order = ?, discount_start = ?, discount_end = ?, status = ?, label = ?, is_label_required = ?, 
       note = ?, seller_note = ?, description = ? 
       WHERE id = ?`,
      [
        sanitizedData. sort, sanitizedData.product_id, sanitizedData.sku, sanitizedData.name,
        sanitizedData.price, sanitizedData.discount_percent, sanitizedData.discount, sanitizedData.min_order,
        sanitizedData.discount_start, sanitizedData.discount_end, sanitizedData.status, sanitizedData.label,
        sanitizedData.is_label_required, sanitizedData.note, sanitizedData.seller_note, sanitizedData.description,
        id
      ]
    );

    return ApiResponse.success(res, null, 'Variant updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.deleteVariant = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid variant ID');
  }

  const conn = await getConnection();

  try {
    const stocks = await conn.query('SELECT COUNT(*) as count FROM data_stocks WHERE variant_id = ? ', [id]);
    if (stocks[0].count > 0) {
      throw new ApiError(400, 'Cannot delete variant with existing stocks');
    }

    const result = await conn.query('DELETE FROM product_variants WHERE id = ? ', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Variant not found');
    }

    return ApiResponse.noContent(res, 'Variant deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
