const { bot } = require('../config/telegram');
const { User, Order, Offer } = require('../models');
const { Markup } = require('telegraf');
const { Op } = require('sequelize');
const { verifyNIN } = require('../services/ninVerification');
const { calculateDistance } = require('../utils/location');
const userController = require('./bot/userController');
const orderController = require('./bot/orderController');

// Middleware to handle user state
bot.use(async (ctx, next) => {
  if (ctx.from) {
    ctx.state.user = await User.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });
  }
  return next();
});

// Start command
bot.command('start', async (ctx) => {
  try {
    if (ctx.state.user) {
      return ctx.reply('Welcome back! Use /help to see available commands.');
    }
    return ctx.reply(
      'Welcome to RiderFinder! Please register as a rider or errander using /register_rider or /register_errander.'
    );
  } catch (error) {
    console.error('Error in start command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Help command
bot.command('help', async (ctx) => {
  const helpMessage = `
Available commands:
- /start - Start the bot
- /help - Show this help message
- /register_rider - Register as a rider
- /register_errander - Register as an errander
- /profile - View your profile
- /create_order - Create a new logistics order
- /create_errand - Create a new errand order
- /my_orders - View your orders
- /my_offers - View your offers
- /toggle_active - Toggle your active status
`;
  return ctx.reply(helpMessage);
});

// User commands
bot.command('profile', userController.handleProfileCommand);
bot.command(['register_rider', 'register_errander'], userController.handleRegistrationCommand);

// Order commands
bot.command('create_order', orderController.handleCreateOrderCommand);
bot.command('create_errand', orderController.handleCreateErrandCommand);
bot.command('my_orders', orderController.handleMyOrdersCommand);

// Handle registration process
bot.on('text', async (ctx) => {
  // Handle registration text inputs
  if (ctx.session?.registration) {
    return userController.handleRegistrationProcess(ctx);
  }
  
  // Handle order instructions
  if (ctx.session?.orderCreation?.step === 'instructions') {
    return orderController.handleOrderInstructions(ctx);
  }
});

// Handle location updates
bot.on('location', async (ctx) => {
  if (ctx.session?.orderCreation) {
    return orderController.handleOrderLocation(ctx);
  }
});

// Handle photo uploads
bot.on('photo', userController.handleRegistrationPhoto);

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  return ctx.reply('An error occurred. Please try again later.', {
    reply_markup: { remove_keyboard: true }
  });
});

module.exports = bot; 