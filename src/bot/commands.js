/**
 * Telegram command registration and routing
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
 * Register Telegram commands with the bot
 * @param {Telegraf} bot - Telegraf bot instance
 */
const registerCommands = (bot) => {
  try {
    logger.info('Registering Telegram commands');

    // Start command
    bot.command(constants.TELEGRAM_COMMANDS.START, async (ctx) => {
      try {
        await startCommand(ctx.from.id);
        await ctx.reply('Welcome! Type /help for a list of commands.');
      } catch (error) {
        throw error;
      }
    });

    // Help command
    bot.command(constants.TELEGRAM_COMMANDS.HELP, async (ctx) => {
      try {
        const user = await require('../utils/helpers').getUser(ctx.from.id);
        await helpCommand(ctx.from.id, user?.role || constants.ROLES.CUSTOMER);
      } catch (error) {
        throw error;
      }
    });

    // Create order command
    bot.command(constants.TELEGRAM_COMMANDS.CREATE_ORDER, async (ctx) => {
      try {
        await startOrderCreation(ctx);
      } catch (error) {
        throw error;
      }
    });

    // Create errand command
    bot.command(constants.TELEGRAM_COMMANDS.CREATE_ERRAND, async (ctx) => {
      try {
        await startErrandCreation(ctx);
      } catch (error) {
        throw error;
      }
    });

    // Register command
    bot.command(constants.TELEGRAM_COMMANDS.REGISTER, async (ctx) => {
      try {
        const user = await require('../utils/helpers').getUser(ctx.from.id);
        if (user?.role === constants.ROLES.RIDER) {
          await registerCommand(ctx.from.id);
        } else if (user?.role === constants.ROLES.ERRANDER) {
          await erranderRegisterCommand(ctx.from.id);
        } else {
          await ctx.reply('Please specify role: /register rider or /register errander');
        }
      } catch (error) {
        throw error;
      }
    });

    // Profile command
    bot.command(constants.TELEGRAM_COMMANDS.PROFILE, async (ctx) => {
      try {
        const user = await require('../utils/helpers').getUser(ctx.from.id);
        if (user?.role === constants.ROLES.RIDER) {
          await profileCommand(ctx.from.id);
        } else if (user?.role === constants.ROLES.ERRANDER) {
          await erranderProfileCommand(ctx.from.id);
        } else {
          await ctx.reply('Only riders and erranders have profiles.');
        }
      } catch (error) {
        throw error;
      }
    });

    // Offer command
    bot.command(constants.TELEGRAM_COMMANDS.OFFER, async (ctx) => {
      try {
        const args = ctx.message.text.split(' ').slice(1);
        if (!args[0] || !args[1]) {
          throw new (require('../utils/error-handler').InvalidInputError)('Usage: /offer <taskId> <price> [vehicleType]');
        }
        const user = await require('../utils/helpers').getUser(ctx.from.id);
        if (user?.role === constants.ROLES.RIDER) {
          await offerCommand(ctx.from.id, args[0], parseFloat(args[1]), args[2]);
        } else if (user?.role === constants.ROLES.ERRANDER) {
          await erranderOfferCommand(ctx.from.id, args[0], parseFloat(args[1]));
        } else {
          throw new (require('../utils/error-handler').UserNotVerifiedError)();
        }
      } catch (error) {
        throw error;
      }
    });

    // Accept offer command
    bot.command(constants.TELEGRAM_COMMANDS.ACCEPT_OFFER, async (ctx) => {
      try {
        const args = ctx.message.text.split(' ').slice(1);
        if (!args[0]) {
          throw new (require('../utils/error-handler').InvalidInputError)('Usage: /accept_offer <offerId>');
        }
        await acceptOfferCommand(ctx.from.id, args[0]);
      } catch (error) {
        throw error;
      }
    });

    // Delivery successful command
    bot.command(constants.TELEGRAM_COMMANDS.DELIVERY_SUCCESSFUL, async (ctx) => {
      try {
        const args = ctx.message.text.split(' ').slice(1);
        if (!args[0]) {
          throw new (require('../utils/error-handler').InvalidInputError)('Usage: /delivery_successful <taskId>');
        }
        await deliverySuccessfulCommand(ctx.from.id, args[0]);
      } catch (error) {
        throw error;
      }
    });

    // Payment received command
    bot.command(constants.TELEGRAM_COMMANDS.PAYMENT_RECEIVED, async (ctx) => {
      try {
        const args = ctx.message.text.split(' ').slice(1);
        if (!args[0]) {
          throw new (require('../utils/error-handler').InvalidInputError)('Usage: /payment_received <taskId>');
        }
        const user = await require('../utils/helpers').getUser(ctx.from.id);
        if (user?.role === constants.ROLES.RIDER) {
          await paymentReceivedCommand(ctx.from.id, args[0]);
        } else if (user?.role === constants.ROLES.ERRANDER) {
          await erranderPaymentReceivedCommand(ctx.from.id, args[0]);
        } else {
          throw new (require('../utils/error-handler').UserNotVerifiedError)();
        }
      } catch (error) {
        throw error;
      }
    });

    // Cancel command
    bot.command('cancel', async (ctx) => {
      try {
        await cancelOrderCreation(ctx);
        await cancelErrandCreation(ctx);
      } catch (error) {
        throw error;
      }
    });

    // Non-command message handling
    bot.on('text', async (ctx) => {
      try {
        await handleOrderCreation(ctx);
        await handleErrandCreation(ctx);
      } catch (error) {
        throw error;
      }
    });

    // Location handling
    bot.on('location', async (ctx) => {
      try {
        await handleOrderCreation(ctx);
        await handleErrandCreation(ctx);
        if (ctx.message.location.live_period) {
          await require('../controllers/tracking.controller').handleLiveLocation(ctx);
        }
      } catch (error) {
        throw error;
      }
    });

    // Callback query handling
    bot.on('callback_query', async (ctx) => {
      try {
        const data = ctx.callbackQuery.data;
        if (data.startsWith('accept_offer:')) {
          const offerId = data.split(':')[1];
          await acceptOfferCommand(ctx.from.id, offerId);
        } else {
          await ctx.reply('Unknown callback action.');
        }
        await ctx.answerCbQuery(); // Acknowledge callback query
      } catch (error) {
        throw error;
      }
    });

    logger.info('Telegram commands registered successfully');
  } catch (error) {
    logger.error('Failed to register commands', { error: error.message });
    throw error;
  }
};

module.exports = {
  registerCommands,
};