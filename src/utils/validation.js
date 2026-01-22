const { ApiError } = require('./errorHandler');

/**
 * Validate required fields
 */
function validateRequired(data, fields) {
  const errors = {};
  
  fields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      errors[field] = `${field} is required`;
    }
  });

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }
}

/**
 * Validate email
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Invalid email format');
  }
}

/**
 * Validate enum
 */
function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new ApiError(400, `Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`);
  }
}

/**
 * Validate number range
 */
function validateRange(value, min, max, fieldName) {
  if (value < min || value > max) {
    throw new ApiError(400, `${fieldName} must be between ${min} and ${max}`);
  }
}

/**
 * Validate positive number
 */
function validatePositiveNumber(value, fieldName) {
  if (isNaN(value) || value <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive number`);
  }
}

module.exports = {
  validateRequired,
  validateEmail,
  validateEnum,
  validateRange,
  validatePositiveNumber
};
