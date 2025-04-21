const { Markup, Scenes } = require('telegraf');
const { Order, User } = require('../../models');
const { sendMessage } = require('../../utils/sendMessage');
const { calculateDistance } = require('../../utils/location');
const { Op } = require('sequelize');
const { bot } = require('../../config/telegram');

// Helper function to delete recent messages
async function deleteMessages(ctx) {
  try {
    if (ctx.message?.message_id) {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    }
    if (ctx.message?.message_id - 1) {
      await ctx.deleteMessage(ctx.message.message_id - 1).catch(() => {});
    }
  } catch (error) {
    console.error('Error deleting messages:', error);
  }
}

// Create delivery order wizard
const deliveryOrderWizard = new Scenes.WizardScene(
  'delivery_order',
  // Step 1 - Pickup Location
  async (ctx) => {
    await deleteMessages(ctx);
    // Initialize wizard state
    ctx.wizard.state = {
      customerTelegramId: ctx.from.id.toString()
    };

    await sendMessage(ctx, 'Please share the pickup location or type the address if it\'s not on the map:', {
      reply_markup: {
        keyboard: [
          [{ text: '📍 Share Pickup Location', request_location: true }],
          ['Type Address Instead']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    await sendMessage(ctx, 'Please share the pickup location:', {
      reply_markup: {
        keyboard: [[{ text: '📍 Share Pickup Location', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return ctx.wizard.next();
  },
  // Step 2 - Dropoff Location
  async (ctx) => {
    await deleteMessages(ctx);
    if (!ctx.message.location) {
      await sendMessage(ctx, 'Please share a valid pickup location:', {
        reply_markup: {
          keyboard: [[{ text: '📍 Share Pickup Location', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }
    
    ctx.wizard.state.pickupLocation = {
      latitude: ctx.message.location.latitude,
      longitude: ctx.message.location.longitude
    };

    await sendMessage(ctx, 'Great! Now share the drop-off location:', {
      reply_markup: {
        keyboard: [[{ text: '📍 Share Drop-off Location', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return ctx.wizard.next();
  },
  // Step 3 - Instructions
  async (ctx) => {
    await deleteMessages(ctx);
    if (!ctx.message.location) {
      await sendMessage(ctx, 'Please share a valid drop-off location:', {
        reply_markup: {
          keyboard: [[{ text: '📍 Share Drop-off Location', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }

    ctx.wizard.state.dropoffLocation = {
      latitude: ctx.message.location.latitude,
      longitude: ctx.message.location.longitude
    };

    await sendMessage(ctx, 'Please provide any delivery instructions (e.g., "fragile items", "call upon arrival"):', {
      reply_markup: { remove_keyboard: true }
    });
    return ctx.wizard.next();
  },
  // Final Step - Create Order and Notify Riders
  async (ctx) => {
    await deleteMessages(ctx);
    try {
      const instructions = ctx.message.text;
      
      // Create the order
      const order = await Order.create({
        customerTelegramId: ctx.from.id.toString(),
        type: 'delivery',
        pickupLocation: ctx.wizard.state.pickupLocation,
        dropoffLocation: ctx.wizard.state.dropoffLocation,
        instructions: instructions,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      });

      // Find riders within 5km radius of pickup location
      const nearbyRiders = await User.findAll({
        where: {
          role: 'rider',
          isVerified: true,
          isActive: true,
          currentLocation: {
            [Op.not]: null
          }
        }
      });

      // Filter riders by distance and notify them
      const maxDistance = 5; // 5km radius
      const availableRiders = nearbyRiders.filter(rider => {
        if (!rider.currentLocation) return false;
        
        const distance = calculateDistance(
          ctx.wizard.state.pickupLocation.latitude,
          ctx.wizard.state.pickupLocation.longitude,
          rider.currentLocation.latitude,
          rider.currentLocation.longitude
        );
        
        return distance <= maxDistance;
      });

      // Notify customer about rider availability
      if (availableRiders.length === 0) {
        await sendMessage(ctx, 'No riders found within 5km of the pickup location. Your order has been created and we\'ll notify riders as they become available.');
      } else {
        await sendMessage(ctx, `Found ${availableRiders.length} riders nearby! They will be notified of your order.`);
        
        // Notify each rider
        for (const rider of availableRiders) {
          const riderMessage = `
🚨 New Delivery Order #${order.id}

📍 Pickup: ${order.pickupLocation.latitude}, ${order.pickupLocation.longitude}
🎯 Drop-off: ${order.dropoffLocation.latitude}, ${order.dropoffLocation.longitude}
📝 Instructions: ${order.instructions}

Use /make_offer ${order.id} [price] to submit your offer.`;

          await bot.telegram.sendMessage(rider.telegramId, riderMessage);
        }
      }

      await sendMessage(ctx, `Order created successfully! Your order ID is: ${order.id}\n\nUse /track_order ${order.id} to check the status of your order.`);
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error creating order:', error);
      await sendMessage(ctx, 'Sorry, something went wrong while creating your order. Please try again.');
      return ctx.scene.leave();
    }
  }
);

// Set up the stage with the wizard
const stage = new Scenes.Stage([deliveryOrderWizard]);
bot.use(stage.middleware());

// Create logistics order command handler
async function handleDeliveryOrderCreation(ctx) {
  try {
    // Check for existing active orders
    const existingOrder = await Order.findOne({
      where: {
        customerTelegramId: ctx.from.id.toString(),
        status: {
          [Op.notIn]: ['completed', 'cancelled']
        }
      }
    });

    if (existingOrder) {
      return sendMessage(ctx, `You already have an active order. Please wait for it to complete before creating a new one.\nUse /track_order ${existingOrder.id} to check its status.`);
    }

    // Display welcome message and enter the wizard
    await ctx.reply('Welcome to the delivery order wizard! I\'ll guide you through creating your delivery order. 🚚');
    return ctx.scene.enter('delivery_order');

  } catch (error) {
    console.error('Error in create order command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
  }
}

async function handleListDeliveries(ctx){}

async function handleCancelDelivery(ctx){}

// It returns the status of the delivery and the location of the delivery rider in real-time
async function handleDeliveryStatus(ctx){}


async function handleFetchOrderCommand(ctx){
  const orders = await Order.findAll({
    where: {
      customerTelegramId: ctx.from.id.toString()
    },
    order: [['createdAt', 'DESC']]
  });

  if (orders.length === 0) {
    return sendMessage(ctx, 'You have no previous orders.');
  }

  const ordersList = orders.map(order => 
    `Order #${order.id}\nStatus: ${order.status}\nCreated: ${order.createdAt.toLocaleDateString()}`
  ).join('\n\n');

  return sendMessage(ctx, `Your orders:\n\n${ordersList}`);
  }

// Create errand command handler
async function handleCreateErrandCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return sendMessage(ctx, 'Please register first using /register_rider or /register_errander.');
    }

    ctx.session = {
      orderCreation: {
        type: 'errand',
        step: 'location',
        customerTelegramId: ctx.from.id.toString()
      }
    };

    return sendMessage(ctx, 'Please share the errand location:', {
      reply_markup: {
        keyboard: [[Markup.button.locationRequest('📍 Share Errand Location')]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } catch (error) {
    console.error('Error in create errand command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.', {
      reply_markup: { remove_keyboard: true }
    });
  }
} 
// Handle location updates for orders
async function handleOrderLocation(ctx) {
  if (!ctx.session?.orderCreation) return;

  try {
    const { orderCreation } = ctx.session;
    const { latitude, longitude } = ctx.message.location;
    const point = { type: 'Point', coordinates: [longitude, latitude] };

    // Try to delete user's location message
    try {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    } catch (error) {
      console.log('Could not delete location message');
    }

    switch (orderCreation.step) {
      case 'pickup':
        orderCreation.pickupLocation = point;
        orderCreation.step = 'dropoff';
        return sendMessage(ctx, 'Please share the drop-off location:', {
          reply_markup: {
            keyboard: [[Markup.button.locationRequest('📍 Share Drop-off Location')]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });

      case 'dropoff':
        orderCreation.dropoffLocation = point;
        orderCreation.step = 'instructions';
        return sendMessage(ctx, 'Please provide delivery instructions:', {
          reply_markup: { remove_keyboard: true }
        });

      case 'location':
        orderCreation.errandLocation = point;
        orderCreation.step = 'instructions';
        return sendMessage(ctx, 'Please provide errand details:', {
          reply_markup: { remove_keyboard: true }
        });
    }
  } catch (error) {
    console.error('Error handling location:', error);
    ctx.session = null;
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again.', {
      reply_markup: { remove_keyboard: true }
    });
  }
}
// Handle order instructions
async function handleOrderInstructions(ctx) {
  if (!ctx.session?.orderCreation || ctx.session.orderCreation.step !== 'instructions') return;

  try {
    const { orderCreation } = ctx.session;
    const instructions = ctx.message.text;

    // Try to delete user's message
    try {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    } catch (error) {
      console.log('Could not delete user message');
    }

    // Create the order
    const order = await Order.create({
      customerTelegramId: orderCreation.customerTelegramId,
      type: orderCreation.type,
      pickupLocation: orderCreation.pickupLocation,
      dropoffLocation: orderCreation.dropoffLocation,
      errandLocation: orderCreation.errandLocation,
      instructions,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });

    ctx.session = null;
    return sendMessage(ctx, `Your ${orderCreation.type} order has been created successfully! Order ID: ${order.id}`, {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    ctx.session = null;
    return sendMessage(ctx, 'Sorry, something went wrong while creating your order. Please try again.', {
      reply_markup: { remove_keyboard: true }
    });
  }
}

// View my orders command handler
async function handleMyOrdersCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return sendMessage(ctx, 'Please register first using /register_rider or /register_errander.');
    }

    const orders = await Order.findAll({
      where: { customerTelegramId: ctx.from.id.toString() },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    if (!orders.length) {
      return sendMessage(ctx, 'You have no orders yet.');
    }

    const ordersList = orders.map(order => `
Order ID: ${order.id}
Type: ${order.type}
Status: ${order.status}
Created: ${order.createdAt.toLocaleString()}
`).join('\n');

    return sendMessage(ctx, `Your Recent Orders:\n${ordersList}`);
  } catch (error) {
    console.error('Error in my orders command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
  }
}

module.exports = {
  handleDeliveryOrderCreation,
  handleListDeliveries,
  handleCancelDelivery,
  handleDeliveryStatus,

  handleCreateErrandCommand,
  handleOrderLocation,
  handleOrderInstructions,
  handleMyOrdersCommand
}; 