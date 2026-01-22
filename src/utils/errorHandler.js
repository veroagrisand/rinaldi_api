/**
 * Custom Error Class untuk API
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, errors } = err;

  // Default to 500 server error
  if (! statusCode) {
    statusCode = 500;
  }

  // Default message
  if (!message) {
    message = 'Internal Server Error';
  }

  // Log error untuk debugging
  if (statusCode === 500) {
    console.error('Error:', err);
  }

  const response = {
    success: false,
    statusCode,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  res.status(statusCode).json(response);
};

/**
 * Catch Async Errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  errorHandler,
  catchAsync
};
