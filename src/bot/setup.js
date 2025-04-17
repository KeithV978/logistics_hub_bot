/**
 * Bot initialization and webhook setup
 */
const { Telegraf } = require('telegraf');
const express = require('express');
const webhookRouter = require('../webhooks');
const logger = require('../utils/logger');
const errorMiddleware = require('../middleware/error.middleware');

/**
 * Initialize bot and setup webhook
 * @returns {Object} - { bot: Telegraf, app: Express }
 */
const setupBot = () => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!botToken || !webhookUrl) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN or WEBHOOK_URL environment variables');
    }

    // Initialize Telegraf bot
    const bot = new Telegraf(botToken);
    logger.info('Telegraf bot initialized');

    // Initialize Express app
    const app = express();
    app.use(express.json());

    // Mount webhook router
    app.use('/webhook', webhookRouter);

    // Global error middleware
    app.use(errorMiddleware);

    // Setup webhook
    bot.telegram.setWebhook(`${webhookUrl}/webhook`).then(() => {
      logger.info('Webhook set successfully', { webhookUrl });
    }).catch(error => {
      logger.error('Failed to set webhook', { error: error.message });
      throw error;
    });

    // Handle webhook errors
    bot.catch((error, ctx) => {
      logger.error('Bot error', { error: error.message, update: ctx.update });
      if (ctx.update && ctx.update.message) {
        ctx.reply('An error occurred. Please try again later.');
      }
    });

    return { bot, app };
  } catch (error) {
    logger.error('Bot setup failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  setupBot,
};