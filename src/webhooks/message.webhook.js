/**
 * Webhook handler for Telegram message updates
 */
const logger = require('../utils/logger');
const constants = require('../utils/constants');
const {
  startOrderCreation,
  handleOrderCreation,
  cancelOrderCreation,
} = require('../controllers/order.controller');
const {
  startErrandCreation,
  handleErrandCreation,
  cancelErrandCreation,
} = require('../controllers/errand.controller');
const {
  startCommand,
  helpCommand,
} = require('../controllers/common.controller');
const {
  registerCommand,
  profileCommand,
  offerCommand,
  paymentReceivedCommand,
} = require('../controllers/rider.controller');
const {
  registerCommand: erranderRegisterCommand,
  profileCommand: erranderProfileCommand,
  offerCommand: erranderOfferCommand,
  paymentReceivedCommand: erranderPaymentReceivedCommand,
} = require('../controllers/errander.controller');
const { acceptOfferCommand, deliverySuccessfulCommand } = require('../controllers/customer.controller');

/**
 * Handle incoming Telegram message updates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleMessage = async (req, res, next) => {
  try {
    const message = req.body.message;
    const telegramId = message.from.id;
    const text = message.text || '';
    const ctx = {
      from: message.from,
      reply: async (text) => {
        // Simulate Telegram reply (actual implementation depends on Telegram API client)
        await require('../utils/telegramUtils').sendMessage(telegramId, text);
      },
    };

    logger.info(`Processing message from ${telegramId}`, { text });

    // Handle commands
    if (text.startsWith('/')) {
      const [command, ...args] = text.split(' ');
      switch (command) {
        case constants.TELEGRAM_COMMANDS.START:
          await startCommand(telegramId);
          break;
        case constants.TELEGRAM_COMMANDS.HELP:
          await helpCommand(telegramId, req.user?.role || constants.ROLES.CUSTOMER);
          break;
        case constants.TELEGRAM_COMMANDS.CREATE_ORDER:
          await startOrderCreation(ctx);
          break;
        case constants.TELEGRAM_COMMANDS.CREATE_ERRAND:
          await startErrandCreation(ctx);
          break;
        case constants.TELEGRAM_COMMANDS.REGISTER:
          if (req.user?.role === constants.ROLES.RIDER) {
            await registerCommand(telegramId);
          } else if (req.user?.role === constants.ROLES.ERRANDER) {
            await erranderRegisterCommand(telegramId);
          } else {
            await ctx.reply('Please specify role: /register rider or /register errander');
          }
          break;
        case constants.TELEGRAM_COMMANDS.PROFILE:
          if (req.user?.role === constants.ROLES.RIDER) {
            await profileCommand(telegramId);
          } else if (req.user?.role === constants.ROLES.ERRANDER) {
            await erranderProfileCommand(telegramId);
          } else {
            await ctx.reply('Only riders and erranders have profiles.');
          }
          break;
        case constants.TELEGRAM_COMMANDS.OFFER:
          if (!args[0] || !args[1]) {
            throw new (require('../utils/error-handler').InvalidInputError)('Usage: /offer <taskId> <price> [vehicleType]');
          }
          if (req.user?.role === constants.ROLES.RIDER) {
            await offerCommand(telegramId, args[0], parseFloat(args[1]), args[2]);
          } else if (req.user?.role === constants.ROLES.ERRANDER) {
            await erranderOfferCommand(telegramId, args[0], parseFloat(args[1]));
          } else {
            throw new (require('../utils/error-handler').UserNotVerifiedError)();
          }
          break;
        case constants.TELEGRAM_COMMANDS.ACCEPT_OFFER:
          if (!args[0]) {
            throw new (require('../utils/error-handler').InvalidInputError)('Usage: /accept_offer <offerId>');
          }
          await acceptOfferCommand(telegramId, args[0]);
          break;
        case constants.TELEGRAM_COMMANDS.DELIVERY_SUCCESSFUL:
          if (!args[0]) {
            throw new (require('../utils/error-handler').InvalidInputError)('Usage: /delivery_successful <taskId>');
          }
          await deliverySuccessfulCommand(telegramId, args[0]);
          break;
        case constants.TELEGRAM_COMMANDS.PAYMENT_RECEIVED:
          if (!args[0]) {
            throw new (require('../utils/error-handler').InvalidInputError)('Usage: /payment_received <taskId>');
          }
          if (req.user?.role === constants.ROLES.RIDER) {
            await paymentReceivedCommand(telegramId, args[0]);
          } else if (req.user?.role === constants.ROLES.ERRANDER) {
            await erranderPaymentReceivedCommand(telegramId, args[0]);
          } else {
            throw new (require('../utils/error-handler').UserNotVerifiedError)();
          }
          break;
        case '/cancel':
          await cancelOrderCreation(ctx);
          await cancelErrandCreation(ctx);
          break;
        default:
          await ctx.reply('Unknown command. Type /help for a list of commands.');
      }
    } else {
      // Handle non-command messages (e.g., session-based inputs)
      await handleOrderCreation(ctx);
      await handleErrandCreation(ctx);
    }

    res.sendStatus(200); // Acknowledge webhook
  } catch (error) {
    next(error); // Pass to error middleware
  }
};

module.exports = {
  handleMessage,
};