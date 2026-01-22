const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired } = require('../utils/validation');

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  const { user_id, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = `
      SELECT n.*, u.name as user_name, u.email as user_email
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND n.user_id = ?';
      params.push(user_id);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn. query(countQuery, params);
    const total = totalResult[0].total;

    query += ' ORDER BY n.created_at DESC LIMIT ?  OFFSET ?';
    params. push(parseInt(limit), parseInt(offset));

    const notifications = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(notifications),
      {
        page:  parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Notifications retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getUserNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    const query = 'SELECT * FROM notifications WHERE user_id = ?  ORDER BY created_at DESC LIMIT ?  OFFSET ?';
    const params = [userId, parseInt(limit), parseInt(offset)];

    const countResult = await conn.query('SELECT COUNT(*) as total FROM notifications WHERE user_id = ?', [userId]);
    const total = countResult[0].total;

    const notifications = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(notifications),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Your notifications retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

exports.getNotificationById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user. id;
  const userRole = req.user.role;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid notification ID');
  }

  const conn = await getConnection();

  try {
    const notifications = await conn.query('SELECT * FROM notifications WHERE id = ? ', [id]);

    if (notifications.length === 0) {
      throw new ApiError(404, 'Notification not found');
    }

    if (userRole !== 'admin' && notifications[0].user_id !== userId) {
      throw new ApiError(403, 'Access denied to this notification');
    }

    return ApiResponse.success(res, convertBigInt(notifications[0]), 'Notification retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.createNotification = catchAsync(async (req, res, next) => {
  const { user_id, title, content } = req.body;

  validateRequired(req.body, ['user_id', 'title', 'content']);

  const sanitizedData = {
    user_id: user_id,
    title: sanitizeInput(title),
    content: sanitizeInput(content)
  };

  const conn = await getConnection();

  try {
    const users = await conn.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const result = await conn.query(
      'INSERT INTO notifications (user_id, title, content) VALUES (?, ?, ?)',
      [sanitizedData.user_id, sanitizedData.title, sanitizedData.content]
    );

    return ApiResponse.created(res, {
      id: Number(result.insertId),
      ...sanitizedData
    }, 'Notification created successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.broadcastNotification = catchAsync(async (req, res, next) => {
  const { title, content, role } = req.body;

  validateRequired(req.body, ['title', 'content']);

  const sanitizedData = {
    title: sanitizeInput(title),
    content: sanitizeInput(content)
  };

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    let query = 'SELECT id FROM users WHERE status = ? ';
    const params = ['active'];

    if (role) {
      const validRoles = ['user', 'admin', 'reseller'];
      if (!validRoles.includes(role)) {
        throw new ApiError(400, 'Invalid role filter');
      }
      query += ' AND role = ?';
      params.push(role);
    }

    const users = await conn.query(query, params);

    if (users.length === 0) {
      throw new ApiError(404, 'No users found');
    }

    let count = 0;
    for (const user of users) {
      await conn.query(
        'INSERT INTO notifications (user_id, title, content) VALUES (?, ?, ?)',
        [user.id, sanitizedData.title, sanitizedData.content]
      );
      count++;
    }

    await conn.commit();

    return ApiResponse.created(res, {
      count:  count,
      title: sanitizedData.title
    }, `Notification broadcasted to ${count} users successfully`);

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    if (conn) conn.release();
  }
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid notification ID');
  }

  const conn = await getConnection();

  try {
    const notifications = await conn.query('SELECT user_id FROM notifications WHERE id = ? ', [id]);
    if (notifications.length === 0) {
      throw new ApiError(404, 'Notification not found');
    }

    if (userRole !== 'admin' && notifications[0]. user_id !== userId) {
      throw new ApiError(403, 'Access denied to delete this notification');
    }

    await conn.query('DELETE FROM notifications WHERE id = ?', [id]);

    return ApiResponse.noContent(res, 'Notification deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.deleteAllUserNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    await conn.query('DELETE FROM notifications WHERE user_id = ?', [userId]);

    return ApiResponse.noContent(res, 'All notifications deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
