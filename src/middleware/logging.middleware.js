/**
 * Logging middleware for Telegraf bot
 */
const logger = require('../utils/logger');

/**
 * Logging middleware: Log incoming Telegram updates
 * @param {Object} ctx - Telegraf context
 * @param {Function} next - Next middleware
 */
async function loggingMiddleware(ctx, next) {
  try {
    const update = ctx.update;
    const telegramId = ctx.from?.id;
    const updateType = Object.keys(update)[0] || 'unknown';
    const message = 
      update.message?.text ||
      update.callback_query?.data ||
      update.inline_query?.query ||
      'Unknown content';

    // Extract additional context
    const chatId = ctx.chat?.id;
    const timestamp = new Date().toISOString();
    const isCommand = update.message?.text?.startsWith('/') || false;

    // Log incoming update
    logger.info('Received Telegram update', {
      telegramId,
      chatId,
      updateType,
      message: message.substring(0, 100), // Limit length to avoid log bloat
      isCommand,
      timestamp,
    });

    // Proceed to next middleware
    await next();

    // Log successful processing
    logger.info('Update processed successfully', {
      telegramId,
      chatId,
      updateType,
      message: message.substring(0, 100),
    });
  } catch (error) {
    const telegramId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    logger.error('Logging middleware error', {
      telegramId,
      chatId,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw to allow errorHandlerMiddleware to handle
  }
}

module.exports = loggingMiddleware;