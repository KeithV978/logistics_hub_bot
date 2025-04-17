/**
 * Telegram utility functions for interacting with the Telegram Bot API
 */
const { InvalidInputError, TelegramError } = require('./customError');
const logger = require('./logger');
const sessionManager = require('./sessionManager');
const { configureTelegram } = require('../config/telegram');

/**
 * TelegramUtils class for Telegram Bot API operations
 */
class TelegramUtils {
  /**
   * Send a message to a Telegram chat
   * @param {Object} bot - Telegraf bot instance
   * @param {number} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @param {Object} [options={}] - Additional Telegram options (e.g., reply_markup)
   * @returns {Object} - Telegram message response
   */
  static async sendMessage(bot, chatId, text, options = {}) {
    try {
      if (!bot) {
        throw new InvalidInputError('Bot instance is required');
      }
      if (!chatId || typeof chatId !== 'number') {
        throw new InvalidInputError('Invalid chatId: must be a number', { chatId });
      }
      if (!text || typeof text !== 'string') {
        throw new InvalidInputError('Invalid text: must be a non-empty string', { text });
      }

      const response = await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'Markdown', // Default to Markdown for formatting
        ...options,
      });

      logger.info('Message sent', { chatId, text: text.substring(0, 50) });
      return response;
    } catch (error) {
      logger.error('Failed to send message', { chatId, error: error.message });
      throw new TelegramError('Failed to send message', { error: error.message });
    }
  }

  /**
   * Reply to a Telegram update
   * @param {Object} ctx - Telegraf context
   * @param {string} text - Reply text
   * @param {Object} [options={}] - Additional Telegram options
   * @returns {Object} - Telegram message response
   */
  static async reply(ctx, text, options = {}) {
    try {
      if (!ctx || !ctx.chat || !ctx.from) {
        throw new InvalidInputError('Invalid context: ctx.chat and ctx.from are required');
      }

      const response = await this.sendMessage(
        ctx.bot,
        ctx.chat.id,
        text,
        {
          reply_to_message_id: ctx.message?.message_id,
          ...options,
        }
      );

      logger.info('Reply sent', { chatId: ctx.chat.id, text: text.substring(0, 50) });
      return response;
    } catch (error) {
      logger.error('Failed to send reply', { chatId: ctx.chat?.id, error: error.message });
      throw new TelegramError('Failed to send reply', { error: error.message });
    }
  }

  /**
   * Create a private group for collaboration (e.g., order coordination)
   * @param {Object} bot - Telegraf bot instance
   * @param {string} title - Group title
   * @param {number[]} memberIds - Telegram IDs of members to invite
   * @returns {Object} - Telegram chat response
   */
  static async createPrivateGroup(bot, title, memberIds) {
    try {
      if (!bot) {
        throw new InvalidInputError('Bot instance is required');
      }
      if (!title || typeof title !== 'string') {
        throw new InvalidInputError('Invalid title: must be a non-empty string', { title });
      }
      if (!Array.isArray(memberIds) || memberIds.some(id => typeof id !== 'number')) {
        throw new InvalidInputError('Invalid memberIds: must be an array of numbers', { memberIds });
      }

      // Create a private supergroup
      const chat = await bot.telegram.createChat({
        title,
        type: 'supergroup',
      });

      // Invite members
      for (const memberId of memberIds) {
        await bot.telegram.inviteChatMember(chat.chat_id, memberId);
      }

      logger.info('Private group created', { chatId: chat.chat_id, title, memberCount: memberIds.length });
      return chat;
    } catch (error) {
      logger.error('Failed to create private group', { title, error: error.message });
      throw new TelegramError('Failed to create private group', { error: error.message });
    }
  }

  /**
   * Format a message with user-friendly structure
   * @param {Object} data - Data to format (e.g., order details)
   * @param {string} type - Message type (e.g., 'order', 'errand')
   * @returns {string} - Formatted message text
   */
  static formatMessage(data, type) {
    try {
      if (!data || typeof data !== 'object') {
        throw new InvalidInputError('Invalid data: must be an object', { data });
      }

      let formatted = '';
      switch (type) {
        case 'order':
          formatted = `*Order Details*\n` +
            `ID: ${data.id || 'N/A'}\n` +
            `Pickup: ${data.pickupLocation || 'Pending'}\n` +
            `Drop-off: ${data.dropoffLocation || 'Pending'}\n` +
            `Status: ${data.status || 'Created'}`;
          break;
        case 'errand':
          formatted = `*Errand Details*\n` +
            `ID: ${data.id || 'N/A'}\n` +
            `Description: ${data.description || 'Pending'}\n` +
            `Location: ${data.location || 'Pending'}\n` +
            `Status: ${data.status || 'Created'}`;
          break;
        default:
          throw new InvalidInputError('Invalid message type', { type });
      }

      logger.info('Message formatted', { type, data: JSON.stringify(data).substring(0, 50) });
      return formatted;
    } catch (error) {
      logger.error('Failed to format message', { type, error: error.message });
      throw new TelegramError('Failed to format message', { error: error.message });
    }
  }

  /**
   * Handle session-based reply for multi-step flows
   * @param {Object} ctx - Telegraf context
   * @param {string} step - Current step in the session
   * @param {string} prompt - Prompt to send to the user
   * @returns {Object} - Telegram message response
   */
  static async handleSessionReply(ctx, step, prompt) {
    try {
      if (!ctx || !ctx.from) {
        throw new InvalidInputError('Invalid context: ctx.from is required');
      }
      if (!step || typeof step !== 'string') {
        throw new InvalidInputError('Invalid step: must be a non-empty string', { step });
      }

      const telegramId = ctx.from.id;
      const session = await sessionManager.getSession(telegramId);

      if (!session) {
        throw new SessionError('No active session found', { telegramId });
      }

      await sessionManager.updateSession(telegramId, { step });
      const response = await this.reply(ctx, prompt);

      logger.info('Session reply handled', { telegramId, step, prompt: prompt.substring(0, 50) });
      return response;
    } catch (error) {
      logger.error('Failed to handle session reply', { telegramId: ctx.from?.id, step, error: error.message });
      throw error; // Re-throw SessionError or TelegramError
    }
  }

  /**
   * Send a location to a Telegram chat
   * @param {Object} bot - Telegraf bot instance
   * @param {number} chatId - Telegram chat ID
   * @param {number} latitude - Latitude of the location
   * @param {number} longitude - Longitude of the location
   * @param {Object} [options={}] - Additional Telegram options
   * @returns {Object} - Telegram message response
   */
  static async sendLocation(bot, chatId, latitude, longitude, options = {}) {
    try {
      if (!bot) {
        throw new InvalidInputError('Bot instance is required');
      }
      if (!chatId || typeof chatId !== 'number') {
        throw new InvalidInputError('Invalid chatId: must be a number', { chatId });
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new InvalidInputError('Invalid coordinates: latitude and longitude must be numbers', { latitude, longitude });
      }

      const response = await bot.telegram.sendLocation(chatId, latitude, longitude, options);

      logger.info('Location sent', { chatId, latitude, longitude });
      return response;
    } catch (error) {
      logger.error('Failed to send location', { chatId, error: error.message });
      throw new TelegramError('Failed to send location', { error: error.message });
    }
  }
}

module.exports = TelegramUtils;