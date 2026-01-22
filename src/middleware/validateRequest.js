const { ApiError } = require('../utils/errorHandler');

const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = {};
      error.details.forEach(detail => {
        errors[detail.path[0]] = detail.message;
      });
      
      return next(new ApiError(400, 'Validation failed', errors));
    }
    
    next();
  };
};
module.exports = { validateBody };
