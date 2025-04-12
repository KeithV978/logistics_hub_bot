// const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
// const result = dotenv.config();
// if (result.error) {
//     throw new Error('Error loading .env file');
// }

if (!process.env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not defined in environment variables');
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

module.exports = { bot };

