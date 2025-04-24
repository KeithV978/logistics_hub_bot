const db = require('../config/database');
const { logger } = require('../utils/logger');

class CustomerService {
  /**
   * Start customer registration process
   */
  static async startRegistration(telegramId) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      const existingCustomer = await db.query(
        'SELECT * FROM customers WHERE telegram_id = $1',
        [telegramId]
      );

      if (existingCustomer.rows.length > 0) {
        throw new Error('Customer already registered');
      }

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
   * Update customer registration details with validation
   */
  static async updateRegistrationDetails(telegramId, details) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      const { fullName, email, phoneNumber, bankAccount, defaultAddress } = details;
      
      // Validate inputs
      if (!fullName || fullName.trim().length === 0) {
        throw new Error('Full name is required');
      }

      if (!email || !this.validateEmail(email)) {
        throw new Error('Valid email is required');
      }

      if (!phoneNumber || !config.PHONE_REGEX.test(phoneNumber)) {
        throw new Error('Valid phone number is required');
      }

      if (!bankAccount || !bankAccount.bankName || !bankAccount.accountNumber || !bankAccount.accountName) {
        throw new Error('Complete bank account details are required');
      }

      // Validate defaultAddress if provided
      if (defaultAddress) {
        if (defaultAddress.type === 'coordinates') {
          if (!GeolocationService.validateCoordinates(defaultAddress.latitude, defaultAddress.longitude)) {
            throw new Error('Invalid coordinates provided');
          }
        } else if (defaultAddress.type === 'text') {
          if (!defaultAddress.address || defaultAddress.address.trim().length === 0) {
            throw new Error('Address text cannot be empty');
          }
        } else {
          throw new Error('Invalid address type');
        }
      }

      // First check if customer exists
      const existingCustomer = await db.query(
        'SELECT id FROM customers WHERE telegram_id = $1',
        [telegramId]
      );

      if (existingCustomer.rows.length === 0) {
        throw new Error('Customer not found');
      }

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
        throw new Error('Failed to update customer details');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update customer details error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get customer profile with cache
   */
  static async getCustomerProfile(telegramId) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

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
   * Update customer default address with validation
   */
  static async updateDefaultAddress(telegramId, address) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      if (!address) {
        throw new Error('Address is required');
      }

      // Validate address format
      if (address.type === 'coordinates') {
        if (!GeolocationService.validateCoordinates(address.latitude, address.longitude)) {
          throw new Error('Invalid coordinates provided');
        }
      } else if (address.type === 'text') {
        if (!address.address || address.address.trim().length === 0) {
          throw new Error('Address text cannot be empty');
        }
      } else {
        throw new Error('Invalid address type');
      }

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
   * Get customer order history with pagination
   */
  static async getOrderHistory(telegramId, page = 1, limit = 10) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      const offset = (page - 1) * limit;

      const result = await db.query(
        `SELECT o.*, r.rating, r.review_text
         FROM orders o
         LEFT JOIN reviews r ON o.id = r.order_id
         WHERE o.customer_telegram_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2 OFFSET $3`,
        [telegramId, limit, offset]
      );

      // Get total count for pagination
      const countResult = await db.query(
        'SELECT COUNT(*) FROM orders WHERE customer_telegram_id = $1',
        [telegramId]
      );

      return {
        orders: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      };
    } catch (error) {
      logger.error('Get customer order history error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
}

module.exports = CustomerService;