const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEnum, validateRange } = require('../utils/validation');

exports.getAllReviews = catchAsync(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = `
      SELECT or.*, t.invoice, t.buyer
      FROM order_reviews or
      LEFT JOIN transactions t ON or.transaction_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND or.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    query += ' ORDER BY or.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const reviews = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(reviews),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages:  Math.ceil(total / limit)
      },
      'Reviews retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getReviewById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid review ID');
  }

  const conn = await getConnection();

  try {
    const reviews = await conn.query(
      `SELECT or.*, t.invoice, t.buyer
       FROM order_reviews or
       LEFT JOIN transactions t ON or.transaction_id = t.id
       WHERE or.id = ?`,
      [id]
    );

    if (reviews.length === 0) {
      throw new ApiError(404, 'Review not found');
    }

    return ApiResponse.success(res, convertBigInt(reviews[0]), 'Review retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.getReviewsByTransaction = catchAsync(async (req, res, next) => {
  const { transaction_id } = req.params;

  if (!transaction_id || isNaN(transaction_id)) {
    throw new ApiError(400, 'Invalid transaction ID');
  }

  const conn = await getConnection();

  try {
    const reviews = await conn. query(
      `SELECT or.*, t.invoice, t.buyer
       FROM order_reviews or
       LEFT JOIN transactions t ON or. transaction_id = t.id
       WHERE or.transaction_id = ?`,
      [transaction_id]
    );

    return ApiResponse.success(res, convertBigInt(reviews), 'Reviews retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.createReview = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { transaction_id, rating, review } = req.body;

  validateRequired(req.body, ['transaction_id', 'rating']);

  const validRatings = ['1', '2', '3', '4', '5'];
  if (!validRatings.includes(String(rating))) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  const sanitizedData = {
    transaction_id:  transaction_id,
    rating: String(rating),
    review: review ?  sanitizeInput(review) : null
  };

  const conn = await getConnection();

  try {
    const transactions = await conn.query('SELECT id, status FROM transactions WHERE id = ?', [transaction_id]);
    if (transactions.length === 0) {
      throw new ApiError(404, 'Transaction not found');
    }

    if (transactions[0]. status !== 'completed') {
      throw new ApiError(400, 'Only completed transactions can be reviewed');
    }

    const orderItems = await conn.query(
      'SELECT id FROM order_items WHERE transaction_id = ?  AND user_id = ?',
      [transaction_id, userId]
    );

    if (orderItems. length === 0) {
      throw new ApiError(403, 'You can only review your own transactions');
    }

    const existingReview = await conn.query(
      'SELECT id FROM order_reviews WHERE transaction_id = ? ',
      [transaction_id]
    );

    if (existingReview.length > 0) {
      throw new ApiError(409, 'Review already exists for this transaction');
    }

    const result = await conn.query(
      'INSERT INTO order_reviews (transaction_id, rating, review, status) VALUES (?, ?, ?, ?)',
      [sanitizedData.transaction_id, sanitizedData.rating, sanitizedData.review, 'y']
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ...sanitizedData,
      status: 'y'
    }, 'Review created successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { rating, review, status } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid review ID');
  }

  const conn = await getConnection();

  try {
    const reviews = await conn.query(
      'SELECT or.*, oi.user_id FROM order_reviews or LEFT JOIN order_items oi ON or.transaction_id = oi.transaction_id WHERE or.id = ?  LIMIT 1',
      [id]
    );

    if (reviews.length === 0) {
      throw new ApiError(404, 'Review not found');
    }

    if (userRole !== 'admin' && reviews[0].user_id !== userId) {
      throw new ApiError(403, 'Access denied to update this review');
    }

    const updates = [];
    const params = [];

    if (rating !== undefined) {
      const validRatings = ['1', '2', '3', '4', '5'];
      if (! validRatings.includes(String(rating))) {
        throw new ApiError(400, 'Rating must be between 1 and 5');
      }
      updates.push('rating = ?');
      params.push(String(rating));
    }

    if (review !== undefined) {
      updates.push('review = ?');
      params.push(review ?  sanitizeInput(review) : null);
    }

    if (status !== undefined && userRole === 'admin') {
      const validStatuses = ['y', '1', '2'];
      validateEnum(status, validStatuses, 'status');
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    params.push(id);
    await conn.query(`UPDATE order_reviews SET ${updates. join(', ')} WHERE id = ?`, params);

    return ApiResponse.success(res, null, 'Review updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Delete review
exports.deleteReview = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req. user.role;

  if (! id || isNaN(id)) {
    throw new ApiError(400, 'Invalid review ID');
  }

  const conn = await getConnection();

  try {
    const reviews = await conn.query(
      'SELECT or.*, oi.user_id FROM order_reviews or LEFT JOIN order_items oi ON or.transaction_id = oi.transaction_id WHERE or.id = ? LIMIT 1',
      [id]
    );

    if (reviews.length === 0) {
      throw new ApiError(404, 'Review not found');
    }

    if (userRole !== 'admin' && reviews[0].user_id !== userId) {
      throw new ApiError(403, 'Access denied to delete this review');
    }

    await conn. query('DELETE FROM order_reviews WHERE id = ?', [id]);

    return ApiResponse.noContent(res, 'Review deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
