const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEnum, validatePositiveNumber } = require('../utils/validation');

// Get all users (Admin only)
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const { role, status, search, page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const conn = await getConnection();

  try {
    let query = 'SELECT id, name, username, email, email_verified_at, balance, role, phone, status, created_at, updated_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params. push(role);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (name LIKE ? OR username LIKE ?  OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const totalResult = await conn.query(countQuery, params);
    const total = totalResult[0].total;

    // Add pagination
    query += ' ORDER BY created_at DESC LIMIT ?  OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await conn.query(query, params);

    return ApiResponse.paginate(
      res,
      convertBigInt(users),
      {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit)
      },
      'Users retrieved successfully'
    );

  } finally {
    if (conn) conn.release();
  }
});

// Get user by ID
exports.getUserById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  const conn = await getConnection();

  try {
    const users = await conn.query(
      'SELECT id, name, username, email, email_verified_at, balance, role, phone, status, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.success(res, convertBigInt(users[0]), 'User retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Get current user profile
exports.getProfile = catchAsync(async (req, res, next) => {
  const userId = req.user. id;

  const conn = await getConnection();

  try {
    const users = await conn.query(
      'SELECT id, name, username, email, email_verified_at, balance, role, phone, status, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.success(res, convertBigInt(users[0]), 'Profile retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Update user profile
exports.updateProfile = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { name, phone } = req.body;

  validateRequired(req.body, ['name']);

  const sanitizedData = {
    name:  sanitizeInput(name),
    phone: phone ? sanitizeInput(phone) : null
  };

  const conn = await getConnection();

  try {
    await conn.query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [sanitizedData.name, sanitizedData.phone, userId]
    );

    return ApiResponse. success(res, null, 'Profile updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Change password
exports.changePassword = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { current_password, new_password, confirm_password } = req.body;

  validateRequired(req. body, ['current_password', 'new_password', 'confirm_password']);

  if (new_password. length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters long');
  }

  if (new_password !== confirm_password) {
    throw new ApiError(400, 'New password and confirm password do not match');
  }

  const conn = await getConnection();

  try {
    // Get current password
    const users = await conn.query('SELECT password FROM users WHERE id = ? ', [userId]);

    if (users.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(current_password, users[0]. password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await conn. query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    return ApiResponse. success(res, null, 'Password changed successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Update user role (Admin only)
exports.updateUserRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  validateRequired(req.body, ['role']);

  const validRoles = ['user', 'admin', 'reseller'];
  validateEnum(role, validRoles, 'role');

  const conn = await getConnection();

  try {
    const result = await conn.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.success(res, null, `User role updated to ${role} successfully`);

  } finally {
    if (conn) conn.release();
  }
});

// Update user status (Admin only)
exports.updateUserStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  validateRequired(req.body, ['status']);

  const validStatuses = ['active', 'inactive', 'suspended'];
  validateEnum(status, validStatuses, 'status');

  // Prevent admin from changing their own status
  if (req. user.id === parseInt(id)) {
    throw new ApiError(400, 'You cannot change your own status');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.success(res, null, `User status updated to ${status} successfully`);

  } finally {
    if (conn) conn.release();
  }
});

// Update user balance (Admin only)
exports.updateBalance = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { balance, action } = req.body;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  validateRequired(req.body, ['balance', 'action']);
  validatePositiveNumber(balance, 'balance');

  const validActions = ['add', 'subtract', 'set'];
  validateEnum(action, validActions, 'action');

  const conn = await getConnection();

  try {
    let query;
    if (action === 'add') {
      query = 'UPDATE users SET balance = balance + ? WHERE id = ?';
    } else if (action === 'subtract') {
      query = 'UPDATE users SET balance = GREATEST(balance - ?, 0) WHERE id = ?';
    } else if (action === 'set') {
      query = 'UPDATE users SET balance = ? WHERE id = ? ';
    }

    const result = await conn.query(query, [balance, id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'User not found');
    }

    // Get updated balance
    const users = await conn.query('SELECT balance FROM users WHERE id = ?', [id]);

    return ApiResponse.success(res, {
      new_balance: Number(users[0].balance)
    }, 'Balance updated successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Delete user (Admin only)
exports.deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  // Prevent admin from deleting themselves
  if (req.user. id === parseInt(id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const conn = await getConnection();

  try {
    const result = await conn.query('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.noContent(res, 'User deleted successfully');

  } finally {
    if (conn) conn.release();
  }
});
