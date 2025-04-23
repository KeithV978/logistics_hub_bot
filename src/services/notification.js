const config = require('../config/config');
const logger = require('../utils/logger');
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
      let retries = 0;

      // If no workers found, expand radius incrementally
      while (workers.length === 0 && radius < maxRadius) {
        radius += radiusIncrement;
        workers = await UserService.findNearbyWorkers(location, role, radius);
      }

      if (workers.length === 0) {
        await bot.telegram.sendMessage(
          order.customer_telegram_id,
          `No ${role}s available within ${maxRadius}km. Please try again later.`
        );
        return 0;
      }

      // Prepare order details message
      const orderDetails = this.formatOrderDetails(order, type);

      // Notify each worker
      for (const worker of workers) {
        try {
          await bot.telegram.sendMessage(
            worker.telegram_id,
            orderDetails,
            { parse_mode: 'HTML' }
          );
          notificationCount++;
        } catch (error) {
          logger.error('Worker notification error:', {
            workerId: worker.telegram_id,
            orderId: order.id,
            error: error.message
          });

          // Retry failed notifications
          if (retries < 3) {
            retries++;
            try {
              await bot.telegram.sendMessage(
                worker.telegram_id,
                orderDetails,
                { parse_mode: 'HTML' }
              );
              notificationCount++;
            } catch (retryError) {
              logger.error('Worker notification retry failed:', {
                workerId: worker.telegram_id,
                orderId: order.id,
                error: retryError.message
              });
            }
          }
        }
      }

      // Notify customer about found workers
      await bot.telegram.sendMessage(
        order.customer_telegram_id,
        `${notificationCount} ${role}s have been notified about your ${type}. Please wait for their offers.`
      );

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

  /**
   * Notify worker about offer acceptance
   */
  static async notifyWorkerOfferAccepted(bot, offer, order) {
    try {
      await bot.telegram.sendMessage(
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
   * Notify other workers about offer acceptance
   */
  static async notifyOtherWorkersOfferRejected(bot, orderId, acceptedWorkerId) {
    try {
      const offers = await OrderService.getOffers(orderId);
      for (const offer of offers) {
        if (offer.user_id !== acceptedWorkerId) {
          try {
            await bot.telegram.sendMessage(
              offer.telegram_id,
              `The order #${orderId} has been taken by another worker.`
            );
          } catch (error) {
            logger.error('Notify worker offer rejected error:', {
              workerId: offer.telegram_id,
              orderId,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      logger.error('Notify other workers error:', {
        orderId,
        error: error.message
      });
    }
  }
}

module.exports = NotificationService;