const { ApiError } = require('../utils/errorHandler');


const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Unauthorized.  Please login first.');
      }

      const userRole = req.user.role;

      if (!allowedRoles. includes(userRole)) {
        throw new ApiError(
          403, 
          `Access denied. Required role: ${allowedRoles. join(' or ')}. Your role: ${userRole}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

const isAdmin = checkRole('admin');
const isReseller = checkRole('reseller');
const isUser = checkRole('user');
const isAdminOrReseller = checkRole('admin', 'reseller');

module.exports = {
  checkRole,
  isAdmin,
  isReseller,
  isUser,
  isAdminOrReseller
};
