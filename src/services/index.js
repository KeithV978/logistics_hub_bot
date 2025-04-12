const TelegramBot = require('node-telegram-bot-api');
const Customer = require('../models/Customer');
const Rider = require('../models/Rider');
const Order = require('../models/Order');

let bot = null;

const initBot = () => {
    if (bot) return bot;

    const options = {
        webHook: {
            port: process.env.PORT
        }
    };

    bot = new TelegramBot(process.env.BOT_TOKEN, options);
    
    // Set webhook
    const url = process.env.WEBHOOK_URL;
    bot.setWebHook(`${url}/webhook/${process.env.BOT_TOKEN}`);

    // Register command handlers
    registerCommands();

    return bot;
};

const registerCommands = () => {
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const keyboard = {
            inline_keyboard: [
                [{ text: "I'm a Customer", callback_data: 'register_customer' }],
                [{ text: "I'm a Rider", callback_data: 'register_rider' }]
            ]
        };
        
        bot.sendMessage(chatId, 'Welcome to Delivery Bot! Please select your role:', {
            reply_markup: keyboard
        });
    });

    bot.on('callback_query', handleCallbackQuery);
};

const handleCallbackQuery = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;

    switch (action) {
        case 'register_customer':
            await registerCustomer(chatId, callbackQuery.from);
            break;
        case 'register_rider':
            await registerRider(chatId, callbackQuery.from);
            break;
        // Add more cases for other actions
    }
};

const registerCustomer = async (chatId, user) => {
    try {
        const customer = await Customer.findOneAndUpdate(
            { telegramId: user.id },
            {
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name
            },
            { upsert: true, new: true }
        );

        bot.sendMessage(chatId, 'You are registered as a customer! Share your location to place an order.');
    } catch (error) {
        console.error('Error registering customer:', error);
        bot.sendMessage(chatId, 'Sorry, there was an error registering you.');
    }
};

const registerRider = async (chatId, user) => {
    try {
        const rider = await Rider.findOneAndUpdate(
            { telegramId: user.id },
            {
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name
            },
            { upsert: true, new: true }
        );

        bot.sendMessage(chatId, 'You are registered as a rider! Share your location to start receiving orders.');
    } catch (error) {
        console.error('Error registering rider:', error);
        bot.sendMessage(chatId, 'Sorry, there was an error registering you.');
    }
};

module.exports = { initBot, bot };