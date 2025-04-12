require('dotenv').config();
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const Rider = require('./models/Rider');
const Order = require('./models/Order');

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Set webhook
const webhookUrl = `${process.env.WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`;
bot.telegram.setWebhook(webhookUrl);

// Start Express server to handle webhook requests
const app = express();
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

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

// Register rider
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    const user = ctx.from;

    if (action === 'register_rider') {
        await ctx.reply('Please provide your bank details in the format: BankName,AccountNumber');
        bot.on('text', async (ctx) => {
            const [bankName, accountNumber] = ctx.message.text.split(',');
            if (!bankName || !accountNumber) {
                return ctx.reply('Invalid format. Please provide your bank details in the format: BankName,AccountNumber');
            }

            try {
                const rider = await Rider.findOneAndUpdate(
                    { telegramId: user.id },
                    {
                        username: user.username,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        bankDetails: { bankName, accountNumber },
                        location: { type: 'Point', coordinates: [0, 0] }, // Default location
                        isAvailable: true
                    },
                    { upsert: true, new: true }
                );
                await ctx.reply('You are registered as a rider! Share your location to start receiving orders.');
            } catch (error) {
                console.error('Error registering rider:', error);
                await ctx.reply('Sorry, there was an error registering you.');
            }
        });
    }
});

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

// Notify nearby riders and create temporary group
bot.command('order', async (ctx) => {
    const user = ctx.from;
    const pickupLocation = { type: 'Point', coordinates: [0, 0] }; // Replace with actual location
    const deliveryLocation = { type: 'Point', coordinates: [1, 1] }; // Replace with actual location

    try {
        const nearbyRiders = await Rider.find({
            location: {
                $near: {
                    $geometry: pickupLocation,
                    $maxDistance: 5000 // 5 km radius
                }
            },
            isAvailable: true
        });

        if (nearbyRiders.length === 0) {
            return ctx.reply('No riders available nearby.');
        }

        const order = await Order.create({
            customer: user.id,
            pickupLocation,
            deliveryLocation
        });

        for (const rider of nearbyRiders) {
            await bot.telegram.sendMessage(rider.telegramId, `New order available! Use /accept_${order._id} to accept.`);
        }

        bot.command(`accept_${order._id}`, async (ctx) => {
            const rider = await Rider.findOne({ telegramId: ctx.from.id });
            if (!rider) {
                return ctx.reply('You are not registered as a rider.');
            }

            order.rider = rider._id;
            order.status = 'accepted';
            await order.save();

            const group = await bot.telegram.createChat({
                title: `Order ${order._id}`,
                members: [user.id, rider.telegramId]
            });

            ctx.reply(`Order accepted! Temporary group created: ${group.title}`);
        });
    } catch (error) {
        console.error('Error creating order:', error);
        ctx.reply('Sorry, there was an error creating the order.');
    }
});