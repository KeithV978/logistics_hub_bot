/**
 * Authentication middleware for Express
 */
const CustomError = require('../utils/error-handler').CustomError;
const logger = require('../utils/logger');
const db = require('../config/database');
const crypto = require('crypto');
const constants = require('../utils/constants');

/**
 * Verify Telegram webhook authenticity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyTelegramWebhook = (req, res, next) => {
  try {
    const secret = process.env.TELEGRAM_BOT_TOKEN;
    const receivedSignature = req.headers['x-telegram-bot-api-secret-token'];

    if (!receivedSignature) {
      throw new CustomError('Missing Telegram webhook signature', 'AuthError');
    }

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (receivedSignature !== computedSignature) {
      throw new CustomError('Invalid Telegram webhook signature', 'AuthError');
    }

    logger.info('Telegram webhook verified successfully');
    next();
  } catch (error) {
    logger.error(`Webhook verification failed: ${error.message}`, {
      headers: req.headers,
    });
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Check if user is authenticated and verified for specific roles
 * @param {Array<string>} allowedRoles - Allowed roles (e.g., ['rider', 'errander'])
 */
const requireAuth = (allowedRoles = []) => async (req, res, next) => {
  try {
    const telegramId = req.body?.message?.from?.id || req.body?.callback_query?.from?.id;
    if (!telegramId) {
      throw new CustomError('Missing Telegram user ID', 'AuthError');
    }

    const user = await db.users.findOne({ telegramId });
    if (!user) {
      throw new CustomError('User not found', 'NotFoundError');
    }

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      throw new CustomError(`Access restricted to ${allowedRoles.join(' or ')} roles`, 'AuthError');
    }

    if (allowedRoles.includes(constants.ROLES.RIDER) || allowedRoles.includes(constants.ROLES.ERRANDER)) {
      if (!user.isVerified) {
        throw new CustomError('User not verified', 'UserNotVerifiedError');
      }
    }

    req.user = user;
    logger.info(`User authenticated: ${telegramId}`, { role: user.role });
    next();
  } catch (error) {
    logger.error(`Authentication failed: ${error.message}`, { telegramId });
    res.status(403).json({ error: error.message });
  }
};

module.exports = {
  verifyTelegramWebhook,
  requireAuth,
};