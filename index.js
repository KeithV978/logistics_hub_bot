require('dotenv').config(); // Load environment variables
const { Telegraf } = require('telegraf'); // Import Telegraf
const express = require('express'); // Import Express

// Initialize Telegraf bot with your token
const token = process.env.BOT_TOKEN;
const bot = new Telegraf(token);

// Initialize Express app
const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.use(bot.webhookCallback('/webhook')); // Handle Telegram updates via webhook

// Set webhook (optional, for production)
const webhookUrl = process.env.WEBHOOK_DOMAIN;
bot.telegram.setWebhook(`${webhookUrl}/webhook`)
  .then(() => console.log('Webhook set successfully'))
  .catch(err => console.error('Webhook setup failed:', err));

// Define bot commands
bot.start((ctx) => {
  // Reply to /start command
  ctx.reply('Welcome to the bot! Use /help to see available commands.');
});

bot.command('help', (ctx) => {
  // Reply to /help command
  ctx.reply('Available commands:\n/start - Start the bot\n/help - Show this message');
});

bot.on('text', (ctx) => {
  // Reply to any text message
  ctx.reply(`You said: ${ctx.message.text}`);
});

// Start the Express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});