const { Telegraf, Scenes, session } = require('telegraf');
const express = require('express');
const config = require('./src/config/config');
const { logger, getTimeBasedGreeting } = require('./src/utils/logger');
const { initDb } = require('./src/config/database');
const UserService = require('./src/services/user');
const OrderService = require('./src/services/order');
const GeolocationService = require('./src/services/geolocation');
const GroupManager = require('./src/services/group-manager');
const NotificationService = require('./src/services/notification');
const registrationScene = require('./src/scenes/registration');

// Initialize the bot
const bot = new Telegraf(config.BOT_TOKEN);
const app = express();

// Parse JSON payloads
app.use(express.json());

// Set up scenes and session
bot.use(session());
const stage = new Scenes.Stage([registrationScene]);
// bot.use(Telegraf.session());  // Add this line to ensure session support
bot.use(stage.middleware());

// Message cleanup middleware
bot.use(async (ctx, next) => {
  if (!ctx.session.messageIds) {
    ctx.session.messageIds = [];
  }

  // Extend ctx with cleanup function
  ctx.cleanup = async () => {
    try {
      for (const msgId of ctx.session.messageIds) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
        } catch (error) {
          // Ignore errors from already deleted messages
          if (error.description !== 'Bad Request: message to delete not found') {
            logger.error('Message deletion error:', { messageId: msgId, error: error.message });
          }
        }
      }
      ctx.session.messageIds = [];
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  };

  // Override ctx.reply to track message IDs
  const originalReply = ctx.reply;
  ctx.reply = async (...args) => {
    const msg = await originalReply.apply(ctx, args);
    if (msg && msg.message_id) {
      ctx.session.messageIds.push(msg.message_id);
      // Also track the user's message that triggered this reply
      if (ctx.message && ctx.message.message_id) {
        ctx.session.messageIds.push(ctx.message.message_id);
      }
    }
    return msg;
  };

  return next();
});

// Command handlers
bot.command('start', async (ctx) => {
  try {
    await ctx.cleanup();
    const userName = ctx.from.first_name || ctx.from.username || 'to you';
    const timeGreeting = getTimeBasedGreeting();
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📦 Create Delivery', callback_data: 'create_delivery' },
          { text: '🛍️ Create Errand', callback_data: 'create_errand' }
        ],
        [
          { text: '👤 Rider Signup', callback_data: 'register_rider' },
          { text: '🏃 Errander Signup', callback_data: 'register_errander' }
        ],
        [
          { text: '📊 My Profile', callback_data: 'view_profile' }
        ]
      ]
    };

    await ctx.reply(
      `${timeGreeting}, ${userName}! \n ${config.messages.welcome}`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Start command error:', error);
    await ctx.reply('Sorry, there was an error. Please try again.');
  }
});

// Handle callback queries from inline keyboard
bot.action('create_delivery', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.cleanup();
    await ctx.reply('Please share the pickup location (send location or type address)');
    ctx.session.orderState = {
      type: 'delivery',
      step: 'pickup_location',
      customerTelegramId: ctx.from.id
    };
  } catch (error) {
    logger.error('Create delivery callback error:', error);
    await ctx.reply('Sorry, there was an error. Please try again.');
  }
});

bot.action('create_errand', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.cleanup();
    await ctx.reply('Please share the errand location (send location or type address)');
    ctx.session.orderState = {
      type: 'errand',
      step: 'errand_location',
      customerTelegramId: ctx.from.id
    };
  } catch (error) {
    logger.error('Create errand callback error:', error);
    await ctx.reply('Sorry, there was an error. Please try again.');
  }
});

bot.action('register_rider', async (ctx) => {
  try {
    // Set scene state first
    ctx.scene.state = { role: 'rider' };
    // Then handle the callback query and cleanup
    console.log({role: ctx})
    await ctx.answerCbQuery();
    await ctx.cleanup();
    // Finally enter the scene
    await ctx.scene.enter('registration');
  } catch (error) {
    logger.error('Register rider callback error:', error);
    await ctx.reply('Sorry, there was an error starting registration. Please try again.');
  }
});

bot.action('register_errander', async (ctx) => {
  try {
    // Set scene state first
    ctx.scene.state = { role: 'errander' };
    // Then handle the callback query and cleanup
    await ctx.answerCbQuery();
    await ctx.cleanup();
    // Finally enter the scene
    await ctx.scene.enter('registration');
  } catch (error) {
    logger.error('Register errander callback error:', error);
    await ctx.reply('Sorry, there was an error starting registration. Please try again.');
  }
});

bot.action('view_profile', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.cleanup();
    const user = await UserService.getUserProfile(ctx.from.id);
    if (!user) {
      return ctx.reply('You are not registered. Use the Register buttons above to create an account.');
    }

    let profileText = `Your Profile:\n`;
    profileText += `Name: ${user.full_name}\n`;
    profileText += `Role: ${user.role}\n`;
    if (user.role === 'rider' && user.vehicle_type) {
      profileText += `Vehicle Type: ${user.vehicle_type}\n`;
    }
    profileText += `Phone: ${user.phone_number}\n`;
    profileText += `Bank Details:\n`;
    profileText += `- Bank Name: ${user.bank_name || 'Not set'}\n`;
    profileText += `- Account Name: ${user.account_name || 'Not set'}\n`;
    profileText += `- Account Number: ${user.account_number || 'Not set'}\n`;
    profileText += `Rating: ${user.rating.toFixed(1)}/5 (${user.total_ratings} ratings)\n`;
    profileText += `Status: ${user.verification_status}`;

    await ctx.reply(profileText);
  } catch (error) {
    logger.error('View profile callback error:', error);
    await ctx.reply('Sorry, there was an error retrieving your profile. Please try again.');
  }
});

// Updated registration command
bot.command('register', async (ctx) => {
  try {
    await ctx.cleanup();
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1 || !['rider', 'errander'].includes(args[0].toLowerCase())) {
      return ctx.reply('Please specify your role: /register rider or /register errander');
    }

    const role = args[0].toLowerCase();
    ctx.scene.state = { role }; // Initialize scene state properly
    await ctx.scene.enter('registration');
  } catch (error) {
    logger.error('Register command error:', error);
    await ctx.reply('Sorry, there was an error starting registration. Please try again.');
  }
});

bot.command('make_offer', async (ctx) => {
  try {
    await ctx.cleanup();
    const [orderId, price, ...vehicleTypeParts] = ctx.message.text.split(' ').slice(1);
    
    if (!orderId || !price || !config.PRICE_REGEX.test(price)) {
      return ctx.reply('Please use format: /make_offer [order_id] [price] [vehicle_type(optional)]');
    }

    const user = await UserService.getUserProfile(ctx.from.id);
    if (!user || user.verification_status !== 'verified') {
      return ctx.reply('You must be a verified worker to make offers.');
    }

    const vehicleType = user.role === 'rider' ? vehicleTypeParts.join(' ') : null;

    const offer = await OrderService.createOffer(
      parseInt(orderId),
      user.id,
      parseFloat(price),
      vehicleType
    );

    await ctx.reply('Offer submitted successfully! Waiting for customer response.');
  } catch (error) {
    logger.error('Make offer command error:', error);
    await ctx.reply('Sorry, there was an error submitting your offer. Please try again.');
  }
});

// Updated accept_offer command with notifications
bot.command('accept_offer', async (ctx) => {
  try {
    await ctx.cleanup();
    const [offerId, orderId] = ctx.message.text.split(' ').slice(1);
    
    if (!offerId || !orderId) {
      return ctx.reply('Please use format: /accept_offer [offer_id] [order_id]');
    }

    const result = await OrderService.acceptOffer(parseInt(offerId), parseInt(orderId));
    
    // Get worker details
    const offer = await OrderService.getOffers(orderId);
    const worker = await UserService.getUserProfile(offer[0].user_id);

    // Notify accepted worker
    await NotificationService.notifyWorkerOfferAccepted(bot, offer[0], result.order);

    // Notify other workers
    await NotificationService.notifyOtherWorkersOfferRejected(bot, orderId, worker.id);

    // Create private group
    const group = await GroupManager.createOrderGroup(bot, result.order, worker);
    await ctx.reply(config.messages.orderAccepted);
    
    // Start tracking session
    await GroupManager.startTracking(result.order.id, worker.id);
    
    // Notify worker to start sharing location
    await bot.telegram.sendMessage(
      worker.telegram_id,
      'Please start sharing your live location in the group.'
    );
  } catch (error) {
    logger.error('Accept offer command error:', error);
    await ctx.reply('Sorry, there was an error accepting the offer. Please try again.');
  }
});

// Updated payment_received command with group cleanup
bot.command('payment_received', async (ctx) => {
  try {
    await ctx.cleanup();
    const [orderId] = ctx.message.text.split(' ').slice(1);
    
    if (!orderId) {
      return ctx.reply('Please use format: /payment_received [order_id]');
    }

    const order = await OrderService.completeTransaction(parseInt(orderId), 'payment_received');
    if (order.status === 'completed') {
      await GroupManager.stopTracking(order.id);
      await GroupManager.cleanupGroup(bot, order.id);
      await ctx.reply(config.messages.transactionCompleted);
    } else {
      await ctx.reply('Payment receipt confirmed! Waiting for delivery confirmation.');
    }
  } catch (error) {
    logger.error('Payment received command error:', error);
    await ctx.reply('Sorry, there was an error confirming payment. Please try again.');
  }
});

// Updated delivery_successful command with group cleanup
bot.command('delivery_successful', async (ctx) => {
  try {
    await ctx.cleanup();
    const [orderId] = ctx.message.text.split(' ').slice(1);
    
    if (!orderId) {
      return ctx.reply('Please use format: /delivery_successful [order_id]');
    }

    const order = await OrderService.completeTransaction(parseInt(orderId), 'delivery_successful');
    if (order.status === 'completed') {
      await GroupManager.stopTracking(order.id);
      await GroupManager.cleanupGroup(bot, order.id);
      await ctx.reply(config.messages.transactionCompleted);
    } else {
      await ctx.reply('Delivery confirmed! Waiting for payment confirmation.');
    }
  } catch (error) {
    logger.error('Delivery successful command error:', error);
    await ctx.reply('Sorry, there was an error confirming delivery. Please try again.');
  }
});

bot.command('rate', async (ctx) => {
  try {
    const [workerId, rating, ...reviewParts] = ctx.message.text.split(' ').slice(1);
    
    if (!workerId || !rating || !reviewParts.length) {
      return ctx.reply('Please use format: /rate [worker_id] [1-5] [review text]');
    }

    const numericRating = parseInt(rating);
    if (numericRating < config.MIN_RATING || numericRating > config.MAX_RATING) {
      return ctx.reply(`Rating must be between ${config.MIN_RATING} and ${config.MAX_RATING}`);
    }

    await OrderService.addReview(
      parseInt(workerId),
      ctx.from.id,
      reviewParts.join(' '),
      numericRating
    );

    await ctx.reply('Thank you for your review!');
  } catch (error) {
    logger.error('Rate command error:', error);
    await ctx.reply('Sorry, there was an error submitting your review. Please try again.');
  }
});

// Handle live location updates in groups
bot.on('location', async (ctx) => {
  try {
    // If it's part of order creation flow
    if (ctx.session.orderState) {
      await ctx.cleanup();
      const location = GeolocationService.parseLocationData(ctx.message);
      
      if (ctx.session.orderState.type === 'delivery') {
        if (ctx.session.orderState.step === 'pickup_location') {
          ctx.session.orderState.pickupLocation = location;
          await ctx.reply('Now please share the drop-off location');
          ctx.session.orderState.step = 'dropoff_location';
        } else if (ctx.session.orderState.step === 'dropoff_location') {
          ctx.session.orderState.dropoffLocation = location;
          await ctx.reply('Please provide any delivery instructions (or type "none")');
          ctx.session.orderState.step = 'instructions';
        }
      } else if (ctx.session.orderState.type === 'errand') {
        if (ctx.session.orderState.step === 'errand_location') {
          ctx.session.orderState.errandLocation = location;
          await ctx.reply('Please provide the errand details');
          ctx.session.orderState.step = 'instructions';
        }
      }
      return;
    }

    // If it's a live location update in a group
    if (ctx.message.location.live_period) {
      await GroupManager.handleLocationUpdate(bot, ctx.message);
    }
  } catch (error) {
    logger.error('Location handling error:', error);
    await ctx.reply('Sorry, there was an error processing the location. Please try again.');
  }
});

// Handle text messages (for locations and instructions)
bot.on('text', async (ctx) => {
  try {
    if (!ctx.session.orderState) {
      return;
    }

    if (ctx.session.orderState.step === 'instructions') {
      await ctx.cleanup();
      const instructions = ctx.message.text;
      const order = await OrderService.createOrder(
        ctx.session.orderState.type,
        ctx.session.orderState.customerTelegramId,
        {
          pickupLocation: ctx.session.orderState.pickupLocation,
          dropoffLocation: ctx.session.orderState.dropoffLocation,
          errandLocation: ctx.session.orderState.errandLocation,
          instructions: instructions === 'none' ? null : instructions
        }
      );

      // Clear order state
      delete ctx.session.orderState;

      await ctx.reply(config.messages.orderCreated);
      
      // Start searching for nearby workers
      await NotificationService.notifyNearbyWorkers(bot, order, order.type);
    }
  } catch (error) {
    logger.error('Text handling error:', error);
    await ctx.reply('Sorry, there was an error processing your message. Please try again.');
  }
});

// Add view_offers command
bot.command('view_offers', async (ctx) => {
  try {
    const [orderId] = ctx.message.text.split(' ').slice(1);
    
    if (!orderId) {
      return ctx.reply('Please use format: /view_offers [order_id]');
    }

    const offers = await OrderService.getOffers(parseInt(orderId));
    if (!offers.length) {
      return ctx.reply('No active offers found for this order.');
    }

    const offersList = offers.map(offer => {
      let text = `Offer #${offer.id}\n`;
      text += `From: ${offer.full_name}\n`;
      text += `Rating: ${offer.rating.toFixed(1)}/5\n`;
      text += `Price: $${offer.price}`;
      if (offer.vehicle_type) {
        text += `\nVehicle: ${offer.vehicle_type}`;
      }
      return text;
    }).join('\n\n');

    await ctx.reply(
      `Available offers:\n\n${offersList}\n\nUse /accept_offer [offer_id] [order_id] to accept an offer.`
    );
  } catch (error) {
    logger.error('View offers command error:', error);
    await ctx.reply('Sorry, there was an error retrieving the offers. Please try again.');
  }
});

// Error handling
bot.catch((err, ctx) => {
  logger.error('Bot error:', err);
  ctx.reply('Sorry, something went wrong. Please try again later.');
});

// Setup webhook
app.post(`/webhook/${config.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Start the server
const startServer = async () => {
  try {
    // Initialize database
    await initDb();
    logger.info('Database initialized');

    // Start cleaning up expired orders/offers periodically
    setInterval(async () => {
      try {
        await OrderService.cleanupExpired();
      } catch (error) {
        logger.error('Cleanup error:', error);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes

    // Start Express server
    app.listen(config.PORT, () => {
      logger.info(`Server is running on port ${config.PORT}`);
    });

    // Set webhook
    await bot.telegram.setWebhook(`${config.WEBHOOK_URL}/${config.BOT_TOKEN}`);
    logger.info('Webhook set successfully');
  } catch (error) {
    logger.error('Server startup error:', error);
    process.exit(1);
  }
};

startServer();