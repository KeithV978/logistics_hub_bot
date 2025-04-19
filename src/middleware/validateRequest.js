const { ValidationError } = require('../utils/errors');

/**
 * Middleware to validate request data using a schema
 * @param {Object} schema - Joi schema or custom validation function
 * @param {String} property - Request property to validate (body, query, params)
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      // If schema is a function, use it directly
      if (typeof schema === 'function') {
        schema(req[property], req);
        return next();
      }
      
      // If schema is a Joi schema
      if (schema.validate) {
        const { error } = schema.validate(req[property], {
          abortEarly: false,
          stripUnknown: true
        });
        
        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));
          
          throw new ValidationError('Validation failed', errors);
        }
        
        // Replace request data with validated data
        req[property] = error.value;
        return next();
      }
      
      // If schema is not recognized
      throw new Error('Invalid validation schema');
    } catch (error) {
      next(error);
    }
  };
};

module.exports = validateRequest; 