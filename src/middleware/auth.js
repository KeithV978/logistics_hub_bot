const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { User } = require('../db/models');

/**
 * Middleware to authenticate users
 * @returns {Function} Express middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AuthenticationError('No token provided');
    }
    
    // Verify token
    // This is a placeholder - implement your actual token verification logic
    const decoded = { telegramId: '123456789' }; // Replace with actual token verification
    
    // Find user
    const user = await User.findOne({ where: { telegramId: decoded.telegramId } });
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to authorize users based on roles
 * @param {String[]} roles - Allowed roles
 * @returns {Function} Express middleware function
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }
      
      if (roles.length && !roles.includes(req.user.role)) {
        throw new AuthorizationError(`User role ${req.user.role} is not authorized to access this route`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user is the owner of a resource
 * @param {Function} getResourceUserId - Function to get the user ID from the resource
 * @returns {Function} Express middleware function
 */
const isResourceOwner = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }
      
      const resourceUserId = await getResourceUserId(req);
      
      if (resourceUserId !== req.user.telegramId) {
        throw new AuthorizationError('You are not authorized to access this resource');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  isResourceOwner
}; 