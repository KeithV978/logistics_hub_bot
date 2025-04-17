/**
 * Common bot helper functions
 */
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const db = require('../database');

// Session cache (in-memory)
const sessionCache = new NodeCache({
  stdTTL: 3600, // 1 hour TTL for sessions
  checkperiod: 120, // Check for expired keys every 2 minutes
});

/**
 * Get user from database
 * @param {number} telegramId - Telegram user ID
 * @returns {Object|null} - User object or null if not found
 */
const getUser = async (telegramId) => {
  try {
    const user = await db.users.findOne({ telegramId });
    return user;
  } catch (error) {
    logger.error('Failed to get user', { telegramId, error: error.message });
    throw error;
  }
};

/**
 * Save session data
 * @param {number} telegramId - Telegram user ID
 * @param {Object} data - Session data
 */
const saveSession = (telegramId, data) => {
  try {
    const cacheKey = `session:${telegramId}`;
    sessionCache.set(cacheKey, data);
    logger.info('Session saved', { telegramId, cacheKey });
  } catch (error) {
    logger.error('Failed to save session', { telegramId, error: error.message });
    throw error;
  }
};

/**
 * Get session data
 * @param {number} telegramId - Telegram user ID
 * @returns {Object|null} - Session data or null if not found
 */
const getSession = (telegramId) => {
  try {
    const cacheKey = `session:${telegramId}`;
    const session = sessionCache.get(cacheKey);
    logger.info('Session retrieved', { telegramId, cacheKey, exists: !!session });
    return session || null;
  } catch (error) {
    logger.error('Failed to get session', { telegramId, error: error.message });
    throw error;
  }
};

/**
 * Clear session data
 * @param {number} telegramId - Telegram user ID
 */
const clearSession = (telegramId) => {
  try {
    const cacheKey = `session:${telegramId}`;
    sessionCache.del(cacheKey);
    logger.info('Session cleared', { telegramId, cacheKey });
  } catch (error) {
    logger.error('Failed to clear session', { telegramId, error: error.message });
    throw error;
  }
};

/**
 * Send message to Telegram user
 * @param {number} telegramId - Telegram user ID
 * @param {string} text - Message text
 * @param {Object} [options] - Additional options (e.g., reply_markup)
 */
const sendMessage = async (telegramId, text, options = {}) => {
  try {
    const bot = require('./setup').setupBot().bot;
    await bot.telegram.sendMessage(telegramId, text, options);
    logger.info('Message sent', { telegramId, text: text.substring(0, 50) });
  } catch (error) {
    logger.error('Failed to send message', { telegramId, text, error: error.message });
    throw error;
  }
};

/**
 * Create private group for task
 * @param {string} taskId - Task ID
 * @param {number} customerId - Customer Telegram ID
 * @param {number} riderId - Rider/Errander Telegram ID
 * @returns {number} - Group chat ID
 */
const createPrivateGroup = async (taskId, customerId, riderId) => {
  try {
    const bot = require('./setup').setupBot().bot;
    const groupTitle = `Task ${taskId} Group`;
    
    // Create group via Telegram API (simplified; actual implementation may vary)
    const chat = await bot.telegram.createChat({
      title: groupTitle,
      type: 'group',
    });
    
    // Add users to group
    await bot.telegram.addChatMember(chat.id, customerId);
    await bot.telegram.addChatMember(chat.id, riderId);
    
    logger.info('Private group created', { taskId, chatId: chat.id });
    return chat.id;
  } catch (error) {
    logger.error('Failed to create private group', { taskId, customerId, riderId, error: error.message });
    throw error;
  }
};

module.exports = {
  getUser,
  saveSession,
  getSession,
  clearSession,
  sendMessage,
  createPrivateGroup,
};