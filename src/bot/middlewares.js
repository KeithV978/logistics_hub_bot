/**
 * Telegraf bot middlewares for authentication, validation, and logging
 */
const logger = require('../utils/logger');
const constants = require('../utils/constants');
const { InvalidInputError, UserNotVerifiedError } = require('../utils/error-handler');

/**
 * Logging middleware
 * @param {Object} ctx - Telegraf context
 * @param {Function} next - Next middleware
 */
const loggingMiddleware = async (ctx, next) => {
  const start = Date.now();
  const updateId = ctx.update?.update_id || 'unknown';
  logger.info('Processing Telegram update', {
    updateId,
    type: ctx.updateType,
    from: ctx.from?.id,
  });

  try {
    await next();
    logger.info('Update processed successfully', {
      updateId,
      duration: Date.now() - start,
    });
  } catch (error) {
    logger.error('Update processing failed', {
      updateId,
      error: error.message,
      duration: Date.now() - start,
    });
    throw error;
  }
};

/**
 * Authentication middleware
 * @param {Object} ctx - Telegraf context
 * @param {Function} next - Next middleware
 */
const authMiddleware = async (ctx, next) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      throw new UserNotVerifiedError('No user ID provided');
    }

    const user = await require('../utils/helpers').getUser(telegramId);
    ctx.user = user || { role: constants.ROLES.CUSTOMER };

    // Restrict certain commands to authenticated roles
    const command = ctx.message?.text?.split(' ')[0]?.toLowerCase();
    const restrictedCommands = [
      constants.TELEGRAM_COMMANDS.OFFER,
      constants.TELEGRAM_COMMANDS.PAYMENT_RECEIVED,
      constants.TELEGRAM_COMMANDS.PROFILE,
    ];

    if (command && restrictedCommands.includes(command) && !user) {
      throw new UserNotVerifiedError('You must be registered as a rider or errander to use this command');
    }

    await next();
  } catch (error) {
    throw error;
  }
};

/**
 * Validation middleware for Telegram updates
 * @param {Object} ctx - Telegraf context
 * @param {Function} next - Next middleware
 */
const validationMiddleware = async (ctx, next) => {
  try {
    if (!ctx.update) {
      throw new InvalidInputError('Invalid Telegram update');
    }

    if (ctx.message) {
      if (!ctx.message.from?.id) {
        throw new InvalidInputError('Missing user ID in message');
      }
      if (ctx.message.text && ctx.message.text.length > 1000) {
        throw new InvalidInputError('Message text too long');
      }
    }

    if (ctx.callbackQuery && !ctx.callbackQuery.data) {
      throw new InvalidInputError('Missing callback query data');
    }

    await next();
  } catch (error) {
    throw error;
  }
};

/**
 * Error handling middleware
 * @param {Object} ctx - Telegraf context
 * @param {Function} next - Next middleware
 */
const errorHandlerMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    logger.error('Middleware error', {
      error: error.message,
      updateId: ctx.update?.update_id,
      from: ctx.from?.id,
    });

    const message = error instanceof InvalidInputError
      ? error.message
      : 'An error occurred. Please try again later.';

    if (ctx.update?.message || ctx.update?.callback_query) {
      await ctx.reply(message);
    }

    // Re-throw error for bot.catch to handle
    throw error;
  }
};

module.exports = {
  loggingMiddleware,
  authMiddleware,
  validationMiddleware,
  errorHandlerMiddleware,
};