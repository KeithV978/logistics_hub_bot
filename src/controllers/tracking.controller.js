/**
 * Tracking controller for handling live tracking commands and flows
 */
const logger = require('../utils/logger');
const db = require('../config/database');
const geolocationService = require('../services/geolocation.service');
const groupService = require('../services/group.service');
const { sendMessage } = require('../utils/telegramUtils');

/**
 * Custom error class for tracking-related errors
 */
class TrackingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrackingError';
  }
}

/**
 * Start live tracking for a rider or errander
 * @param {Object} ctx - Telegram context object
 */
const startTracking = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`User ${telegramId} attempting to start live tracking`);

    // Check if user is a verified rider or errander with an active transaction
    const user = await db.users.findOne({ telegramId, isVerified: true, role: { $in: ['rider', 'errander'] } });
    if (!user) {
      throw new TrackingError('You must be a verified rider or errander to start tracking.');
    }

    // Find active order or errand for the user
    const order = await db.orders.findOne({
      riderId: telegramId,
      status: { $in: ['accepted', 'in_progress'] }
    });
    const errand = await db.errands.findOne({
      erranderId: telegramId,
      status: { $in: ['accepted', 'in_progress'] }
    });

    if (!order && !errand) {
      throw new TrackingError('No active order or errand found for tracking.');
    }

    const transactionId = order ? order.orderId : errand.errandId;
    const group = await groupService.getGroupByTransactionId(transactionId);
    if (!group) {
      throw new TrackingError('No active group found for this transaction.');
    }

    // Prompt user to share live location
    await sendMessage(
      group.groupId,
      `Please share your live location to start tracking for ${order ? 'order' : 'errand'} ${transactionId}.`
    );

  } catch (error) {
    logger.error(`Error in startTracking: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error starting live tracking. Please try again later.');
  }
};

/**
 * Handle live location updates from rider or errander
 * @param {Object} ctx - Telegram context object
 */
const handleLiveLocation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const { live_period, latitude, longitude } = ctx.message.location || {};

    if (!live_period) {
      throw new TrackingError('Please share a live location (not a static one).');
    }

    logger.info(`User ${telegramId} shared live location`, { latitude, longitude });

    // Verify user is a rider or errander with an active transaction
    const user = await db.users.findOne({ telegramId, isVerified: true, role: { $in: ['rider', 'errander'] } });
    if (!user) {
      throw new TrackingError('Unauthorized: You are not allowed to share live location.');
    }

    // Find active order or errand
    const order = await db.orders.findOne({
      riderId: telegramId,
      status: { $in: ['accepted', 'in_progress'] }
    });
    const errand = await db.errands.findOne({
      erranderId: telegramId,
      status: { $in: ['accepted', 'in_progress'] }
    });

    if (!order && !errand) {
      throw new TrackingError('No active transaction found for tracking.');
    }

    const transactionId = order ? order.orderId : errand.errandId;
    const group = await groupService.getGroupByTransactionId(transactionId);
    if (!group) {
      throw new TrackingError('No active group found for this transaction.');
    }

    // Update user's last known location in database
    await db.users.update(telegramId, {
      lastKnownLocation: { lat: latitude, lng: longitude },
      updatedAt: new Date()
    });

    // Notify group of live location update
    await sendMessage(
      group.groupId,
      `${user.role === 'rider' ? 'Rider' : 'Errander'} is now sharing live location for ${order ? 'order' : 'errand'} ${transactionId}.`
    );

  } catch (error) {
    logger.error(`Error in handleLiveLocation: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your live location. Please try again.');
  }
};

/**
 * Stop live tracking for a rider or errander
 * @param {Object} ctx - Telegram context object
 */
const stopTracking = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`User ${telegramId} attempting to stop live tracking`);

    // Verify user is a rider or errander
    const user = await db.users.findOne({ telegramId, isVerified: true, role: { $in: ['rider', 'errander'] } });
    if (!user) {
      throw new TrackingError('You must be a verified rider or errander to stop tracking.');
    }

    // Find active order or errand
    const order = await db.orders.findOne({
      riderId: telegramId,
      status: { $in: ['accepted', 'in_progress'] }
    });
    const errand = await db.errands.findOne({
      erranderId: telegramId,
      status: { $in: ['accepted', 'in_progress'] }
    });

    if (!order && !errand) {
      throw new TrackingError('No active transaction found for tracking.');
    }

    const transactionId = order ? order.orderId : errand.errandId;
    const group = await groupService.getGroupByTransactionId(transactionId);
    if (!group) {
      throw new TrackingError('No active group found for this transaction.');
    }

    // Notify group that tracking has stopped
    await sendMessage(
      group.groupId,
      `${user.role === 'rider' ? 'Rider' : 'Errander'} has stopped sharing live location for ${order ? 'order' : 'errand'} ${transactionId}.`
    );

  } catch (error) {
    logger.error(`Error in stopTracking: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error stopping live tracking. Please try again later.');
  }
};

module.exports = {
  startTracking,
  handleLiveLocation,
  stopTracking
};