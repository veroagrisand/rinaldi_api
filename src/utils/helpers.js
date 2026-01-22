/**
 * Convert BigInt values to Number
 */
function convertBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigInt(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'bigint') {
          converted[key] = Number(obj[key]);
        } else if (typeof obj[key] === 'object') {
          converted[key] = convertBigInt(obj[key]);
        } else {
          converted[key] = obj[key];
        }
      }
    }
    return converted;
  }
  
  return obj;
}

/**
 * Generate random token
 */
function generateToken(length = 32) {
  return require('crypto').randomBytes(length).toString('hex');
}

/**
 * Generate unique invoice number
 */
function generateInvoice() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp}-${random}`;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize input
 */
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.trim();
  }
  return input;
}

module.exports = {
  convertBigInt,
  generateToken,
  generateInvoice,
  isValidEmail,
  sanitizeInput
};
