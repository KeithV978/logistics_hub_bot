const config = require('../config/config');
const db = require('../config/database');
const logger = require('../utils/logger');
const GeolocationService = require('./geolocation');

class OrderService {
  /**
   * Create a new order or errand
   */
  static async createOrder(type, customerTelegramId, details) {
    try {
      const {
        pickupLocation,
        dropoffLocation,
        errandLocation,
        instructions
      } = details;

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
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
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
   * Get order by ID
   */
  static async getOrder(orderId) {
    try {
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
   * Create an offer for an order
   */
  static async createOffer(orderId, userId, price, vehicleType = null) {
    try {
      // Check if user already has an offer for this order
      const existingOffer = await db.query(
        'SELECT * FROM offers WHERE order_id = $1 AND user_id = $2',
        [orderId, userId]
      );

      if (existingOffer.rows.length > 0) {
        throw new Error('User already made an offer for this order');
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + config.OFFER_EXPIRY);

      const result = await db.query(
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

      return result.rows[0];
    } catch (error) {
      logger.error('Create offer error:', { orderId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get all offers for an order
   */
  static async getOffers(orderId) {
    try {
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
   * Accept an offer
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
         RETURNING *`,
        [offerId, orderId]
      );

      if (offerResult.rows.length === 0) {
        throw new Error('Offer not found');
      }

      // Update order status and set expiry for completion
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + config.TRANSACTION_EXPIRY);

      const orderResult = await client.query(
        `UPDATE orders
         SET status = 'active',
             expires_at = $1
         WHERE id = $2
         RETURNING *`,
        [expiresAt, orderId]
      );

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
   * Complete a transaction
   */
  static async completeTransaction(orderId, type) {
    try {
      if (!['payment_received', 'delivery_successful'].includes(type)) {
        throw new Error('Invalid completion type');
      }

      const result = await db.query(
        `UPDATE orders
         SET status = CASE
           WHEN (
             $1 = 'payment_received' AND 
             EXISTS (
               SELECT 1 FROM orders 
               WHERE id = $2 AND status = 'delivery_successful'
             )
           ) OR (
             $1 = 'delivery_successful' AND
             EXISTS (
               SELECT 1 FROM orders 
               WHERE id = $2 AND status = 'payment_received'
             )
           ) THEN 'completed'
           ELSE $1
         END
         WHERE id = $2
         RETURNING *`,
        [type, orderId]
      );

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Complete transaction error:', { orderId, type, error: error.message });
      throw error;
    }
  }

  /**
   * Add review for completed order
   */
  static async addReview(orderId, userId, customerTelegramId, rating, reviewText) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Add review
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
   * Get active orders for a worker
   */
  static async getActiveOrdersForWorker(userId) {
    try {
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
   * Cancel expired orders and offers
   */
  static async cleanupExpired() {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Cancel expired orders
      await client.query(
        `UPDATE orders
         SET status = 'cancelled'
         WHERE status IN ('pending', 'active')
         AND expires_at < CURRENT_TIMESTAMP`
      );

      // Expire pending offers
      await client.query(
        `UPDATE offers
         SET status = 'expired'
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