const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validatePositiveNumber } = require('../utils/validation');

exports.getAllProducts = catchAsync(async (req, res, next) => {
  const { category_id, status, search, page = 1, limit = 10, sort = 'created_at', order = 'DESC' } = req.query;

  const offset = (page - 1) * limit;
  const allowedSort = ['created_at', 'name', 'view', 'sold', 'sort'];
  const allowedOrder = ['ASC', 'DESC'];

  if (!allowedSort.includes(sort)) {
    throw new ApiError(400, `Invalid sort field.  Allowed:  ${allowedSort.join(', ')}`);
  }

  if (!allowedOrder.includes(order. toUpperCase())) {
    throw new ApiError(400, `Invalid order.  Allowed: ${allowedOrder. join(', ')}`);
  }

  const conn = await getConnection();

  try {
    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND p.category_id = ? ';
      params.push(category_id);
    }

    if (status !== undefined) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    query += ` ORDER BY p.${sort} ${order. toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const products = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(products),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math. ceil(total / limit)
      },
      'Products retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getProductById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const conn = await getConnection();

  try {
    const products = await conn.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? `,
      [id]
    );

    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }

    await conn.query('UPDATE products SET view = view + 1 WHERE id = ?', [id]);

    const variants = await conn.query(
      'SELECT * FROM product_variants WHERE product_id = ?  ORDER BY sort ASC',
      [id]
    );

    const product = convertBigInt(products[0]);
    product.variants = convertBigInt(variants);

    return ApiResponse.success(res, product, 'Product retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.getProductBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  if (!slug) {
    throw new ApiError(400, 'Slug is required');
  }

  const conn = await getConnection();

  try {
    const products = await conn.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = ? `,
      [sanitizeInput(slug)]
    );

    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }

    await conn.query('UPDATE products SET view = view + 1 WHERE slug = ?', [slug]);

    const variants = await conn. query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC',
      [products[0].id]
    );

    const product = convertBigInt(products[0]);
    product.variants = convertBigInt(variants);

    return ApiResponse.success(res, product, 'Product retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports. createProduct = catchAsync(async (req, res, next) => {
  const { sort, category_id, name, slug, image, description, status } = req.body;

  validateRequired(req.body, ['category_id', 'name', 'slug']);

  const sanitizedData = {
    sort: sort || 0,
    category_id: category_id,
    name: sanitizeInput(name),
    slug: sanitizeInput(slug).toLowerCase(),
    image: image ?  sanitizeInput(image) : null,
    description: description ? sanitizeInput(description) : null,
    status: status !== undefined ? status : 1
  };

  const conn = await getConnection();

  try {
    const categories = await conn.query('SELECT id FROM categories WHERE id = ? ', [category_id]);
    if (categories.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    const existing = await conn.query('SELECT id FROM products WHERE slug = ? ', [sanitizedData.slug]);
    if (existing.length > 0) {
      throw new ApiError(409, 'Product with this slug already exists');
    }

    const result = await conn.query(
      `INSERT INTO products (sort, category_id, name, slug, image, sold, view, description, status) 
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [
        sanitizedData.sort,
        sanitizedData.category_id,
        sanitizedData.name,
        sanitizedData.slug,
        sanitizedData.image,
        sanitizedData.description,
        sanitizedData.status
      ]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ...sanitizedData,
      sold: 0,
      view: 0
    }, 'Product created successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { sort, category_id, name, slug, image, description, status } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  validateRequired(req.body, ['category_id', 'name', 'slug']);

  const sanitizedData = {
    sort: sort || 0,
    category_id: category_id,
    name: sanitizeInput(name),
    slug: sanitizeInput(slug).toLowerCase(),
    image: image ? sanitizeInput(image) : null,
    description: description ? sanitizeInput(description) : null,
    status: status !== undefined ? status : 1
  };

  const conn = await getConnection();

  try {
    const products = await conn.query('SELECT id FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      throw new ApiError(404, 'Product not found');
    }

    const categories = await conn.query('SELECT id FROM categories WHERE id = ?', [category_id]);
    if (categories.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    const existing = await conn. query('SELECT id FROM products WHERE slug = ?  AND id != ?', [sanitizedData.slug, id]);
    if (existing.length > 0) {
      throw new ApiError(409, 'Product with this slug already exists');
    }

    await conn.query(
      `UPDATE products SET sort = ?, category_id = ?, name = ?, slug = ?, image = ?, description = ?, status = ?  
       WHERE id = ?`,
      [
        sanitizedData. sort,
        sanitizedData. category_id,
        sanitizedData.name,
        sanitizedData.slug,
        sanitizedData.image,
        sanitizedData.description,
        sanitizedData.status,
        id
      ]
    );

    return ApiResponse.success(res, null, 'Product updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Product not found');
    }

    return ApiResponse.noContent(res, 'Product deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
