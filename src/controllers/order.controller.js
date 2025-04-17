/**
 * Order controller for handling order-related commands and flows
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const db = require('../config/database');
const sessionManager = require('../utils/sessionManager');
const geolocationService = require('../services/geolocation.service');
const offerService = require('../services/offer.service');
const { notifyRiders } = require('../utils/telegramUtils');

/**
 * Custom error class for order-related errors
 */
class OrderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderError';
  }
}

/**
 * Start the order creation process
 * @param {Object} ctx - Telegram context object
 */
const startOrderCreation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`User ${telegramId} starting order creation`);

    // Create a new session for order creation
    sessionManager.createSession(telegramId, {
      action: 'orderCreation',
      step: 'pickupLocation',
      data: {}
    });

    await ctx.reply(
      'Let\'s create a delivery order! 📦\n\n' +
      'First, please provide the pickup location. You can either:\n' +
      '1. Share a location using Telegram\'s location sharing feature, or\n' +
      '2. Type the address as text.\n\n' +
      'If you need to cancel the process, just type /cancel.'
    );

  } catch (error) {
    logger.error(`Error in startOrderCreation: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error starting the order creation process. Please try again later.');
  }
};

/**
 * Handle order creation flow (pickup, drop-off, instructions)
 * @param {Object} ctx - Telegram context object
 */
const handleOrderCreation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);

    if (!session || session.action !== 'orderCreation') {
      await ctx.reply('Please start the order creation process first by typing /create_order.');
      return;
    }

    logger.info(`Handling order creation for user ${telegramId}, step: ${session.step}`);

    if (session.step === 'pickupLocation') {
      await handlePickupLocation(ctx, session, telegramId);
    } else if (session.step === 'deliveryLocation') {
      await handleDeliveryLocation(ctx, session, telegramId);
    } else if (session.step === 'instructions') {
      await handleInstructions(ctx, session, telegramId);
    }

  } catch (error) {
    logger.error(`Error in handleOrderCreation: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your order. Please try again or type /cancel.');
  }
};

/**
 * Handle pickup location input (location or text)
 * @param {Object} ctx - Telegram context object
 * @param {Object} session - Current session object
 * @param {string} telegramId - User's Telegram ID
 */
const handlePickupLocation = async (ctx, session, telegramId) => {
  let pickupLocation;

  if (ctx.message.location) {
    const { latitude, longitude } = ctx.message.location;
    const address = await geolocationService.getAddressFromCoordinates(latitude, longitude);
    if (!address) {
      throw new OrderError('Could not retrieve address from the provided location.');
    }
    pickupLocation = { lat: latitude, lng: longitude, address };
  } else if (ctx.message.text && ctx.message.text !== '/cancel') {
    pickupLocation = await geolocationService.getCoordinates(ctx.message.text);
    if (!pickupLocation) {
      throw new OrderError('Invalid pickup address. Please provide a valid address or share a location.');
    }
  } else {
    sessionManager.deleteSession(telegramId);
    await ctx.reply('Order creation canceled.');
    return;
  }

  session.data.pickupLocation = pickupLocation;
  session.step = 'deliveryLocation';
  sessionManager.updateSession(telegramId, session);

  await ctx.reply(
    'Great! Pickup location saved.\n\n' +
    'Now, please provide the drop-off location. You can either:\n' +
    '1. Share a location using Telegram\'s location sharing feature, or\n' +
    '2. Type the address as text.'
  );
};

/**
 * Handle drop-off location input (location or text)
 * @param {Object} ctx - Telegram context object
 * @param {Object} session - Current session object
 * @param {string} telegramId - User's Telegram ID
 */
const handleDeliveryLocation = async (ctx, session, telegramId) => {
  let dropoffLocation;

  if (ctx.message.location) {
    const { latitude, longitude } = ctx.message.location;
    const address = await geolocationService.getAddressFromCoordinates(latitude, longitude);
    if (!address) {
      throw new OrderError('Could not retrieve address from the provided location.');
    }
    dropoffLocation = { lat: latitude, lng: longitude, address };
  } else if (ctx.message.text && ctx.message.text !== '/cancel') {
    dropoffLocation = await geolocationService.getCoordinates(ctx.message.text);
    if (!dropoffLocation) {
      throw new OrderError('Invalid drop-off address. Please provide a valid address or share a location.');
    }
  } else {
    sessionManager.deleteSession(telegramId);
    await ctx.reply('Order creation canceled.');
    return;
  }

  session.data.dropoffLocation = dropoffLocation;
  session.step = 'instructions';
  sessionManager.updateSession(telegramId, session);

  await ctx.reply(
    'Drop-off location saved.\n\n' +
    'Please provide any delivery instructions (e.g., "Leave at the gate") or type "none" to skip.'
  );
};

/**
 * Handle delivery instructions and finalize order
 * @param {Object} ctx - Telegram context object
 * @param {Object} session - Current session object
 * @param {string} telegramId - User's Telegram ID
 */
const handleInstructions = async (ctx, session, telegramId) => {
  if (ctx.message.text === '/cancel') {
    sessionManager.deleteSession(telegramId);
    await ctx.reply('Order creation canceled.');
    return;
  }

  const instructions = ctx.message.text === 'none' ? null : ctx.message.text;

  // Create order in database
  const order = {
    orderId: uuidv4(),
    customerTelegramId: telegramId,
    pickupLocation: session.data.pickupLocation,
    dropoffLocation: session.data.dropoffLocation,
    instructions,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.orders.insert(order);
  logger.info(`Order created: ${order.orderId}`, { telegramId });

  // Search for nearby riders (3km radius, increasing to 12km)
  let riders = await findNearbyRiders(session.data.pickupLocation, 3);
  let radius = 3;

  while (!riders.length && radius < 12) {
    radius += 3;
    riders = await findNearbyRiders(session.data.pickupLocation, radius);
  }

  if (!riders.length) {
    await db.orders.update(order.orderId, { status: 'canceled' });
    sessionManager.deleteSession(telegramId);
    await ctx.reply('No riders available within 12km. Please try again later.');
    return;
  }

  // Notify riders and customer
  await notifyRiders(riders, order);
  await ctx.reply(`Found ${riders.length} riders nearby. Please wait for their offers.`);

  // Clean up session
  sessionManager.deleteSession(telegramId);
};

/**
 * Find verified riders within a given radius
 * @param {Object} location - Location object { lat, lng }
 * @param {number} radius - Search radius in km
 * @returns {Array} List of rider objects
 */
const findNearbyRiders = async (location, radius) => {
  try {
    const riders = await db.users.find({
      role: 'rider',
      isVerified: true
    });

    const nearbyRiders = [];

    for (const rider of riders) {
      const distance = await geolocationService.calculateDistance(
        location,
        rider.lastKnownLocation // Assume riders share location periodically
      );

      if (distance <= radius) {
        nearbyRiders.push(rider);
      }
    }

    return nearbyRiders;
  } catch (error) {
    logger.error(`Error in findNearbyRiders: ${error.message}`, { location, radius });
    throw new OrderError('Failed to find nearby riders.');
  }
};

/**
 * Cancel order creation
 * @param {Object} ctx - Telegram context object
 */
const cancelOrderCreation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);

    if (session && session.action === 'orderCreation') {
      sessionManager.deleteSession(telegramId);
      await ctx.reply('Order creation canceled.');
    } else {
      await ctx.reply('No active order creation to cancel.');
    }
  } catch (error) {
    logger.error(`Error in cancelOrderCreation: ${error.message}`, { telegramId: ctx.from.id });
    await ctx.reply('Sorry, there was an error canceling the order creation.');
  }
};

module.exports = {
  startOrderCreation,
  handleOrderCreation,
  cancelOrderCreation
};