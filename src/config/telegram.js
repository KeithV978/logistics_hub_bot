/**
 * Telegram Bot API configuration
 */
const logger = require('../utils/logger');

/**
 * Configure Telegram Bot API settings
 * @returns {Object} - Telegram configuration object
 */
const configureTelegram = () => {
  try {
    const botToken = process.env.BOT_TOKEN;
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }
    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL environment variable is not set');
    }

    logger.info('Configuring Telegram Bot API');

    const config = {
      botToken,
      webhook: {
        url: webhookUrl,
        path: '/webhook',
        maxConnections: 40, // Maximum simultaneous connections
      },
      apiTimeout: 5000, // 5 seconds timeout for Telegram API requests
    };

    logger.info('Telegram configuration loaded successfully');
    return config;
  } catch (error) {
    logger.error('Telegram configuration failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  configureTelegram,
};