const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  webhookReply: true,
});

// Webhook configuration
const webhookConfig = {
  domain: process.env.WEBHOOK_URL,
  hookPath: '/webhook',
  secretToken: process.env.WEBHOOK_SECRET,
};

module.exports = {
  bot,
  webhookConfig,
};
