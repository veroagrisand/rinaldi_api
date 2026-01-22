const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired } = require('../utils/validation');

exports.getAllCategories = catchAsync(async (req, res, next) => {
  const conn = await getConnection();

  try {
    const categories = await conn.query(
      'SELECT * FROM categories ORDER BY name ASC'
    );

    return ApiResponse.success(
      res,
      convertBigInt(categories),
      'Categories retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getCategoryById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  const conn = await getConnection();

  try {
    const categories = await conn.query(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    if (categories. length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    return ApiResponse.success(
      res,
      convertBigInt(categories[0]),
      'Category retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getCategoryBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  if (!slug) {
    throw new ApiError(400, 'Slug is required');
  }

  const conn = await getConnection();

  try {
    const categories = await conn.query(
      'SELECT * FROM categories WHERE slug = ?',
      [sanitizeInput(slug)]
    );

    if (categories.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    return ApiResponse.success(
      res,
      convertBigInt(categories[0]),
      'Category retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.createCategory = catchAsync(async (req, res, next) => {
  const { slug, name, description } = req.body;

  validateRequired(req.body, ['slug', 'name']);

  const sanitizedData = {
    slug: sanitizeInput(slug).toLowerCase(),
    name: sanitizeInput(name),
    description: description ? sanitizeInput(description) : null
  };

  const conn = await getConnection();

  try {
    const existing = await conn.query(
      'SELECT id FROM categories WHERE slug = ?',
      [sanitizedData.slug]
    );

    if (existing.length > 0) {
      throw new ApiError(409, 'Category with this slug already exists');
    }

    const result = await conn.query(
      'INSERT INTO categories (slug, name, description) VALUES (?, ?, ?)',
      [sanitizedData.slug, sanitizedData. name, sanitizedData.description]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      slug: sanitizedData.slug,
      name: sanitizedData. name,
      description: sanitizedData.description
    }, 'Category created successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const { id } = req. params;
  const { slug, name, description } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  validateRequired(req.body, ['slug', 'name']);

  const sanitizedData = {
    slug: sanitizeInput(slug).toLowerCase(),
    name: sanitizeInput(name),
    description: description ? sanitizeInput(description) : null
  };

  const conn = await getConnection();

  try {
    const categories = await conn.query(
      'SELECT id FROM categories WHERE id = ?',
      [id]
    );

    if (categories.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    const existing = await conn.query(
      'SELECT id FROM categories WHERE slug = ?  AND id != ?',
      [sanitizedData.slug, id]
    );

    if (existing.length > 0) {
      throw new ApiError(409, 'Category with this slug already exists');
    }

    await conn.query(
      'UPDATE categories SET slug = ?, name = ?, description = ? WHERE id = ?',
      [sanitizedData.slug, sanitizedData.name, sanitizedData.description, id]
    );

    return ApiResponse.success(res, null, 'Category updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid category ID');
  }

  const conn = await getConnection();

  try {
    const products = await conn. query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );

    if (products[0].count > 0) {
      throw new ApiError(400, 'Cannot delete category with existing products');
    }

    const result = await conn.query(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Category not found');
    }

    return ApiResponse. noContent(res, 'Category deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
