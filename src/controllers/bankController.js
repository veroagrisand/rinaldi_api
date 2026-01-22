const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEnum, validatePositiveNumber } = require('../utils/validation');

// Get all banks
exports.getAllBanks = catchAsync(async (req, res, next) => {
  const { status, type } = req.query;

  const conn = await getConnection();

  try {
    let query = 'SELECT * FROM banks WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params. push(status);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const banks = await conn.query(query, params);

    return ApiResponse.success(res, convertBigInt(banks), 'Banks retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Get bank by ID
exports.getBankById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid bank ID');
  }

  const conn = await getConnection();

  try {
    const banks = await conn.query('SELECT * FROM banks WHERE id = ?', [id]);

    if (banks.length === 0) {
      throw new ApiError(404, 'Bank not found');
    }

    return ApiResponse.success(res, convertBigInt(banks[0]), 'Bank retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Create bank (Admin only)
exports.createBank = catchAsync(async (req, res, next) => {
  const {
    type, status, need_login, fees_percent_amount, fees,
    min_price, minimum, image, icon, invert_icon, description
  } = req.body;

  validateRequired(req.body, ['type', 'status']);

  const validFeesTypes = ['percent', 'fixed'];
  const feesType = fees_percent_amount || 'percent';
  validateEnum(feesType, validFeesTypes, 'fees_percent_amount');

  const sanitizedData = {
    type: sanitizeInput(type),
    status: sanitizeInput(status),
    need_login: need_login || 0,
    fees_percent_amount: feesType,
    fees: fees || '0',
    min_price:  min_price || '0',
    minimum: minimum || 0,
    image: image ?  sanitizeInput(image) : null,
    icon: icon ? sanitizeInput(icon) : null,
    invert_icon: invert_icon || 0,
    description: description ?  sanitizeInput(description) : null
  };

  const conn = await getConnection();

  try {
    const result = await conn.query(
      `INSERT INTO banks (type, status, need_login, fees_percent_amount, fees, min_price, minimum, image, icon, invert_icon, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizedData.type, sanitizedData.status, sanitizedData.need_login,
        sanitizedData.fees_percent_amount, sanitizedData. fees, sanitizedData.min_price,
        sanitizedData. minimum, sanitizedData.image, sanitizedData.icon,
        sanitizedData.invert_icon, sanitizedData.description
      ]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ...sanitizedData
    }, 'Bank created successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Update bank (Admin only)
exports.updateBank = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    type, status, need_login, fees_percent_amount, fees,
    min_price, minimum, image, icon, invert_icon, description
  } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid bank ID');
  }

  validateRequired(req.body, ['type', 'status']);

  const validFeesTypes = ['percent', 'fixed'];
  const feesType = fees_percent_amount || 'percent';
  validateEnum(feesType, validFeesTypes, 'fees_percent_amount');

  const sanitizedData = {
    type: sanitizeInput(type),
    status: sanitizeInput(status),
    need_login: need_login || 0,
    fees_percent_amount: feesType,
    fees: fees || '0',
    min_price: min_price || '0',
    minimum: minimum || 0,
    image: image ? sanitizeInput(image) : null,
    icon: icon ? sanitizeInput(icon) : null,
    invert_icon: invert_icon || 0,
    description:  description ? sanitizeInput(description) : null
  };

  const conn = await getConnection();

  try {
    const banks = await conn.query('SELECT id FROM banks WHERE id = ?', [id]);
    if (banks.length === 0) {
      throw new ApiError(404, 'Bank not found');
    }

    await conn.query(
      `UPDATE banks SET type = ?, status = ?, need_login = ?, fees_percent_amount = ?, fees = ?, 
       min_price = ?, minimum = ?, image = ?, icon = ?, invert_icon = ?, description = ? 
       WHERE id = ?`,
      [
        sanitizedData.type, sanitizedData.status, sanitizedData.need_login,
        sanitizedData.fees_percent_amount, sanitizedData.fees, sanitizedData.min_price,
        sanitizedData.minimum, sanitizedData.image, sanitizedData.icon,
        sanitizedData.invert_icon, sanitizedData.description, id
      ]
    );

    return ApiResponse.success(res, null, 'Bank updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Delete bank (Admin only)
exports.deleteBank = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid bank ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query('DELETE FROM banks WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Bank not found');
    }

    return ApiResponse.noContent(res, 'Bank deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
