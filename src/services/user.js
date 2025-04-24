const axios = require('axios');
const config = require('../config/config');
const db = require('../config/database');
const { logger } = require('../utils/logger');

class UserService {
  /**
   * Start user registration process with role validation
   */
  static async startRegistration(telegramId, role) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      if (!role || !['rider', 'errander'].includes(role)) {
        throw new Error('Invalid role specified');
      }

      const existingUser = await db.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already registered');
      }

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
   * Update user registration details with validation
   */
  static async updateRegistrationDetails(telegramId, details) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      const { 
        fullName, 
        phoneNumber, 
        bankAccount, 
        vehicleType, 
        nin, 
        eligibilitySlipFileId,
        verificationStatus 
      } = details;

      // Validate required fields
      if (!fullName || fullName.trim().length === 0) {
        throw new Error('Full name is required');
      }

      if (!phoneNumber || !config.PHONE_REGEX.test(phoneNumber)) {
        throw new Error('Valid phone number is required');
      }

      if (!bankAccount || !bankAccount.bankName || !bankAccount.accountNumber || !bankAccount.accountName) {
        throw new Error('Complete bank account details are required');
      }

      if (!nin || nin.trim().length === 0) {
        throw new Error('NIN is required');
      }

      if (!eligibilitySlipFileId) {
        throw new Error('Eligibility slip document is required');
      }

      // Check user exists and get their role
      const existingUser = await db.query(
        'SELECT role FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (existingUser.rows.length === 0) {
        throw new Error('User not found');
      }

      // Validate vehicle type for riders
      if (existingUser.rows[0].role === 'rider') {
        if (!vehicleType || !config.VEHICLE_TYPES.includes(vehicleType)) {
          throw new Error('Valid vehicle type is required for riders');
        }
      }

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
             verification_status = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_id = $10
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
          verificationStatus || 'pending',
          telegramId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to update user details');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Update registration details error:', { telegramId, error: error.message });
      throw error;
    }
  }

  /**
   * Verify NIN using external API with retry and rate limiting
   */
  static async verifyNIN(nin) {
    let retries = 0;
    let lastAttemptTime = 0;
    const minInterval = 1000; // Minimum 1 second between API calls

    while (retries < config.NIN_API_MAX_RETRIES) {
      try {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastAttempt = now - lastAttemptTime;
        if (timeSinceLastAttempt < minInterval) {
          await new Promise(resolve => 
            setTimeout(resolve, minInterval - timeSinceLastAttempt)
          );
        }

        lastAttemptTime = Date.now();
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
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * Math.pow(2, retries))
        );
      }
    }
  }

  /**
   * Update user verification status with validation
   */
  static async updateVerificationStatus(telegramId, status) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      if (!['pending', 'pending_manual', 'verified', 'rejected'].includes(status)) {
        throw new Error('Invalid verification status');
      }

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
   * Get user profile with caching
   */
  static async getUserProfile(telegramId) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

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
   * Update user rating with validation and transaction
   */
  static async updateUserRating(userId, newRating) {
    const client = await db.pool.connect();
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (typeof newRating !== 'number' || 
          newRating < config.MIN_RATING || 
          newRating > config.MAX_RATING) {
        throw new Error(`Rating must be between ${config.MIN_RATING} and ${config.MAX_RATING}`);
      }

      await client.query('BEGIN');

      const user = await client.query(
        'SELECT rating, total_ratings FROM users WHERE id = $1 FOR UPDATE',
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

      const result = await client.query(
        `UPDATE users 
         SET rating = $1, 
             total_ratings = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [updatedRating, totalRatings, userId]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Update user rating error:', { userId, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find nearby workers with spatial query and validation
   */
  static async findNearbyWorkers(location, role, radius) {
    try {
      if (!location || !GeolocationService.validateCoordinates(location.latitude, location.longitude)) {
        throw new Error('Invalid location coordinates');
      }

      if (!['rider', 'errander'].includes(role)) {
        throw new Error('Invalid worker role');
      }

      if (typeof radius !== 'number' || radius <= 0) {
        throw new Error('Radius must be a positive number');
      }

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
   * Update user's last known location with validation
   */
  static async updateUserLocation(telegramId, location) {
    try {
      if (!telegramId) {
        throw new Error('Telegram ID is required');
      }

      if (!location || !GeolocationService.validateCoordinates(location.latitude, location.longitude)) {
        throw new Error('Invalid location coordinates');
      }

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