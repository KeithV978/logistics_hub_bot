/**
 * Webhook handler for Telegram location updates
 */
const logger = require('../utils/logger');
const { handleOrderCreation } = require('../controllers/order.controller');
const { handleErrandCreation } = require('../controllers/errand.controller');
const { handleLiveLocation } = require('../controllers/tracking.controller');

/**
 * Handle Telegram location updates (static or live)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleLocationUpdate = async (req, res, next) => {
  try {
    const message = req.body.message;
    const telegramId = message.from.id;
    const location = message.location;
    const ctx = {
      from: message.from,
      message: {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          live_period: location.live_period,
        },
        text: message.text || '',
      },
      reply: async (text) => {
        await require('../utils/telegramUtils').sendMessage(telegramId, text);
      },
    };

    logger.info(`Processing location update from ${telegramId}`, {
      latitude: location.latitude,
      longitude: location.longitude,
      live_period: location.live_period,
    });

    // Handle live location for tracking
    if (location.live_period) {
      await handleLiveLocation(ctx);
    } else {
      // Handle static location for order/errand creation
      await handleOrderCreation(ctx);
      await handleErrandCreation(ctx);
    }

    res.sendStatus(200); // Acknowledge webhook
  } catch (error) {
    next(error); // Pass to error middleware
  }
};

module.exports = {
  handleLocationUpdate,
};