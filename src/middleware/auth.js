const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/errorHandler');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader. startsWith('Bearer ')) {
      throw new ApiError(401, 'Access denied. No token provided or invalid format.');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true
    });
    
    req.user = decoded; 
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else if (error.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Invalid token'));
    } else {
      next(new ApiError(401, 'Authentication failed'));
    }
  }
};

module.exports = authMiddleware;
