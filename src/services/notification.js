const config = require('../config/config');
const { logger } = require('../utils/logger');
const UserService = require('./user');
const GeolocationService = require('./geolocation');

class NotificationService {
  /**
   * Find and notify nearby workers about a new order/errand
   */
  static async notifyNearbyWorkers(bot, order, type) {
    try {
      let location;
      let initialRadius;
      let maxRadius;
      let radiusIncrement;
      let role;

      // Set search parameters based on order type
      if (type === 'delivery') {
        location = order.pickup_location;
        initialRadius = config.RIDER_INITIAL_RADIUS;
        maxRadius = config.RIDER_MAX_RADIUS;
        radiusIncrement = config.RIDER_RADIUS_INCREMENT;
        role = 'rider';
      } else {
        location = order.errand_location;
        initialRadius = config.ERRANDER_INITIAL_RADIUS;
        maxRadius = config.ERRANDER_MAX_RADIUS;
        radiusIncrement = config.ERRANDER_RADIUS_INCREMENT;
        role = 'errander';
      }

      // Find workers within initial radius
      let radius = initialRadius;
      let workers = await UserService.findNearbyWorkers(location, role, radius);
      let notificationCount = 0;
      const failedNotifications = [];

      // If no workers found, expand radius incrementally
      while (workers.length === 0 && radius < maxRadius) {
        radius += radiusIncrement;
        workers = await UserService.findNearbyWorkers(location, role, radius);
      }

      if (workers.length === 0) {
        await this.retryNotification(bot, order.customer_telegram_id, 
          `No ${role}s available within ${maxRadius}km. Please try again later.`
        );
        return 0;
      }

      // Prepare order details message
      const orderDetails = this.formatOrderDetails(order, type);

      // Notify each worker with retries
      for (const worker of workers) {
        try {
          await this.retryNotification(bot, worker.telegram_id, orderDetails, { parse_mode: 'HTML' });
          notificationCount++;
        } catch (error) {
          logger.error('Worker notification failed after retries:', {
            workerId: worker.telegram_id,
            orderId: order.id,
            error: error.message
          });
          failedNotifications.push(worker.telegram_id);
        }
      }

      // Notify customer about found workers
      const notificationMsg = notificationCount > 0 
        ? `${notificationCount} ${role}s have been notified about your ${type}. Please wait for their offers.`
        : `Sorry, we couldn't reach any ${role}s at the moment. Please try again later.`;

      await this.retryNotification(bot, order.customer_telegram_id, notificationMsg);

      // Log failed notifications for monitoring
      if (failedNotifications.length > 0) {
        logger.warn('Some notifications failed:', {
          orderId: order.id,
          failedWorkerIds: failedNotifications
        });
      }

      return notificationCount;
    } catch (error) {
      logger.error('Notify nearby workers error:', { 
        orderId: order.id, 
        type,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Retry notification with exponential backoff
   */
  static async retryNotification(bot, chatId, message, options = {}) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await bot.telegram.sendMessage(chatId, message, options);
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error; // Last attempt failed
        }
        
        // Wait with exponential backoff before retrying
        await new Promise(resolve => 
          setTimeout(resolve, baseDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  /**
   * Notify worker about offer acceptance with retries
   */
  static async notifyWorkerOfferAccepted(bot, offer, order) {
    try {
      await this.retryNotification(
        bot,
        offer.telegram_id,
        `Your offer for ${order.type} #${order.id} has been accepted! A group chat will be created shortly.`
      );
    } catch (error) {
      logger.error('Notify worker offer accepted error:', {
        workerId: offer.telegram_id,
        orderId: order.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Notify other workers about offer rejection with retries
   */
  static async notifyOtherWorkersOfferRejected(bot, orderId, acceptedWorkerId) {
    const failedNotifications = [];

    try {
      const offers = await OrderService.getOffers(orderId);
      for (const offer of offers) {
        if (offer.user_id !== acceptedWorkerId) {
          try {
            await this.retryNotification(
              bot,
              offer.telegram_id,
              `The order #${orderId} has been taken by another worker.`
            );
          } catch (error) {
            logger.error('Notify worker offer rejected error:', {
              workerId: offer.telegram_id,
              orderId,
              error: error.message
            });
            failedNotifications.push(offer.telegram_id);
          }
        }
      }

      // Log failed notifications for monitoring
      if (failedNotifications.length > 0) {
        logger.warn('Some rejection notifications failed:', {
          orderId,
          failedWorkerIds: failedNotifications
        });
      }
    } catch (error) {
      logger.error('Notify other workers error:', {
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format order details for notification message
   */
  static formatOrderDetails(order, type) {
    let message = `🆕 New ${type} request!\n\n`;

    if (type === 'delivery') {
      message += `📍 <b>Pickup:</b> ${order.pickup_location.formattedAddress}\n`;
      message += `🏁 <b>Drop-off:</b> ${order.dropoff_location.formattedAddress}\n`;
    } else {
      message += `📍 <b>Location:</b> ${order.errand_location.formattedAddress}\n`;
    }

    message += `📝 <b>Instructions:</b> ${order.instructions || 'None'}\n\n`;
    message += `Use /make_offer ${order.id} [price] ${type === 'delivery' ? '[vehicle_type]' : ''} to submit an offer.`;

    return message;
  }
}

module.exports = NotificationService;