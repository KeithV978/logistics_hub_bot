const { Markup } = require('telegraf');
const { Order } = require('../../models');

// Create logistics order command handler
async function handleCreateOrderCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return ctx.reply('Please register first using /register_rider or /register_errander.');
    }

    ctx.session = {
      orderCreation: {
        type: 'logistics',
        step: 'pickup',
        customerTelegramId: ctx.from.id.toString()
      }
    };

    return ctx.reply('Please share the pickup location:', {
      reply_markup: {
        keyboard: [[Markup.button.locationRequest('📍 Share Pickup Location')]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } catch (error) {
    console.error('Error in create order command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.', {
      reply_markup: { remove_keyboard: true }
    });
  }
}

// Create errand command handler
async function handleCreateErrandCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return ctx.reply('Please register first using /register_rider or /register_errander.');
    }

    ctx.session = {
      orderCreation: {
        type: 'errand',
        step: 'location',
        customerTelegramId: ctx.from.id.toString()
      }
    };

    return ctx.reply('Please share the errand location:', {
      reply_markup: {
        keyboard: [[Markup.button.locationRequest('📍 Share Errand Location')]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } catch (error) {
    console.error('Error in create errand command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.', {
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

    // Try to delete the previous message
    try {
      await ctx.deleteMessage(ctx.message.message_id - 1);
    } catch (error) {
      console.log('Could not delete previous message');
    }

    switch (orderCreation.step) {
      case 'pickup':
        orderCreation.pickupLocation = point;
        orderCreation.step = 'dropoff';
        return ctx.reply('Please share the drop-off location:', {
          reply_markup: {
            keyboard: [[Markup.button.locationRequest('📍 Share Drop-off Location')]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });

      case 'dropoff':
        orderCreation.dropoffLocation = point;
        orderCreation.step = 'instructions';
        return ctx.reply('Please provide delivery instructions:', {
          reply_markup: { remove_keyboard: true }
        });

      case 'location':
        orderCreation.errandLocation = point;
        orderCreation.step = 'instructions';
        return ctx.reply('Please provide errand details:', {
          reply_markup: { remove_keyboard: true }
        });
    }
  } catch (error) {
    console.error('Error handling location:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong. Please try again.', {
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

    // Try to delete the previous message
    try {
      await ctx.deleteMessage(ctx.message.message_id - 1);
    } catch (error) {
      console.log('Could not delete previous message');
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
    return ctx.reply(`Your ${orderCreation.type} order has been created successfully! Order ID: ${order.id}`, {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong while creating your order. Please try again.', {
      reply_markup: { remove_keyboard: true }
    });
  }
}

// View my orders command handler
async function handleMyOrdersCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return ctx.reply('Please register first using /register_rider or /register_errander.');
    }

    const orders = await Order.findAll({
      where: { customerTelegramId: ctx.from.id.toString() },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    if (!orders.length) {
      return ctx.reply('You have no orders yet.');
    }

    const ordersList = orders.map(order => `
Order ID: ${order.id}
Type: ${order.type}
Status: ${order.status}
Created: ${order.createdAt.toLocaleString()}
`).join('\n');

    return ctx.reply(`Your Recent Orders:\n${ordersList}`);
  } catch (error) {
    console.error('Error in my orders command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
}

module.exports = {
  handleCreateOrderCommand,
  handleCreateErrandCommand,
  handleOrderLocation,
  handleOrderInstructions,
  handleMyOrdersCommand
}; 