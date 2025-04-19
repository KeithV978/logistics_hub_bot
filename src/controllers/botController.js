const { bot } = require('../config/telegram');
const { User, Order, Offer } = require('../models');
const { Markup } = require('telegraf');
const { Op } = require('sequelize');
const { verifyNIN } = require('../services/ninVerification');
const { calculateDistance } = require('../utils/location');
const userController = require('./bot/userController');
const orderController = require('./bot/orderController');

// Helper function to delete previous message and send new one
async function sendMessage(ctx, text, extra = {}) {
  try {
    // Delete previous bot message if exists
    if (ctx.session?.lastBotMessageId) {
      await ctx.deleteMessage(ctx.session.lastBotMessageId).catch(() => {});
    }
    // Send new message and store its ID
    const message = await ctx.reply(text, extra);
    ctx.session.lastBotMessageId = message.message_id;
    return message;
  } catch (error) {
    console.error('Error in sendMessage:', error);
  }
}

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
      return sendMessage(ctx, 'Welcome back! Use /help to see available commands.', {
        reply_markup: { remove_keyboard: true }
      });
    }

    return sendMessage(ctx, 
      'Welcome to RiderFinder! Please select your role:', {
        reply_markup: {
          keyboard: [
            ['👤 Register as Customer'],
            ['🏍️ Register as Rider'],
            ['🛍️ Register as Errander']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  } catch (error) {
    console.error('Error in start command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

// Handle role selection
bot.hears(['👤 Register as Customer', '🏍️ Register as Rider', '🛍️ Register as Errander'], async (ctx) => {
  try {
    if (ctx.state.user) {
      return sendMessage(ctx, 'You are already registered!', {
        reply_markup: { remove_keyboard: true }
      });
    }

    const text = ctx.message.text;
    let role;

    switch (text) {
      case '👤 Register as Customer':
        role = 'customer';
        break;
      case '🏍️ Register as Rider':
        role = 'rider';
        break;
      case '🛍️ Register as Errander':
        role = 'errander';
        break;
    }

    ctx.session = {
      registration: {
        telegramId: ctx.from.id.toString(),
        role,
        step: 'fullName'
      }
    };

    // Try to delete user's selection message
    try {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    } catch (error) {
      console.log('Could not delete user message');
    }

    return sendMessage(ctx, 'Please enter your full name:', {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error handling role selection:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again with /start', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

// Help command
bot.command('help', async (ctx) => {
  const helpMessage = `
Available commands:
- /start - Start the bot
- /help - Show this help message
- /profile - View your profile
- /create_order - Create a new logistics order
- /create_errand - Create a new errand order
- /my_orders - View your orders
- /my_offers - View your offers
- /toggle_active - Toggle your active status
`;
  return sendMessage(ctx, helpMessage);
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
  return sendMessage(ctx, 'An error occurred. Please try again later.', {
    reply_markup: { remove_keyboard: true }
  });
});

module.exports = bot; 