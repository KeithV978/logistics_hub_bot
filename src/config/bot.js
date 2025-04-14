const { Telegraf } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const logger = require('../utils/logger');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Configure local session storage
const localSession = new LocalSession({
    database: 'sessions.json',
    property: 'session',
    storage: LocalSession.storageMemory,
    format: {
        serialize: (obj) => JSON.stringify(obj),
        deserialize: (str) => JSON.parse(str),
    },
    state: { }
});

// Set up session middleware
bot.use(localSession.middleware());

// Set up webhook
const setupWebhook = async () => {
    const webhookUrl = `${process.env.WEBHOOK_DOMAIN}${process.env.WEBHOOK_PATH}`;
    try {
        await bot.telegram.setWebhook(webhookUrl);
        logger.info(`Webhook set up successfully at ${webhookUrl}`);
    } catch (error) {
        logger.error('Failed to set up webhook:', error);
        throw error;
    }
};

// Error handling for the bot
bot.catch((err, ctx) => {
    logger.error('Bot error:', err);
    ctx.reply('An error occurred while processing your request. Please try again later.')
        .catch(e => logger.error('Failed to send error message:', e));
});

module.exports = {
    bot,
    setupWebhook
};