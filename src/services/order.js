const config = require('../config/config');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const GeolocationService = require('./geolocation');

class OrderService {
  /**
   * Create a new order or errand with validation
   */
  static async createOrder(type, customerTelegramId, details) {
    try {
      if (!['delivery', 'errand'].includes(type)) {
        throw new Error('Invalid order type');
      }

      if (!customerTelegramId) {
        throw new Error('Customer ID is required');
      }

      const {
        pickupLocation,
        dropoffLocation,
        errandLocation,
        instructions
      } = details;

      // Validate locations based on order type
      if (type === 'delivery') {
        if (!pickupLocation || !dropoffLocation) {
          throw new Error('Pickup and dropoff locations are required for delivery orders');
        }
        if (!GeolocationService.validateCoordinates(pickupLocation.latitude, pickupLocation.longitude) ||
            !GeolocationService.validateCoordinates(dropoffLocation.latitude, dropoffLocation.longitude)) {
          throw new Error('Invalid coordinates provided');
        }
      } else {
        if (!errandLocation) {
          throw new Error('Errand location is required for errand orders');
        }
        if (!GeolocationService.validateCoordinates(errandLocation.latitude, errandLocation.longitude)) {
          throw new Error('Invalid coordinates provided');
        }
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + config.ORDER_EXPIRY);

      const result = await db.query(
        `INSERT INTO orders (
          type,
          customer_telegram_id,
          pickup_location,
          dropoff_location,
          errand_location,
          instructions,
          expires_at,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *`,
        [
          type,
          customerTelegramId,
          pickupLocation,
          dropoffLocation,
          errandLocation,
          instructions,
          expiresAt
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Create order error:', { type, customerTelegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get order by ID with validation
   */
  static async getOrder(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const result = await db.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get order error:', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Create an offer for an order with validation
   */
  static async createOffer(orderId, userId, price, vehicleType = null) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate order exists and is pending
      const order = await client.query(
        'SELECT type, status FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (order.rows.length === 0) {
        throw new Error('Order not found');
      }

      if (order.rows[0].status !== 'pending') {
        throw new Error('Order is no longer accepting offers');
      }

      // Check if user already has an offer
      const existingOffer = await client.query(
        'SELECT * FROM offers WHERE order_id = $1 AND user_id = $2',
        [orderId, userId]
      );

      if (existingOffer.rows.length > 0) {
        throw new Error('User already made an offer for this order');
      }

      // Validate price
      if (!config.PRICE_REGEX.test(price.toString())) {
        throw new Error('Invalid price format');
      }

      // Validate vehicle type for delivery orders
      if (order.rows[0].type === 'delivery' && (!vehicleType || !config.VEHICLE_TYPES.includes(vehicleType))) {
        throw new Error('Valid vehicle type is required for delivery orders');
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + config.OFFER_EXPIRY);

      const result = await client.query(
        `INSERT INTO offers (
          order_id,
          user_id,
          price,
          vehicle_type,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [orderId, userId, price, vehicleType, expiresAt]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Create offer error:', { orderId, userId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all valid offers for an order
   */
  static async getOffers(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const result = await db.query(
        `SELECT o.*, u.full_name, u.rating
         FROM offers o
         JOIN users u ON o.user_id = u.id
         WHERE o.order_id = $1
         AND o.status = 'pending'
         AND o.expires_at > CURRENT_TIMESTAMP
         ORDER BY o.created_at ASC`,
        [orderId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Get offers error:', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Accept an offer with transaction and validation
   */
  static async acceptOffer(offerId, orderId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Update offer status
      const offerResult = await client.query(
        `UPDATE offers
         SET status = 'accepted'
         WHERE id = $1
         AND order_id = $2
         AND status = 'pending'
         AND expires_at > CURRENT_TIMESTAMP
         RETURNING *`,
        [offerId, orderId]
      );

      if (offerResult.rows.length === 0) {
        throw new Error('Offer not found or has expired');
      }

      // Update order status and set expiry for completion
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + config.TRANSACTION_EXPIRY);

      const orderResult = await client.query(
        `UPDATE orders
         SET status = 'active',
             expires_at = $1
         WHERE id = $2
         AND status = 'pending'
         RETURNING *`,
        [expiresAt, orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or is no longer pending');
      }

      // Reject all other offers
      await client.query(
        `UPDATE offers
         SET status = 'rejected'
         WHERE order_id = $1
         AND id != $2`,
        [orderId, offerId]
      );

      await client.query('COMMIT');
      return {
        offer: offerResult.rows[0],
        order: orderResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Accept offer error:', { offerId, orderId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Complete a transaction with validation
   */
  static async completeTransaction(orderId, type) {
    const client = await db.pool.connect();
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!['payment_received', 'delivery_successful'].includes(type)) {
        throw new Error('Invalid completion type');
      }

      await client.query('BEGIN');

      // First check if order exists and is active
      const orderCheck = await client.query(
        'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderCheck.rows.length === 0) {
        throw new Error('Order not found');
      }

      if (orderCheck.rows[0].status !== 'active' && orderCheck.rows[0].status !== type) {
        throw new Error(`Order is ${orderCheck.rows[0].status}`);
      }

      const result = await client.query(
        `UPDATE orders
         SET status = CASE
           WHEN (
             $1 = 'payment_received' AND 
             status = 'delivery_successful'
           ) OR (
             $1 = 'delivery_successful' AND
             status = 'payment_received'
           ) THEN 'completed'
           ELSE $1
         END,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [type, orderId]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Complete transaction error:', { orderId, type, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add review for completed order with validation
   */
  static async addReview(orderId, userId, customerTelegramId, rating, reviewText) {
    const client = await db.pool.connect();
    try {
      // Validate inputs
      if (!orderId || !userId || !customerTelegramId) {
        throw new Error('Order ID, user ID, and customer ID are required');
      }

      if (typeof rating !== 'number' || rating < config.MIN_RATING || rating > config.MAX_RATING) {
        throw new Error(`Rating must be between ${config.MIN_RATING} and ${config.MAX_RATING}`);
      }

      await client.query('BEGIN');

      // Check if order is completed
      const order = await client.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId]
      );

      if (order.rows.length === 0 || order.rows[0].status !== 'completed') {
        throw new Error('Can only review completed orders');
      }

      // Check if review already exists
      const existingReview = await client.query(
        'SELECT id FROM reviews WHERE order_id = $1',
        [orderId]
      );

      if (existingReview.rows.length > 0) {
        throw new Error('Order has already been reviewed');
      }

      const reviewResult = await client.query(
        `INSERT INTO reviews (
          order_id,
          user_id,
          customer_telegram_id,
          rating,
          review_text
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [orderId, userId, customerTelegramId, rating, reviewText]
      );

      // Update user's average rating
      await client.query(
        `UPDATE users
         SET rating = (
           SELECT AVG(rating)
           FROM reviews
           WHERE user_id = $1
         ),
         total_ratings = (
           SELECT COUNT(*)
           FROM reviews
           WHERE user_id = $1
         )
         WHERE id = $1`,
        [userId]
      );

      await client.query('COMMIT');
      return reviewResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Add review error:', { orderId, userId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active orders for a worker with validation
   */
  static async getActiveOrdersForWorker(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const result = await db.query(
        `SELECT o.*, of.price, of.vehicle_type
         FROM orders o
         JOIN offers of ON o.id = of.order_id
         WHERE of.user_id = $1
         AND o.status = 'active'
         ORDER BY o.created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Get active orders error:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel expired orders and offers with transaction
   */
  static async cleanupExpired() {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Cancel expired orders that are still pending or active
      await client.query(
        `UPDATE orders
         SET status = 'cancelled',
             updated_at = CURRENT_TIMESTAMP
         WHERE status IN ('pending', 'active')
         AND expires_at < CURRENT_TIMESTAMP`
      );

      // Expire pending offers
      await client.query(
        `UPDATE offers
         SET status = 'expired',
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'pending'
         AND expires_at < CURRENT_TIMESTAMP`
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Cleanup expired error:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = OrderService;