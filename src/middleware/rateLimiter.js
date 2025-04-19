const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('../utils/errors');

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware function
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // Limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later',
    keyGenerator = (req) => req.ip, // Use IP as default key
    handler = (req, res) => {
      throw new RateLimitError(message);
    }
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    keyGenerator,
    handler,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
};

// Create specific rate limiters
const authLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: 'Too many login attempts, please try again later',
  keyGenerator: (req) => req.body.telegramId || req.ip,
});

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
});

const createOrderLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 orders per hour
  keyGenerator: (req) => req.user?.telegramId || req.ip,
});

const createErrandLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 errands per hour
  keyGenerator: (req) => req.user?.telegramId || req.ip,
});

module.exports = {
  createRateLimiter,
  authLimiter,
  apiLimiter,
  createOrderLimiter,
  createErrandLimiter
}; 