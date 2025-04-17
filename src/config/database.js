/**
 * PostgreSQL database connection configuration with retry logic
 */
const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * Configure and connect to PostgreSQL with retry logic
 * @returns {Object} - PostgreSQL connection pool instance
 */
const configureDatabase = async () => {
  try {
    const config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // 30 seconds idle timeout
      connectionTimeoutMillis: 5000, // 5 seconds connection timeout
    };

    // Validate required environment variables
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    logger.info('Configuring PostgreSQL connection', { host: config.host, database: config.database });

    // Retry options
    const retryOptions = {
      retries: 5, // Maximum retry attempts
      minDelay: 100, // Initial delay in milliseconds
      maxDelay: 5000, // Maximum delay in milliseconds
      factor: 2, // Exponential backoff factor
    };

    let pool;
    let attempt = 0;

    // Retry connection logic
    while (attempt < retryOptions.retries) {
      try {
        pool = new Pool(config);
        
        // Test connection
        const client = await pool.connect();
        logger.info('PostgreSQL connected successfully', { host: config.host, database: config.database });
        client.release();

        // Event handlers
        pool.on('connect', () => {
          logger.info('PostgreSQL client connected');
        });

        pool.on('error', (error) => {
          logger.error('PostgreSQL pool error', { error: error.message });
        });

        pool.on('remove', () => {
          logger.warn('PostgreSQL client removed from pool');
        });

        return pool;
      } catch (error) {
        attempt++;
        logger.error(`PostgreSQL connection attempt ${attempt} failed`, { error: error.message });

        if (attempt >= retryOptions.retries) {
          logger.error('PostgreSQL connection failed after maximum retries');
          throw new Error('Failed to connect to PostgreSQL after maximum retries');
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryOptions.minDelay * Math.pow(retryOptions.factor, attempt - 1),
          retryOptions.maxDelay
        );

        logger.info(`Retrying PostgreSQL connection in ${delay}ms`, { attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } catch (error) {
    logger.error('Database configuration failed', { error: error.message });
    throw error;
  }
};

/**
 * Get PostgreSQL pool instance (for consistency with previous API)
 * @returns {Object} - PostgreSQL pool instance
 */
const getPool = async () => {
  return await configureDatabase();
};

module.exports = {
  configureDatabase,
  getPool,
};