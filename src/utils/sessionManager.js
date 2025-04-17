/**
 * Session manager for handling user sessions
 */
const NodeCache = require('node-cache');
const logger = require('./logger');

/**
 * SessionManager class for creating, getting, updating, and deleting sessions
 */
class SessionManager {
  constructor(options = {}) {
    // Initialize node-cache with configurable options
    this.cache = new NodeCache({
      stdTTL: process.env.SESSION_TTL_SECONDS || 3600, // Default: 1 hour TTL
      checkperiod: options.checkperiod || 120, // Check for expired keys every 2 minutes
      useClones: false, // Avoid cloning to improve performance
    });

    logger.info('SessionManager initialized', {
      ttl: this.cache.options.stdTTL,
      checkperiod: this.cache.options.checkperiod,
    });

    // Handle cache errors
    this.cache.on('error', (error) => {
      logger.error('Session cache error', { error: error.message });
    });
  }

  /**
   * Create a new session for a user
   * @param {number} telegramId - Telegram user ID
   * @param {Object} [data={}] - Initial session data
   * @returns {boolean} - True if session was created
   */
  createSession(telegramId, data = {}) {
    try {
      if (!telegramId || typeof telegramId !== 'number') {
        throw new Error('Invalid telegramId: must be a number');
      }

      const cacheKey = `session:${telegramId}`;
      const sessionData = {
        telegramId,
        createdAt: new Date().toISOString(),
        data: { ...data }, // Deep copy to avoid mutating input
      };

      const success = this.cache.set(cacheKey, sessionData);
      if (!success) {
        throw new Error('Failed to create session in cache');
      }

      logger.info('Session created', { telegramId, cacheKey });
      return true;
    } catch (error) {
      logger.error('Failed to create session', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get a user's session
   * @param {number} telegramId - Telegram user ID
   * @returns {Object|null} - Session data or null if not found
   */
  getSession(telegramId) {
    try {
      if (!telegramId || typeof telegramId !== 'number') {
        throw new Error('Invalid telegramId: must be a number');
      }

      const cacheKey = `session:${telegramId}`;
      const session = this.cache.get(cacheKey);

      if (!session) {
        logger.info('Session not found', { telegramId, cacheKey });
        return null;
      }

      logger.info('Session retrieved', { telegramId, cacheKey });
      return session;
    } catch (error) {
      logger.error('Failed to get session', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Update a user's session
   * @param {number} telegramId - Telegram user ID
   * @param {Object} data - Data to update in the session
   * @returns {boolean} - True if session was updated
   */
  updateSession(telegramId, data) {
    try {
      if (!telegramId || typeof telegramId !== 'number') {
        throw new Error('Invalid telegramId: must be a number');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data: must be an object');
      }

      const cacheKey = `session:${telegramId}`;
      const existingSession = this.cache.get(cacheKey);

      if (!existingSession) {
        throw new Error('Session not found');
      }

      const updatedSession = {
        ...existingSession,
        data: {
          ...existingSession.data,
          ...data, // Merge new data
        },
        updatedAt: new Date().toISOString(),
      };

      const success = this.cache.set(cacheKey, updatedSession);
      if (!success) {
        throw new Error('Failed to update session in cache');
      }

      logger.info('Session updated', { telegramId, cacheKey });
      return true;
    } catch (error) {
      logger.error('Failed to update session', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a user's session
   * @param {number} telegramId - Telegram user ID
   * @returns {boolean} - True if session was deleted
   */
  deleteSession(telegramId) {
    try {
      if (!telegramId || typeof telegramId !== 'number') {
        throw new Error('Invalid telegramId: must be a number');
      }

      const cacheKey = `session:${telegramId}`;
      const deleted = this.cache.del(cacheKey);

      if (!deleted) {
        logger.info('Session not found for deletion', { telegramId, cacheKey });
        return false;
      }

      logger.info('Session deleted', { telegramId, cacheKey });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get the number of active sessions
   * @returns {number} - Number of active sessions
   */
  getActiveSessionCount() {
    try {
      const count = this.cache.keys().length;
      logger.info('Retrieved active session count', { count });
      return count;
    } catch (error) {
      logger.error('Failed to get active session count', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SessionManager();