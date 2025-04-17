/**
 * Webhook router for Telegram updates
 */
const express = require('express');
const { verifyTelegramWebhook, requireAuth } = require('../middleware/auth.middleware');
const { validateTelegramMessage } = require('../middleware/validation.middleware');
const messageWebhook = require('./message.webhook');
const locationWebhook = require('./location.webhook');
const callbackWebhook = require('./callback.webhook');
const errorMiddleware = require('../middleware/error.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// Main webhook endpoint for Telegram updates
router.post(
  '/',
  verifyTelegramWebhook, // Verify webhook authenticity
  validateTelegramMessage, // Validate message structure
  (req, res, next) => {
    try {
      const update = req.body;
      logger.info('Received Telegram webhook update', { updateId: update.update_id });

      // Route to specific handlers based on update type
      if (update.message) {
        if (update.message.location) {
          return locationWebhook.handleLocationUpdate(req, res, next);
        }
        return messageWebhook.handleMessage(req, res, next);
      } else if (update.callback_query) {
        return callbackWebhook.handleCallbackQuery(req, res, next);
      } else {
        logger.warn('Unsupported update type', { update });
        res.sendStatus(200); // Acknowledge unsupported update
      }
    } catch (error) {
      next(error); // Pass to error middleware
    }
  }
);

// Apply error middleware
router.use(errorMiddleware);

module.exports = router;