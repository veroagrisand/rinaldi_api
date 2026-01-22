const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, generateToken, isValidEmail, sanitizeInput } = require('../utils/helpers');
const { validateRequired, validateEmail, validateEnum } = require('../utils/validation');
require('dotenv').config();

// Register User
exports.register = catchAsync(async (req, res, next) => {
  const { name, username, email, password, role, phone } = req.body;

  // Validate required fields
  validateRequired(req.body, ['name', 'username', 'email', 'password']);
  
  // Sanitize inputs
  const sanitizedData = {
    name: sanitizeInput(name),
    username: sanitizeInput(username),
    email: sanitizeInput(email).toLowerCase(),
    password: password,
    phone: phone ?  sanitizeInput(phone) : null
  };

  validateEmail(sanitizedData.email);

  // Validate password length
  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long');
  }

  // Validate role
  const validRoles = ['user', 'admin', 'reseller'];
  const userRole = role || 'user';
  validateEnum(userRole, validRoles, 'role');

  const conn = await getConnection();

  try {
    // Check if user already exists
    const existingUser = await conn.query(
      'SELECT id, email, username FROM users WHERE email = ?  OR username = ?',
      [sanitizedData.email, sanitizedData.username]
    );

    if (existingUser.length > 0) {
      const user = existingUser[0];
      if (user.email === sanitizedData.email) {
        throw new ApiError(409, 'User with this email already exists');
      }
      if (user.username === sanitizedData.username) {
        throw new ApiError(409, 'User with this username already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await conn.query(
      `INSERT INTO users (name, username, email, password, role, phone, balance, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizedData.name,
        sanitizedData.username,
        sanitizedData.email,
        hashedPassword,
        userRole,
        sanitizedData. phone,
        0,
        'active'
      ]
    );

    const userId = Number(result.insertId);

    return ApiResponse.created(res, {
      id: userId,
      name: sanitizedData.name,
      username: sanitizedData.username,
      email: sanitizedData.email,
      role: userRole,
      phone: sanitizedData. phone,
      balance: 0,
      status: 'active'
    }, 'User registered successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Login User
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, remember } = req.body;

  // Validate required fields
  validateRequired(req.body, ['email', 'password']);

  // Sanitize inputs
  const sanitizedEmail = sanitizeInput(email).toLowerCase();

  // Validate email format
  validateEmail(sanitizedEmail);

  const conn = await getConnection();

  try {
    // Find user
    const users = await conn.query(
      'SELECT * FROM users WHERE email = ?',
      [sanitizedEmail]
    );

    if (users.length === 0) {
      throw new ApiError(401, 'Invalid email or password');
    }

    let user = convertBigInt(users[0]);

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Check if user status is active
    if (user.status !== 'active') {
      throw new ApiError(403, `Your account is ${user.status}. Please contact admin.`);
    }

    // Generate remember token if remember me is checked
    let rememberToken = null;
    if (remember) {
      rememberToken = generateToken();
      await conn.query(
        'UPDATE users SET remember_token = ?  WHERE id = ?',
        [rememberToken, user.id]
      );
    }

    // Generate JWT token WITHOUT EXPIRATION
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      },
      process.env.JWT_SECRET
    );

    // Remove sensitive data
    delete user.password;
    delete user.remember_token;

    return ApiResponse.success(res, {
      token,
      remember_token: rememberToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
        balance: user.balance,
        status: user.status,
        email_verified_at: user.email_verified_at
      }
    }, 'Login successful');

  } finally {
    if (conn) conn.release();
  }
});

// Logout User
exports.logout = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    await conn.query(
      'UPDATE users SET remember_token = NULL WHERE id = ?',
      [userId]
    );

    return ApiResponse.success(res, null, 'Logged out successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Verify Email
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    // Check if already verified
    const users = await conn.query(
      'SELECT email_verified_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    if (users[0]. email_verified_at) {
      throw new ApiError(400, 'Email already verified');
    }

    await conn.query(
      'UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ? ',
      [userId]
    );

    return ApiResponse.success(res, null, 'Email verified successfully');

  } finally {
    if (conn) conn.release();
  }
});

// Get current user info
exports.me = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const conn = await getConnection();

  try {
    const users = await conn.query(
      `SELECT id, name, username, email, email_verified_at, balance, role, phone, status, created_at, updated_at 
       FROM users WHERE id = ? `,
      [userId]
    );

    if (users.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    return ApiResponse.success(res, convertBigInt(users[0]), 'User data retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});
