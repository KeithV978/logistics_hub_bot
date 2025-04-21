const {Scenes, Telegraf, session } = require('telegraf');
require('dotenv').config();

// Initialize bot with webhook reply enabled
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  webhookReply: true,
});

// Configure session middleware with memory storage for development
// In production, you should use Redis or another persistent store
bot.use(session());

 // Set up the stage with the wizard
 const stage = new Scenes.Stage();
 bot.use(stage.middleware());

// Webhook configuration
const webhookConfig = {
  domain: process.env.WEBHOOK_URL,
  hookPath: 'webhook',
  secretToken: process.env.WEBHOOK_SECRET,
};

// Error handling middleware
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('An error occurred. Please try again later.').catch(console.error);
});

module.exports = {
  bot,
  webhookConfig,
};
