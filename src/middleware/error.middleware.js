/**
 * Error handling middleware for Express
 */
const logger = require('../utils/logger');
const { CustomError, UserNotVerifiedError, NoRidersFoundError, InvalidInputError, APIFailureError } = require('../utils/error-handler');

/**
 * Global error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorMiddleware = async (error, req, res, next) => {
  const telegramId = req.body?.message?.from?.id || req.body?.callback_query?.from?.id || 'unknown';
  
  // Log the error with context
  logger.error(`Error: ${error.name} - ${error.message}`, {
    telegramId,
    stack: error.stack,
    body: req.body,
  });

  // Determine user-friendly message
  let userMessage;
  let statusCode = 500;

  switch (error.name) {
    case 'UserNotVerifiedError':
      userMessage = 'You need to be verified to perform this action.';
      statusCode = 403;
      break;
    case 'NoRidersFoundError':
      userMessage = 'No riders available in your area. Please try again later.';
      statusCode = 404;
      break;
    case 'InvalidInputError':
      userMessage = `Invalid input: ${error.message}`;
      statusCode = 400;
      break;
    case 'APIFailureError':
      userMessage = 'Service temporarily unavailable. Please try again later.';
      statusCode = 503;
      break;
    case 'NotFoundError':
      userMessage = 'Resource not found.';
      statusCode = 404;
      break;
    case 'AuthError':
      userMessage = 'Unauthorized access.';
      statusCode = 401;
      break;
    default:
      userMessage = 'An error occurred. Please try again later.';
      statusCode = 500;
  }

  // Attempt to send Telegram message if ctx is available
  if (req.ctx && typeof req.ctx.reply === 'function') {
    try {
      await req.ctx.reply(userMessage);
    } catch (replyError) {
      logger.error(`Failed to send Telegram error message: ${replyError.message}`, { telegramId });
    }
  }

  // Send HTTP response
  res.status(statusCode).json({ error: userMessage });
};

module.exports = errorMiddleware;