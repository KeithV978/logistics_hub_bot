require('dotenv').config();
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Rider = require('./models/Rider');

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
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
        // Example coordinates (replace with actual location sharing logic)
        const defaultCoordinates = [0, 0]; // Longitude, Latitude

        const rider = await Rider.findOneAndUpdate(
            { telegramId: user.id },
            {
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                location: {
                    type: 'Point',
                    coordinates: defaultCoordinates // Ensure valid coordinates are set
                },
                isAvailable: true
            },
            { upsert: true, new: true }
        );

        await ctx.reply('You are registered as a rider! Share your location to start receiving orders.');
    } catch (error) {
        console.error('Error registering rider:', error);
        await ctx.reply('Sorry, there was an error registering you.');
    }
};

// Handle location sharing
bot.on('location', async (ctx) => {
    const user = ctx.from;
    const location = ctx.message.location;

    if (!location) {
        return ctx.reply('Please share a valid location.');
    }

    try {
        const rider = await Rider.findOneAndUpdate(
            { telegramId: user.id },
            {
                location: {
                    type: 'Point',
                    coordinates: [location.longitude, location.latitude]
                }
            },
            { new: true }
        );

        await ctx.reply('Your location has been updated successfully!');
    } catch (error) {
        console.error('Error updating location:', error);
        await ctx.reply('Sorry, there was an error updating your location.');
    }
});

// Launch bot
bot.launch();
console.log('Bot is running...');
