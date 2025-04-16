/**
 * Common controller for general bot commands
 */
const logger = require('../utils/logger');

/**
 * Handle the /start command
 * @param {Object} ctx - Telegram context object
 */
const handleStart = async (ctx) => {
  try {
    const { id: telegramId, first_name } = ctx.from;
    logger.info(`User ${telegramId} started the bot`);
    
    await ctx.reply(
      `Welcome to the Logistics and Errands Bot, ${first_name}! 👋\n\n` +
      `I can help you create delivery orders or errands, or register as a rider/errander.\n\n` +
      `What would you like to do?\n` +
      `- Create a delivery order: /create_order\n` +
      `- Create an errand: /create_errand\n` +
      `- Register as a rider/errander: /register\n` +
      `- Get help: /help`
    );
  } catch (error) {
    logger.error(`Error in handleStart: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

/**
 * Handle the /help command
 * @param {Object} ctx - Telegram context object
 */
const handleHelp = async (ctx) => {
  try {
    logger.info(`User ${ctx.from.id} requested help`);
    
    await ctx.reply(
      `📖 Available Commands 📖\n\n` +
      `🔹 For Everyone:\n` +
      `/start - Start the bot\n` +
      `/help - Show this help message\n\n` +
      
      `🔹 For Customers:\n` +
      `/create_order - Create a new delivery order\n` +
      `/create_errand - Create a new errand\n` +
      `/accept_offer <offerId> - Accept an offer\n` +
      `/delivery_successful - Mark your delivery as complete\n\n` +
      
      `🔹 For Riders/Erranders:\n` +
      `/register - Register as a rider or errander\n` +
      `/profile - View your profile\n` +
      `/offer <orderId/errandId> <price> [vehicleType] - Make an offer\n` +
      `/payment_received - Confirm payment received\n\n` +
      
      `If you have any questions or need assistance, just ask!`
    );
  } catch (error) {
    logger.error(`Error in handleHelp: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

/**
 * Handle unknown commands
 * @param {Object} ctx - Telegram context object
 */
const handleUnknownCommand = async (ctx) => {
  try {
    logger.info(`User ${ctx.from.id} sent unknown command: ${ctx.message.text}`);
    
    await ctx.reply(
      'Sorry, I don\'t recognize that command. Type /help to see available commands.'
    );
  } catch (error) {
    logger.error(`Error in handleUnknownCommand: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
};

module.exports = {
  handleStart,
  handleHelp,
  handleUnknownCommand
};