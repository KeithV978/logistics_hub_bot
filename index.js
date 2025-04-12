require('dotenv').config();
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Rider = require('./models/Rider');

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Start command
bot.start(async (ctx) => {
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "I'm a Customer", callback_data: 'register_customer' }],
                [{ text: "I'm a Rider", callback_data: 'register_rider' }]
            ]
        }
    };
    await ctx.reply('Welcome to the Delivery Bot! Please select your role:', keyboard);
});

// Handle callback queries
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    const user = ctx.from;

    if (action === 'register_customer') {
        await registerCustomer(ctx, user);
    } else if (action === 'register_rider') {
        await registerRider(ctx, user);
    }
});

// Register customer
const registerCustomer = async (ctx, user) => {
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
        await ctx.reply('You are registered as a customer! Share your location to place an order.');
    } catch (error) {
        console.error('Error registering customer:', error);
        await ctx.reply('Sorry, there was an error registering you.');
    }
};

// Register rider
const registerRider = async (ctx, user) => {
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
        await ctx.reply('You are registered as a rider! Share your location to start receiving orders.');
    } catch (error) {
        console.error('Error registering rider:', error);
        await ctx.reply('Sorry, there was an error registering you.');
    }
};

// Launch bot
bot.launch();
console.log('Bot is running...');
