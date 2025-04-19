const express = require('express');
const { bot, webhookConfig } = require('./src/config/telegram');
const sequelize = require('./src/config/database');
const botController = require('./src/controllers/botController');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Webhook endpoint
app.post(`/${webhookConfig.hookPath}`, (req, res) => {
  // if (req.headers['x-telegram-bot-api-secret-token'] !== webhookConfig.secretToken) {
  //   return res.sendStatus(403);
  // }
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Application error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync database
    await sequelize.sync();
    console.log('Database synced successfully');

    // Set webhook in production, use polling in development
    if (process.env.NODE_ENV === 'production') {
      await bot.telegram.setWebhook(
        `${webhookConfig.domain}/${webhookConfig.hookPath}`,
        {
          secret_token: webhookConfig.secretToken
        }
      );
      console.log('Webhook set successfully');
    } else {
      await bot.launch();
      console.log('Bot started in polling mode');

      // Enable graceful stop
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    }

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 