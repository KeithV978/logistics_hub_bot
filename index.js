/**
 * Entry point for the Node.js Telegram bot application
 */
require('dotenv').config();
const logger = require('./src/utils/logger');
const db = require('./src/config/database');
const { configureTelegram } = require('./src/config/telegram');
// const { configureExternalApis } = require('./src/config/external-apis');
const { setupBot } = require('./src/bot/setup');
const { registerCommands } = require('./src/bot/commands');
const errorMiddleware = require('./src/middleware/error.middleware');
const authMiddleware = require('./src/middleware/auth.middleware');
const validationMiddleware = require('./src/middleware/validation.middleware');
const loggingMiddleware = require('./src/middleware/logging.middleware');
 
/**
 * Start the application
 */
async function startApplication() {
  try {
    logger.info('Starting application');

    // Initialize PostgreSQL database
    const pool = await db.sequelize.authenticate();
    logger.info('Database initialized successfully');

    // Load configurations
    const telegramConfig = configureTelegram();
    logger.info('Telegram configuration loaded');

    // const apiConfig = configureExternalApis();
    // logger.info('External APIs configuration loaded');

    // Setup bot and Express app
    const { bot, app } = set
    upBot();
    logger.info('Bot and Express app initialized');

    // Apply Telegraf middleware
    bot.use(loggingMiddleware);
    // bot.use(validationMiddleware);
    // bot.use(authMiddleware);
    bot.use(errorMiddleware);
    logger.info('Telegraf middleware applied');

    // Register Telegram commands
    registerCommands(bot);
    logger.info('Telegram commands registered');

    // Start Express server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  }
}

// Run the application
startApplication();