const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { bot, webhookConfig } = require('./src/config/telegram');
const sequelize = require('./src/config/database');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Webhook endpoint
app.use(webhookConfig.hookPath, express.json(), (req, res, next) => {
  if (req.headers['x-telegram-bot-api-secret-token'] !== webhookConfig.secretToken) {
    return res.sendStatus(401);
  }
  next();
}, bot.webhookCallback(webhookConfig.hookPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync database models
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database models synchronized.');

    // Set webhook
    await bot.telegram.setWebhook(`${webhookConfig.domain}${webhookConfig.hookPath}`);
    console.log('Webhook set successfully.');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
