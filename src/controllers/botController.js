const { bot } = require('../config/telegram');
const { User, Order, Offer } = require('../models');
const { Markup } = require('telegraf');
const { Op } = require('sequelize');
const { verifyNIN } = require('../services/ninVerification');
const { calculateDistance } = require('../utils/location');
const userController = require('./bot/userController');
const orderController = require('./bot/orderController');
const userGreeting =require('../utils/Greeting')
const { sendMessage } = require('../utils/sendMessage'); 

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
  // Delete previous bot message if exists
  if (ctx.session?.lastBotMessageId) {
    await ctx.deleteMessage(ctx.session.lastBotMessageId).catch(() => {});
  }

  try {
    if (ctx.state.user) {
      return sendMessage(ctx, 'Welcome back! Use /help to see available commands.', {
        reply_markup: { remove_keyboard: true }
      });
    }

    return sendMessage(ctx, 
      `Welcome to Logistics Hub \n ${ctx.from.first_name !== ""? userGreeting(ctx.from.first_name) : userGreeting(ctx.from.username)}! \nSelect one of the following options to proceed `, {
        reply_markup: {
          inline_keyboard: [
            [{text:'Create a Delivery', callback_data: 'delivery_create'},{text:'🏍️ My Deliveries', callback_data: 'delivery'}],
            [{text:'Create an Errand', callback_data: 'errand_create'},{text:'🛍️ My Errands', callback_data: 'errand'}],
            [{text:'📝 Rider/Errander Signup', callback_data: 'signup'}],
            // [{text:'📝 Errand Runner Signup', callback_data: 'errander'}],
            // [{text:'👤 Profile', callback_data: 'profile'}],
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

// Handle callback queries
// bot.action(/delivery_(.+)/, (ctx) => {
//   const command = ctx.match[1];
//   // Execute the corresponding command 
//   switch (command) {
//     case 'create':
//       return orderController.handleCreateOrderCommand(ctx); 
//     default: orderController.handleFetchOrderCommand(ctx);
//   }
 

// });
// bot.action(/errand_(.+)/, (ctx) => {
//   const command = ctx.match[1];
//   // Execute the corresponding command 
//   switch (command) {
//     case 'create':
//       return orderController.handleCreateErrandCommand(ctx);
//     default: orderController.handleFetchOrderCommand(ctx);
//   }

// });
// Handle callback queries
bot.action(/signup/, (ctx) => { 
  return userController.handleRegistrationCommand(ctx);   
})


// Handle callback queries
// bot.action(/errander_(.+)/, (ctx) => {
//   const command = ctx.match[1];
//   switch (command) {
//     case 'register':
//       return ctx.reply('Welcome Errander...');

//     default: userController.handleRegistrationProcess(ctx);
//   }
// })



// Handle role selection
// bot.hears(['👤 Customer', '🏍️ Register as Rider', '🛍️ Register as Errander'], async (ctx) => {
//   try {
//     if (ctx.state.user) {
//       return sendMessage(ctx, 'You are already registered!', {
//         reply_markup: { remove_keyboard: true }
//       });
//     }

//     const text = ctx.message.text;
//     let role;

//     switch (text) {
//       case '👤 Register as Customer':
//         role = 'customer';
//         break;
//       case '🏍️ Register as Rider':
//         role = 'rider';
//         break;
//       case '🛍️ Register as Errander':
//         role = 'errander';
//         break;
//     }

//     ctx.session = {
//       registration: {
//         telegramId: ctx.from.id.toString(),
//         role,
//         step: 'fullName'
//       }
//     };

//     // Try to delete user's selection message
//     try {
//       await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
//     } catch (error) {
//       console.log('Could not delete user message');
//     }

//     return sendMessage(ctx, 'Please enter your full name:', {
//       reply_markup: { remove_keyboard: true }
//     });
//   } catch (error) {
//     console.error('Error handling role selection:', error);
//     return sendMessage(ctx, 'Sorry, something went wrong. Please try again with /start', {
//       reply_markup: { remove_keyboard: true }
//     });
//   }
// });

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
// bot.command(['register_rider', 'register_errander'], userController.handleRegistrationCommand);

// Order commands
// bot.command('create_order', orderController.handleCreateOrderCommand);
// bot.command('create_errand', orderController.handleCreateErrandCommand);
// bot.command('my_orders', orderController.handleMyOrdersCommand);

// Handle registration process
bot.on('text', async (ctx) => {
  // Handle registration text inputs
  // if (ctx.session?.registration) {
    // return ;
    // userController.handleRegistrationProcess(ctx);
  // }
  
  // Handle order instructions
  if (ctx.session?.orderCreation?.step === 'instructions') {
    return orderController.handleOrderInstructions(ctx);
  }


});

// Handle location updates
// bot.on('location', async (ctx) => {
//   if (ctx.session?.orderCreation) {
//     return orderController.handleOrderLocation(ctx);
//   }
// });

// Handle photo uploads
// bot.on('photo', userController.handleRegistrationPhoto);

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  return sendMessage(ctx, 'An error occurred. Please try again later.', {
    reply_markup: { remove_keyboard: true }
  });
});

module.exports = bot; 