// const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
//const result = dotenv.config();
//if (result.error) {
    //throw new Error('Error loading .env file');
// }

if (!process.env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not defined in environment variables');
}

// Single bot instance
let bot = null;

const initBot = () => {
    if (bot) return bot;

    const options = {
        polling: process.env.NODE_ENV !== 'production' ? {
            interval: 1000,
            autoStart: false  // Important: We'll start manually
        } : false,
        webHook: process.env.NODE_ENV === 'production' ? {
            port: process.env.PORT || 443,
            host: '0.0.0.0'
        } : false
    };

    bot = new TelegramBot(process.env.BOT_TOKEN, options);
    return bot;
};

module.exports = { initBot };

