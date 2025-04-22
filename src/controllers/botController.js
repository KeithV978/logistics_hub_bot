const { bot } = require('../config/telegram');
const { User, Order } = require('../models');
const { Markup } = require('telegraf');
const { Op } = require('sequelize');
const { verifyNIN } = require('../services/ninVerification');
const { calculateDistance } = require('../utils/location');
const userController = require('./bot/userController');
const orderController = require('./bot/orderController');
const userGreeting =require('../utils/Greeting')
const { sendMessage } = require('../utils/sendMessage'); 

// Middleware to handle user state
// bot.use(async (ctx, next) => {
//   if (ctx.from) {
//     ctx.state.user = await User.findOne({
//       where: { telegramId: ctx.from.id.toString() }
//     });
//   }
//   return next();
// });



// Start command
bot.command('start', async (ctx) => {
  // Delete previous bot message if exists
  if (ctx.session?.lastBotMessageId) {
    await ctx.deleteMessage(ctx.session.lastBotMessageId).catch(() => {});
  }

  try {
    // if (ctx.state.user) {
    //   return sendMessage(ctx, 'Welcome back! Use /help to see available commands.', {
    //     reply_markup: { remove_keyboard: true }
    //   });
    // }

    return sendMessage(ctx, 
      `Welcome to Logistics Hub \n ${ctx.from.first_name !== ""? userGreeting(ctx.from.first_name) : userGreeting(ctx.from.username)}! \nSelect one of the following options to proceed `, {
        reply_markup: {
          inline_keyboard: [
            [{text:'Create a Delivery', callback_data: 'delivery_create'},{text:'🏍️ My Deliveries', callback_data: 'delivery'}],
            [{text:'Create an Errand', callback_data: 'errand_create'},{text:'🛍️ My Errands', callback_data: 'errand'}],
            [{text:'📝 Rider/Errand runner Signup', callback_data: 'signup'}], 
            [{text:'👤 Profile', callback_data: 'profile'}],
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
bot.action(/signup/, (ctx) => { 
  return userController.handleRegistrationCommand(ctx);   
})
 
bot.action(/delivery_(.+)/, (ctx) => {
  const command = ctx.match[1];
  switch (command) {
    case 'create':
      return orderController.handleDeliveryOrderCreation(ctx);
    case 'list':
      return orderController.handleListDeliveries(ctx);
    case 'cancel':
      return orderController.handleCancelDelivery(ctx);
    case 'status':
      return orderController.handleDeliveryStatus(ctx);
    default:
      return sendMessage(ctx, `Are you trying to ask me to do something ${ctx.from.first_name === ""? ctx.from.username : ctx.from.first_name}?\nUse \help to see a list of availale commands.`)

  }
})
bot.action(/errand_(.+)/, (ctx) => { 
  const command = ctx.match[1].split('_')[0];
  switch (command) {
    case 'create':
      return orderController.handleOrderCreation(ctx);
    case 'list':
      return orderController.handleListDeliveries(ctx);
    case 'cancel':
      return orderController.handleCancelDelivery(ctx);
    case 'status':
      return orderController.handleDeliveryStatus(ctx);
    default:
      return orderController.handleDeliveryOverview(ctx);
  }   
})

// User commands
bot.action(/profile/, userController.handleProfileCommand); 
bot.action(/terms_and_conditions/, userController.handleTermsAndConditionsCommand);
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
`;
  return sendMessage(ctx, helpMessage);
});


// Handle registration process
bot.on('text', async (ctx) => {
  // Handle registration text inputs
  // if (ctx.session?.registration) {
    // return ;
    // userController.handleRegistrationProcess(ctx);
  // }
  
  // Handle order instructions
  // if (ctx.session?.orderCreation?.step === 'instructions') {
  //   return orderController.handleOrderInstructions(ctx);
  // }
return sendMessage(ctx, `Are you trying to ask me to do something ${ctx.from.first_name === ""? ctx.from.username : ctx.from.first_name}?\nUse \help to see a list of availale commands.`)

});

// Handle location updates
// bot.on('location', async (ctx) => {
//   if (ctx.session?.orderCreation) {
//     return orderController.handleOrderLocation(ctx);
//   }
// });
 
// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  return sendMessage(ctx, 'An error occurred. Please try again later.', {
    reply_markup: { remove_keyboard: true }
  });
});

module.exports = bot; 