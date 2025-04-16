/**
 * Errand controller for handling errand-related commands and flows
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const db = require('../database');
const sessionManager = require('../utils/sessionManager');
const geolocationService = require('../services/geolocationService');
const offerService = require('../services/offerService');
const { notifyErranders } = require('../utils/telegramUtils');

/**
 * Custom error class for errand-related errors
 */
class ErrandError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErrandError';
  }
}

/**
 * Start the errand creation process
 * @param {Object} ctx - Telegram context object
 */
const startErrandCreation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`User ${telegramId} starting errand creation`);

    // Create a new session for errand creation
    sessionManager.createSession(telegramId, {
      action: 'errandCreation',
      step: 'location',
      data: {}
    });

    await ctx.reply(
      'Let\'s create an errand! 🛒\n\n' +
      'First, please provide the errand location. You can either:\n' +
      '1. Share a location using Telegram\'s location sharing feature, or\n' +
      '2. Type the address as text.\n\n' +
      'If you need to cancel the process, just type /cancel.'
    );

  } catch (error) {
    logger.error(`Error in startErrandCreation: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error starting the errand creation process. Please try again later.');
  }
};

/**
 * Handle errand creation flow (location, description)
 * @param {Object} ctx - Telegram context object
 */
const handleErrandCreation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);

    if (!session || session.action !== 'errandCreation') {
      await ctx.reply('Please start the errand creation process first by typing /create_errand.');
      return;
    }

    logger.info(`Handling errand creation for user ${telegramId}, step: ${session.step}`);

    if (session.step === 'location') {
      await handleLocation(ctx, session, telegramId);
    } else if (session.step === 'description') {
      await handleDescription(ctx, session, telegramId);
    }

  } catch (error) {
    logger.error(`Error in handleErrandCreation: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your errand. Please try again or type /cancel.');
  }
};

/**
 * Handle errand location input (location or text)
 * @param {Object} ctx - Telegram context object
 * @param {Object} session - Current session object
 * @param {string} telegramId - User's Telegram ID
 */
const handleLocation = async (ctx, session, telegramId) => {
  let location;

  if (ctx.message.location) {
    const { latitude, longitude } = ctx.message.location;
    const address = await geolocationService.getAddressFromCoordinates(latitude, longitude);
    if (!address) {
      throw new ErrandError('Could not retrieve address from the provided location.');
    }
    location = { lat: latitude, lng: longitude, address };
  } else if (ctx.message.text && ctx.message.text !== '/cancel') {
    location = await geolocationService.getCoordinates(ctx.message.text);
    if (!location) {
      throw new ErrandError('Invalid errand address. Please provide a valid address or share a location.');
    }
  } else {
    sessionManager.deleteSession(telegramId);
    await ctx.reply('Errand creation canceled.');
    return;
  }

  session.data.location = location;
  session.step = 'description';
  sessionManager.updateSession(telegramId, session);

  await ctx.reply(
    'Great! Errand location saved.\n\n' +
    'Now, please provide the errand description (e.g., "Buy groceries from Store X").'
  );
};

/**
 * Handle errand description and finalize errand
 * @param {Object} ctx - Telegram context object
 * @param {Object} session - Current session object
 * @param {string} telegramId - User's Telegram ID
 */
const handleDescription = async (ctx, session, telegramId) => {
  if (ctx.message.text === '/cancel') {
    sessionManager.deleteSession(telegramId);
    await ctx.reply('Errand creation canceled.');
    return;
  }

  const description = ctx.message.text;

  // Create errand in database
  const errand = {
    errandId: uuidv4(),
    customerTelegramId: telegramId,
    location: session.data.location,
    description,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.errands.insert(errand);
  logger.info(`Errand created: ${errand.errandId}`, { telegramId });

  // Search for nearby erranders (3km radius, increasing to 6km)
  let erranders = await findNearbyErranders(session.data.location, 3);
  let radius = 3;

  while (!erranders.length && radius < 6) {
    radius += 2;
    erranders = await findNearbyErranders(session.data.location, radius);
  }

  if (!erranders.length) {
    await db.errands.update(errand.errandId, { status: 'canceled' });
    sessionManager.deleteSession(telegramId);
    await ctx.reply('No erranders available within 6km. Please try again later.');
    return;
  }

  // Notify erranders and customer
  await notifyErranders(erranders, errand);
  await ctx.reply(`Found ${erranders.length} erranders nearby. Please wait for their offers.`);

  // Clean up session
  sessionManager.deleteSession(telegramId);
};

/**
 * Find verified erranders within a given radius
 * @param {Object} location - Location object { lat, lng }
 * @param {number} radius - Search radius in km
 * @returns {Array} List of errander objects
 */
const findNearbyErranders = async (location, radius) => {
  try {
    const erranders = await db.users.find({
      role: 'errander',
      isVerified: true
    });

    const nearbyErranders = [];

    for (const errander of erranders) {
      const distance = await geolocationService.calculateDistance(
        location,
        errander.lastKnownLocation // Assume erranders share location periodically
      );

      if (distance <= radius) {
        nearbyErranders.push(errander);
      }
    }

    return nearbyErranders;
  } catch (error) {
    logger.error(`Error in findNearbyErranders: ${error.message}`, { location, radius });
    throw new ErrandError('Failed to find nearby erranders.');
  }
};

/**
 * Cancel errand creation
 * @param {Object} ctx - Telegram context object
 */
const cancelErrandCreation = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);

    if (session && session.action === 'errandCreation') {
      sessionManager.deleteSession(telegramId);
      await ctx.reply('Errand creation canceled.');
    } else {
      await ctx.reply('No active errand creation to cancel.');
    }
  } catch (error) {
    logger.error(`Error in cancelErrandCreation: ${error.message}`, { telegramId: ctx.from.id });
    await ctx.reply('Sorry, there was an error canceling the errand creation.');
  }
};

module.exports = {
  startErrandCreation,
  handleErrandCreation,
  cancelErrandCreation
};