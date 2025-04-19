const { DatabaseError, ValidationError, ConflictError } = require('./errors');

/**
 * Handle Sequelize errors
 * @param {Error} error - The error object
 * @returns {Error} A custom error object
 */
const handleSequelizeError = (error) => {
  // Handle validation errors
  if (error.name === 'SequelizeValidationError') {
    const errors = error.errors.map(err => ({
      field: err.path,
      message: err.message
    }));
    return new ValidationError('Validation failed', errors);
  }
  
  // Handle unique constraint errors
  if (error.name === 'SequelizeUniqueConstraintError') {
    const errors = error.errors.map(err => ({
      field: err.path,
      message: `${err.path} already exists`
    }));
    return new ConflictError('Resource already exists', errors);
  }
  
  // Handle foreign key constraint errors
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new ValidationError(`Referenced ${error.fields.join(', ')} does not exist`);
  }
  
  // Handle other Sequelize errors
  if (error.name === 'SequelizeDatabaseError') {
    return new DatabaseError('Database operation failed');
  }
  
  // Return the original error if it's not a Sequelize error
  return error;
};

/**
 * Wrap a database operation with error handling
 * @param {Function} operation - The database operation to execute
 * @returns {Promise} A promise that resolves to the operation result
 */
const withErrorHandling = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw handleSequelizeError(error);
  }
};

module.exports = {
  handleSequelizeError,
  withErrorHandling
}; 