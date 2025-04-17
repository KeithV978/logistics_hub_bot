/**
 * Webhook handler for Telegram callback queries
 */
const logger = require('../utils/logger');
const { acceptOfferCommand } = require('../controllers/customer.controller');

/**
 * Handle Telegram callback queries (e.g., inline button presses)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleCallbackQuery = async (req, res, next) => {
  try {
    const callbackQuery = req.body.callback_query;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data; // e.g., 'accept_offer:<offerId>'
    const ctx = {
      from: callbackQuery.from,
      reply: async (text) => {
        await require('../utils/telegramUtils').sendMessage(telegramId, text);
      },
    };

    logger.info(`Processing callback query from ${telegramId}`, { data });

    // Handle specific callback actions
    if (data.startsWith('accept_offer:')) {
      const offerId = data.split(':')[1];
      await acceptOfferCommand(telegramId, offerId);
    } else {
      await ctx.reply('Unknown callback action.');
    }

    res.sendStatus(200); // Acknowledge webhook
  } catch (error) {
    next(error); // Pass to error middleware
  }
};

module.exports = {
  handleCallbackQuery,
};