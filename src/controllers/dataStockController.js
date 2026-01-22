const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEnum } = require('../utils/validation');

exports.getAllDataStocks = catchAsync(async (req, res, next) => {
  const { variant_id, status, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = `
      SELECT ds.*, pv.name as variant_name, pv.sku, p.name as product_name
      FROM data_stocks ds
      LEFT JOIN product_variants pv ON ds.variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (variant_id) {
      query += ' AND ds.variant_id = ?';
      params.push(variant_id);
    }

    if (status) {
      query += ' AND ds.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    query += ' ORDER BY ds.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const stocks = await conn.query(query, params);

    return ApiResponse. paginate(
      res,
      convertBigInt(stocks),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math. ceil(total / limit)
      },
      'Data stocks retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getDataStockById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid data stock ID');
  }

  const conn = await getConnection();

  try {
    const stocks = await conn.query(
      `SELECT ds.*, pv.name as variant_name, pv. sku, p.name as product_name,
              t.invoice
       FROM data_stocks ds
       LEFT JOIN product_variants pv ON ds.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       LEFT JOIN transactions t ON ds.transaction_id = t.id
       WHERE ds. id = ?`,
      [id]
    );

    if (stocks.length === 0) {
      throw new ApiError(404, 'Data stock not found');
    }

    return ApiResponse.success(res, convertBigInt(stocks[0]), 'Data stock retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.getStockCountByVariant = catchAsync(async (req, res, next) => {
  const { variant_id } = req.params;

  if (!variant_id || isNaN(variant_id)) {
    throw new ApiError(400, 'Invalid variant ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query(
      `SELECT 
        COUNT(*) as total_stock,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_stock,
        SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold_stock,
        SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as invalid_stock,
        SUM(CASE WHEN status = 'locked' THEN 1 ELSE 0 END) as locked_stock
       FROM data_stocks
       WHERE variant_id = ?`,
      [variant_id]
    );

    return ApiResponse.success(res, convertBigInt(result[0]), 'Stock count retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.createDataStock = catchAsync(async (req, res, next) => {
  const { variant_id, status, expired_license, note, expired_at } = req.body;

  validateRequired(req.body, ['variant_id']);

  const validStatuses = ['active', 'sold', 'invalid', 'locked'];
  const stockStatus = status || 'active';
  validateEnum(stockStatus, validStatuses, 'status');

  const sanitizedData = {
    variant_id: variant_id,
    status: stockStatus,
    expired_license: expired_license || null,
    note: note ?  sanitizeInput(note) : null,
    expired_at: expired_at || null
  };

  const conn = await getConnection();

  try {
    const variants = await conn.query('SELECT id FROM product_variants WHERE id = ?', [variant_id]);
    if (variants.length === 0) {
      throw new ApiError(404, 'Product variant not found');
    }

    const result = await conn.query(
      'INSERT INTO data_stocks (variant_id, status, expired_license, note, expired_at) VALUES (?, ?, ?, ?, ?)',
      [
        sanitizedData.variant_id,
        sanitizedData.status,
        sanitizedData.expired_license,
        sanitizedData.note,
        sanitizedData.expired_at
      ]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ... sanitizedData
    }, 'Data stock created successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.bulkCreateDataStocks = catchAsync(async (req, res, next) => {
  const { variant_id, stocks } = req.body;

  validateRequired(req.body, ['variant_id', 'stocks']);

  if (! Array.isArray(stocks) || stocks.length === 0) {
    throw new ApiError(400, 'Stocks must be a non-empty array');
  }

  const conn = await getConnection();

  try {
    const variants = await conn.query('SELECT id FROM product_variants WHERE id = ? ', [variant_id]);
    if (variants.length === 0) {
      throw new ApiError(404, 'Product variant not found');
    }

    await conn.beginTransaction();

    const insertedIds = [];

    for (const stock of stocks) {
      const validStatuses = ['active', 'sold', 'invalid', 'locked'];
      const stockStatus = stock.status || 'active';
      
      if (! validStatuses.includes(stockStatus)) {
        throw new ApiError(400, `Invalid status: ${stockStatus}`);
      }

      const result = await conn.query(
        'INSERT INTO data_stocks (variant_id, status, expired_license, note, expired_at) VALUES (?, ?, ?, ?, ?)',
        [
          variant_id,
          stockStatus,
          stock.expired_license || null,
          stock.note ?  sanitizeInput(stock.note) : null,
          stock.expired_at || null
        ]
      );

      insertedIds.push(Number(result.insertId));
    }

    await conn.commit();

    return ApiResponse.created(res, {
      count: insertedIds. length,
      ids: insertedIds
    }, `${insertedIds.length} data stocks created successfully`);

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    if (conn) conn.release();
  }
});

exports.updateDataStock = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { variant_id, transaction_id, status, expired_license, note, expired_at } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid data stock ID');
  }

  const conn = await getConnection();

  try {
    const stocks = await conn.query('SELECT id FROM data_stocks WHERE id = ?', [id]);
    if (stocks.length === 0) {
      throw new ApiError(404, 'Data stock not found');
    }

    const updates = [];
    const params = [];

    if (variant_id !== undefined) {
      const variants = await conn.query('SELECT id FROM product_variants WHERE id = ?', [variant_id]);
      if (variants.length === 0) {
        throw new ApiError(404, 'Product variant not found');
      }
      updates.push('variant_id = ? ');
      params.push(variant_id);
    }

    if (transaction_id !== undefined) {
      updates.push('transaction_id = ? ');
      params.push(transaction_id || null);
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'sold', 'invalid', 'locked'];
      validateEnum(status, validStatuses, 'status');
      updates.push('status = ?');
      params.push(status);
    }

    if (expired_license !== undefined) {
      updates.push('expired_license = ?');
      params.push(expired_license || null);
    }

    if (note !== undefined) {
      updates.push('note = ?');
      params.push(note ? sanitizeInput(note) : null);
    }

    if (expired_at !== undefined) {
      updates.push('expired_at = ? ');
      params.push(expired_at || null);
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    params.push(id);
    await conn.query(`UPDATE data_stocks SET ${updates. join(', ')} WHERE id = ?`, params);

    return ApiResponse.success(res, null, 'Data stock updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.deleteDataStock = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid data stock ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query('DELETE FROM data_stocks WHERE id = ? ', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Data stock not found');
    }

    return ApiResponse.noContent(res, 'Data stock deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
