const logger = require('./logger');

class CustomError extends Error {
  constructor(message) {
    super(message);
  }
}

class UserNotVerifiedError extends CustomError {
  constructor(message = 'User is not verified') {
    super(message);
    this.name = 'UserNotVerifiedError';
  }
}

class NoRidersFoundError extends CustomError {
  constructor(message = 'No riders found in your area') {
    super(message);
    this.name = 'NoRidersFoundError';
  }
}

class InvalidInputError extends CustomError {
  constructor(message) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

class APIFailureError extends CustomError {
  constructor(message = 'External API call failed') {
    super(message);
    this.name = 'APIFailureError';
  }
}

const errorHandler = (handler) => async (ctx) => {
  try {
    await handler(ctx);
  } catch (error) {
    logger.error(`Error: ${error.name} - ${error.message}`, {
      telegramId: ctx.from.id,
      stack: error.stack,
    });
    let userMessage;
    switch (error.name) {
      case 'UserNotVerifiedError':
        userMessage = 'You need to be verified to perform this action.';
        break;
      case 'NoRidersFoundError':
        userMessage = 'No riders available in your area. Please try again later.';
        break;
      case 'InvalidInputError':
        userMessage = `Invalid input: ${error.message}`;
        break;
      case 'APIFailureError':
        userMessage = 'Service temporarily unavailable. Please try again later.';
        break;
      default:
        userMessage = 'An error occurred. Please try again later.';
    }
    await ctx.reply(userMessage);
  }
};

module.exports = {
  errorHandler,
  CustomError,
  UserNotVerifiedError,
  NoRidersFoundError,
  InvalidInputError,
  APIFailureError
};