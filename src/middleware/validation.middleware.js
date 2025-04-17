/**
 * Input validation middleware for Express
 */
const Joi = require('joi');
const { validateLocation, validatePhone, validateNIN, validatePrice } = require('../utils/validators');
const { InvalidInputError } = require('../utils/error-handler');
const logger = require('../utils/logger');

/**
 * Validate request body using a Joi schema
 * @param {Object} schema - Joi schema for validation
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new InvalidInputError(errorMessage);
    }
    next();
  } catch (error) {
    logger.error(`Validation failed: ${error.message}`, {
      body: req.body,
    });
    res.status(400).json({ error: error.message });
  }
};

/**
 * Specific validation for Telegram message inputs
 */
const validateTelegramMessage = (req, res, next) => {
  try {
    const message = req.body?.message || req.body?.callback_query;
    if (!message) {
      throw new InvalidInputError('Missing Telegram message or callback query');
    }

    const telegramId = message.from?.id;
    if (!telegramId) {
      throw new InvalidInputError('Missing Telegram user ID');
    }

    // Validate location if present
    if (message.location) {
      const { error } = validateLocation({
        lat: message.location.latitude,
        lng: message.location.longitude,
        address: message.text || '',
      });
      if (error) {
        throw new InvalidInputError(`Invalid location: ${error.message}`);
      }
    }

    // Validate command-specific inputs (e.g., /offer)
    if (message.text?.startsWith('/offer')) {
      const [, taskId, price, vehicleType] = message.text.split(' ');
      if (!taskId || !price) {
        throw new InvalidInputError('Offer command requires task ID and price');
      }
      const { error: priceError } = validatePrice(Number(price));
      if (priceError) {
        throw new InvalidInputError(`Invalid price: ${priceError.message}`);
      }
    }

    next();
  } catch (error) {
    logger.error(`Telegram message validation failed: ${error.message}`, {
      body: req.body,
    });
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  validateRequest,
  validateTelegramMessage,
};