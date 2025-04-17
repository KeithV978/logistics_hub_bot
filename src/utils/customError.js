/**
 * Custom error classes for consistent error handling
 */
const logger = require('./logger');

/**
 * Base custom error class
 */
class CustomError extends Error {
  constructor(message, statusCode, metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500; // Default to 500 Internal Server Error
    this.metadata = metadata; // Additional context for debugging
    Error.captureStackTrace(this, this.constructor);

    // Log error
    logger.error(`${this.name}: ${message}`, {
      statusCode: this.statusCode,
      metadata,
      stack: this.stack,
    });
  }
}

/**
 * Error for invalid input data
 */
class InvalidInputError extends CustomError {
  constructor(message = 'Invalid input provided', metadata = {}) {
    super(message, 400, metadata); // 400 Bad Request
  }
}

/**
 * Error for unauthorized access or unverified users
 */
class UserNotVerifiedError extends CustomError {
  constructor(message = 'User not verified or unauthorized', metadata = {}) {
    super(message, 401, metadata); // 401 Unauthorized
  }
}

/**
 * Error for forbidden actions
 */
class ForbiddenError extends CustomError {
  constructor(message = 'Action forbidden', metadata = {}) {
    super(message, 403, metadata); // 403 Forbidden
  }
}

/**
 * Error for resource not found
 */
class NotFoundError extends CustomError {
  constructor(message = 'Resource not found', metadata = {}) {
    super(message, 404, metadata); // 404 Not Found
  }
}

/**
 * Error for database operations
 */
class DatabaseError extends CustomError {
  constructor(message = 'Database operation failed', metadata = {}) {
    super(message, 500, metadata); // 500 Internal Server Error
  }
}

/**
 * Error for external API failures
 */
class ExternalApiError extends CustomError {
  constructor(message = 'External API request failed', metadata = {}) {
    super(message, 502, metadata); // 502 Bad Gateway
  }
}

/**
 * Error for session-related issues
 */
class SessionError extends CustomError {
  constructor(message = 'Session operation failed', metadata = {}) {
    super(message, 400, metadata); // 400 Bad Request
  }
}

/**
 * Error for rate limiting
 */
class RateLimitError extends CustomError {
  constructor(message = 'Too many requests', metadata = {}) {
    super(message, 429, metadata); // 429 Too Many Requests
  }
}

module.exports = {
  CustomError,
  InvalidInputError,
  UserNotVerifiedError,
  ForbiddenError,
  NotFoundError,
  DatabaseError,
  ExternalApiError,
  SessionError,
  RateLimitError,
};