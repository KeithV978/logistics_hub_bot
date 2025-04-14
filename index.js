const express = require('express');
const cors = require('cors');
const { bot, setupWebhook } = require('./src/config/bot');
const errorHandler = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Webhook endpoint
app.post(process.env.WEBHOOK_PATH, (req, res) => {
    bot.handleUpdate(req.body, res);
});

// Error handling
app.use(errorHandler);

// Initialize bot and start server
const startServer = async () => {
    try {
        // Set up webhook
        await setupWebhook();

        // Start listening
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });

        // Log bot info
        const botInfo = await bot.telegram.getMe();
        logger.info('Bot info:', botInfo);

        // Launch bot
        bot.launch();

        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();