const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const { initDatabase } = require('./src/models/database');
const botController = require('./src/controllers/botController');

dotenv.config();

const app = express();
const token = process.env.BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_DOMAIN;
const bot = new TelegramBot(token, { polling: false });

app.use(express.json());

// Set webhook
bot.setWebHook(`${webhookUrl}/bot${token}`);

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Initialize database
initDatabase();

// Register bot handlers
botController(bot);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});