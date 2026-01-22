const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired } = require('../utils/validation');

// Get all news
exports.getAllNews = catchAsync(async (req, res, next) => {
  const { search, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = 'SELECT * FROM news WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    // Add pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const news = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(news),
      {
        page:  parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'News retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

// Get news by ID
exports.getNewsById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid news ID');
  }

  const conn = await getConnection();

  try {
    const news = await conn.query('SELECT * FROM news WHERE id = ?', [id]);

    if (news.length === 0) {
      throw new ApiError(404, 'News not found');
    }

    return ApiResponse.success(res, convertBigInt(news[0]), 'News retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Get news by slug
exports.getNewsBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  if (! slug) {
    throw new ApiError(400, 'Slug is required');
  }

  const conn = await getConnection();

  try {
    const news = await conn.query('SELECT * FROM news WHERE slug = ?', [sanitizeInput(slug)]);

    if (news.length === 0) {
      throw new ApiError(404, 'News not found');
    }

    return ApiResponse.success(res, convertBigInt(news[0]), 'News retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Create news (Admin)
exports.createNews = catchAsync(async (req, res, next) => {
  const { title, slug, image, content, price_reseller } = req.body;

  validateRequired(req.body, ['title', 'slug', 'content']);

  const sanitizedData = {
    title: sanitizeInput(title),
    slug: sanitizeInput(slug).toLowerCase(),
    image: image ?  sanitizeInput(image) : null,
    content: sanitizeInput(content),
    price_reseller: price_reseller || null
  };

  const conn = await getConnection();

  try {
    // Check if slug already exists
    const existing = await conn.query('SELECT id FROM news WHERE slug = ?', [sanitizedData.slug]);
    if (existing.length > 0) {
      throw new ApiError(409, 'News with this slug already exists');
    }

    const result = await conn. query(
      'INSERT INTO news (title, slug, image, content, price_reseller) VALUES (?, ?, ?, ?, ?)',
      [sanitizedData.title, sanitizedData.slug, sanitizedData.image, sanitizedData.content, sanitizedData.price_reseller]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ...sanitizedData
    }, 'News created successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Update news (Admin)
exports.updateNews = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, slug, image, content, price_reseller } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid news ID');
  }

  validateRequired(req.body, ['title', 'slug', 'content']);

  const sanitizedData = {
    title: sanitizeInput(title),
    slug: sanitizeInput(slug).toLowerCase(),
    image: image ? sanitizeInput(image) : null,
    content: sanitizeInput(content),
    price_reseller:  price_reseller || null
  };

  const conn = await getConnection();

  try {
    const news = await conn.query('SELECT id FROM news WHERE id = ? ', [id]);
    if (news.length === 0) {
      throw new ApiError(404, 'News not found');
    }

    // Check if new slug already exists (except current news)
    const existing = await conn. query('SELECT id FROM news WHERE slug = ? AND id != ?', [sanitizedData.slug, id]);
    if (existing.length > 0) {
      throw new ApiError(409, 'News with this slug already exists');
    }

    await conn.query(
      'UPDATE news SET title = ?, slug = ?, image = ?, content = ?, price_reseller = ? WHERE id = ? ',
      [sanitizedData. title, sanitizedData.slug, sanitizedData.image, sanitizedData.content, sanitizedData. price_reseller, id]
    );

    return ApiResponse. success(res, null, 'News updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Delete news (Admin)
exports.deleteNews = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid news ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query('DELETE FROM news WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'News not found');
    }

    return ApiResponse.noContent(res, 'News deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
