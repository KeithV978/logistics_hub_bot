const axios = require('axios');
const config = require('../config/config');
const db = require('../config/database');
const { logger } = require('../utils/logger');

class UserService {
  /**
   * Start user registration process
   */
  static async startRegistration(telegramId, role) {
    try {
      const existingUser = await db.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already registered');
      }

      // Create temporary user record with just telegram_id and role
      await db.query(
        'INSERT INTO users (telegram_id, role) VALUES ($1, $2)',
        [telegramId, role]
      );

      return true;
    } catch (error) {
      logger.error('Start registration error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user registration details
   */
  static async updateRegistrationDetails(telegramId, details) {
    try {
      const { fullName, phoneNumber, bankAccount, vehicleType, nin, eligibilitySlipFileId } = details;
      
      const result = await db.query(
        `UPDATE users 
         SET full_name = $1, 
             phone_number = $2, 
             bank_name = $3,
             account_number = $4,
             account_name = $5,
             vehicle_type = $6,
             nin = $7,
             eligibility_slip_file_id = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $9
         RETURNING *`,
        [
          fullName, 
          phoneNumber, 
          bankAccount.bankName,
          bankAccount.accountNumber,
          bankAccount.accountName,
          vehicleType || null,
          nin,
          eligibilitySlipFileId,
          telegramId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update registration details error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Verify NIN using external API
   */
  static async verifyNIN(nin) {
    let retries = 0;
    while (retries < config.NIN_API_MAX_RETRIES) {
      try {
        const response = await axios.post(config.NIN_API_URL, {
          nin,
          apiKey: config.NIN_API_KEY
        });

        return response.data.isValid;
      } catch (error) {
        retries++;
        if (retries === config.NIN_API_MAX_RETRIES) {
          logger.error('NIN verification failed:', { nin, error: error.message });
          throw new Error('NIN verification service unavailable');
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  /**
   * Update user verification status
   */
  static async updateVerificationStatus(telegramId, status) {
    try {
      const result = await db.query(
        `UPDATE users 
         SET verification_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $2
         RETURNING *`,
        [status, telegramId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update verification status error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user profile
   */
  static async getUserProfile(telegramId) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get user profile error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user rating
   */
  static async updateUserRating(userId, newRating) {
    try {
      const user = await db.query(
        'SELECT rating, total_ratings FROM users WHERE id = $1',
        [userId]
      );

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentUser = user.rows[0];
      const totalRatings = currentUser.total_ratings + 1;
      const updatedRating = (
        (currentUser.rating * currentUser.total_ratings + newRating) / 
        totalRatings
      ).toFixed(2);

      const result = await db.query(
        `UPDATE users 
         SET rating = $1, 
             total_ratings = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [updatedRating, totalRatings, userId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Update user rating error:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Find nearby workers
   */
  static async findNearbyWorkers(location, role, radius) {
    try {
      const result = await db.query(
        `SELECT u.*, 
                ST_Distance(
                  location,
                  ST_MakePoint($1, $2)::geography
                ) / 1000 as distance
         FROM users u
         WHERE role = $3
         AND verification_status = 'verified'
         AND location IS NOT NULL
         AND last_location_update > NOW() - INTERVAL '15 minutes'
         AND ST_DWithin(
           location,
           ST_MakePoint($1, $2)::geography,
           $4 * 1000  -- Convert km to meters
         )
         ORDER BY distance`,
        [location.longitude, location.latitude, role, radius]
      );

      return result.rows;
    } catch (error) {
      logger.error('Find nearby workers error:', { location, role, error: error.message });
      throw error;
    }
  }

  /**
   * Update user's last known location
   */
  static async updateUserLocation(telegramId, location) {
    try {
      const result = await db.query(
        `UPDATE users 
         SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             last_location_update = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $3
         RETURNING *`,
        [location.longitude, location.latitude, telegramId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update user location error:', { telegramId, error: error.message });
      throw error;
    }
  }
}

module.exports = UserService;