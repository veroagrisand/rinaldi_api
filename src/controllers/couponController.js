const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEnum, validatePositiveNumber } = require('../utils/validation');

// Get all coupons (Admin)
exports.getAllCoupons = catchAsync(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = 'SELECT * FROM coupons WHERE 1=1';
    const params = [];

    if (status !== undefined) {
      query += ' AND status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    // Add pagination
    query += ' ORDER BY created_at DESC LIMIT ?  OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const coupons = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(coupons),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Coupons retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

// Get active coupons (All users)
exports.getActiveCoupons = catchAsync(async (req, res, next) => {
  const conn = await getConnection();

  try {
    const coupons = await conn.query(
      `SELECT * FROM coupons 
       WHERE status = 1 
       AND (starts_at IS NULL OR starts_at <= NOW()) 
       AND (expires_at IS NULL OR expires_at >= NOW())
       AND (\`limit\` IS NULL OR used < \`limit\`)
       ORDER BY created_at DESC`
    );

    return ApiResponse.success(res, convertBigInt(coupons), 'Active coupons retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Get coupon by ID (Admin)
exports.getCouponById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }

  const conn = await getConnection();

  try {
    const coupons = await conn.query('SELECT * FROM coupons WHERE id = ?', [id]);

    if (coupons.length === 0) {
      throw new ApiError(404, 'Coupon not found');
    }

    return ApiResponse.success(res, convertBigInt(coupons[0]), 'Coupon retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Validate coupon code
exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, total_price } = req.body;

  validateRequired(req.body, ['code', 'total_price']);
  validatePositiveNumber(total_price, 'total_price');

  const conn = await getConnection();

  try {
    const coupons = await conn.query(
      `SELECT * FROM coupons 
       WHERE description = ? AND status = 1 
       AND (starts_at IS NULL OR starts_at <= NOW()) 
       AND (expires_at IS NULL OR expires_at >= NOW())`,
      [sanitizeInput(code)]
    );

    if (coupons. length === 0) {
      throw new ApiError(404, 'Coupon not found or expired');
    }

    const coupon = convertBigInt(coupons[0]);

    // Check usage limit
    if (coupon.limit && coupon.used >= coupon. limit) {
      throw new ApiError(400, 'Coupon usage limit reached');
    }

    // Check minimum purchase
    if (coupon.min_purchase && total_price < coupon.min_purchase) {
      throw new ApiError(400, `Minimum purchase for this coupon is ${coupon. min_purchase}`);
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === 'percent') {
      discountAmount = total_price * coupon.value / 100;
      if (coupon.max_value && discountAmount > coupon. max_value) {
        discountAmount = coupon.max_value;
      }
    } else {
      discountAmount = coupon.value;
    }

    return ApiResponse.success(res, {
      coupon: coupon,
      discount_amount: discountAmount,
      final_price: total_price - discountAmount
    }, 'Coupon is valid');

  } finally {
    if (conn) conn.release();
  }
});

// Create coupon (Admin)
exports.createCoupon = catchAsync(async (req, res, next) => {
  const {
    type, value, max_value, min_purchase, limit,
    starts_at, expires_at, login_required, status, description
  } = req.body;

  validateRequired(req. body, ['type', 'value', 'description']);

  const validTypes = ['percent', 'amount'];
  validateEnum(type, validTypes, 'type');
  validatePositiveNumber(value, 'value');

  if (max_value) validatePositiveNumber(max_value, 'max_value');
  if (min_purchase) validatePositiveNumber(min_purchase, 'min_purchase');
  if (limit) validatePositiveNumber(limit, 'limit');

  const sanitizedData = {
    type: type,
    value: value,
    max_value: max_value || null,
    min_purchase:  min_purchase || null,
    limit: limit || null,
    starts_at: starts_at || null,
    expires_at:  expires_at || null,
    login_required: login_required || 0,
    status: status !== undefined ? status : 1,
    description: sanitizeInput(description)
  };

  const conn = await getConnection();

  try {
    // Check if coupon code already exists
    const existing = await conn.query('SELECT id FROM coupons WHERE description = ?', [sanitizedData.description]);
    if (existing.length > 0) {
      throw new ApiError(409, 'Coupon code already exists');
    }

    const result = await conn.query(
      `INSERT INTO coupons (type, value, max_value, min_purchase, \`limit\`, used, starts_at, expires_at, login_required, status, description) 
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        sanitizedData.type, sanitizedData.value, sanitizedData.max_value,
        sanitizedData.min_purchase, sanitizedData.limit, sanitizedData.starts_at,
        sanitizedData.expires_at, sanitizedData.login_required, sanitizedData.status,
        sanitizedData.description
      ]
    );

    return ApiResponse.created(res, {
      id: Number(result. insertId),
      ...sanitizedData,
      used: 0
    }, 'Coupon created successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Update coupon (Admin)
exports.updateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req. params;
  const {
    type, value, max_value, min_purchase, limit,
    starts_at, expires_at, login_required, status, description
  } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }

  validateRequired(req.body, ['type', 'value', 'description']);

  const validTypes = ['percent', 'amount'];
  validateEnum(type, validTypes, 'type');
  validatePositiveNumber(value, 'value');

  if (max_value) validatePositiveNumber(max_value, 'max_value');
  if (min_purchase) validatePositiveNumber(min_purchase, 'min_purchase');
  if (limit) validatePositiveNumber(limit, 'limit');

  const sanitizedData = {
    type: type,
    value: value,
    max_value: max_value || null,
    min_purchase:  min_purchase || null,
    limit: limit || null,
    starts_at: starts_at || null,
    expires_at:  expires_at || null,
    login_required: login_required || 0,
    status: status !== undefined ? status : 1,
    description: sanitizeInput(description)
  };

  const conn = await getConnection();

  try {
    const coupons = await conn.query('SELECT id FROM coupons WHERE id = ? ', [id]);
    if (coupons.length === 0) {
      throw new ApiError(404, 'Coupon not found');
    }

    // Check if new code already exists (except current coupon)
    const existing = await conn.query('SELECT id FROM coupons WHERE description = ?  AND id != ?', [sanitizedData.description, id]);
    if (existing.length > 0) {
      throw new ApiError(409, 'Coupon code already exists');
    }

    await conn.query(
      `UPDATE coupons SET type = ?, value = ?, max_value = ?, min_purchase = ?, \`limit\` = ?, 
       starts_at = ?, expires_at = ?, login_required = ?, status = ?, description = ? 
       WHERE id = ?`,
      [
        sanitizedData.type, sanitizedData.value, sanitizedData. max_value,
        sanitizedData.min_purchase, sanitizedData.limit, sanitizedData. starts_at,
        sanitizedData.expires_at, sanitizedData.login_required, sanitizedData.status,
        sanitizedData.description, id
      ]
    );

    return ApiResponse.success(res, null, 'Coupon updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Delete coupon (Admin)
exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid coupon ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn. query('DELETE FROM coupons WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Coupon not found');
    }

    return ApiResponse.noContent(res, 'Coupon deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
