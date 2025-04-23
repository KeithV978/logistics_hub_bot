const db = require('../config/database');
const { logger } = require('../utils/logger');

class CustomerService {
  /**
   * Start customer registration process
   */
  static async startRegistration(telegramId) {
    try {
      const existingCustomer = await db.query(
        'SELECT * FROM customers WHERE telegram_id = $1',
        [telegramId]
      );

      if (existingCustomer.rows.length > 0) {
        throw new Error('Customer already registered');
      }

      // Create initial customer record with telegram_id
      await db.query(
        'INSERT INTO customers (telegram_id) VALUES ($1)',
        [telegramId]
      );

      return true;
    } catch (error) {
      logger.error('Start customer registration error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Update customer registration details
   */
  static async updateRegistrationDetails(telegramId, details) {
    try {
      const { fullName, email, phoneNumber, bankAccount, defaultAddress } = details;
      
      const result = await db.query(
        `UPDATE customers 
         SET full_name = $1,
             email = $2,
             phone_number = $3,
             bank_name = $4,
             account_number = $5,
             account_name = $6,
             default_address = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $8
         RETURNING *`,
        [
          fullName,
          email,
          phoneNumber,
          bankAccount.bankName,
          bankAccount.accountNumber,
          bankAccount.accountName,
          defaultAddress,
          telegramId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Customer not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update customer details error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get customer profile
   */
  static async getCustomerProfile(telegramId) {
    try {
      const result = await db.query(
        'SELECT * FROM customers WHERE telegram_id = $1',
        [telegramId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get customer profile error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Update customer default address
   */
  static async updateDefaultAddress(telegramId, address) {
    try {
      const result = await db.query(
        `UPDATE customers 
         SET default_address = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING *`,
        [address, telegramId]
      );

      if (result.rows.length === 0) {
        throw new Error('Customer not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update customer address error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get customer order history
   */
  static async getOrderHistory(telegramId) {
    try {
      const result = await db.query(
        `SELECT o.*, r.rating, r.review_text
         FROM orders o
         LEFT JOIN reviews r ON o.id = r.order_id
         WHERE o.customer_telegram_id = $1
         ORDER BY o.created_at DESC`,
        [telegramId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Get customer order history error:', { telegramId, error: error.message });
      throw error;
    }
  }
}

module.exports = CustomerService;