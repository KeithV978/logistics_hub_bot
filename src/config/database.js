require('dotenv').config(); 
// const { required } = require('joi');
const path = require('path');
const { Sequelize } = require('sequelize');
const { logger } = require('../utils/logger');
// const config = require('../../config/database');

// Get database configuration from environment variables
const { 
  DB_HOST = 'localhost',
    DB_PORT = 5432, 
DATABASE_URL
} = process.env;

// Create Sequelize instance
const sequelize = new Sequelize(DATABASE_URL, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

const db = {};

// Import all models
const models = [
  '../db/models/user.model.js',
  '../db/models/order.model.js',
  '../db/models/errand.model.js', 
  '../db/models/group.model.js',
  '../db/models/session.model.js',
  '../db/models/tracking.model.js', 
];

models.forEach(model => {
  const modelPath = path.join(__dirname, model);
  const modelDefinition = require(modelPath)(sequelize);
  db[modelDefinition.name] = modelDefinition;
});

// Define associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Set up specific model associations

// User associations
db.User.hasMany(db.Order, { foreignKey: 'riderId', as: 'orders' });
db.User.hasMany(db.Errand, { foreignKey: 'erranderId', as: 'errands' });
db.User.hasMany(db.Tracking, { foreignKey: 'userId', as: 'trackings' });
db.User.hasMany(db.Group, { foreignKey: 'userId', as: 'groups' });
// db.User.hasMany(db.Offer, { foreignKey: 'userId', as: 'offers' });
// db.User.hasMany(db.Rating, { foreignKey: 'userId', as: 'ratings' });

// Order associations
db.Order.belongsTo(db.User, { foreignKey: 'riderId', as: 'rider' });
db.Order.hasOne(db.Group, { foreignKey: 'orderId', as: 'group' });
db.Order.hasMany(db.Tracking, { foreignKey: 'orderId', as: 'trackings' });
// db.Order.hasMany(db.Offer, { foreignKey: 'orderId', as: 'offers' });
// db.Order.hasOne(db.Rating, { foreignKey: 'orderId', as: 'rating' });

// Errand associations
db.Errand.belongsTo(db.User, { foreignKey: 'erranderId', as: 'errander' });
db.Errand.hasOne(db.Group, { foreignKey: 'errandId', as: 'group' });
db.Errand.hasMany(db.Tracking, { foreignKey: 'errandId', as: 'trackings' });
// db.Errand.hasMany(db.Offer, { foreignKey: 'errandId', as: 'offers' });
// db.Errand.hasOne(db.Rating, { foreignKey: 'errandId', as: 'rating' });

// Offer associations
// db.Offer.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
// db.Offer.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
// db.Offer.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });

// Group associations
db.Group.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
db.Group.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });
db.Group.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

// // Tracking associations
db.Tracking.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
db.Tracking.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
db.Tracking.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });

// Rating associations
// db.Rating.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
// db.Rating.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
// db.Rating.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection
};

// /**
//  * PostgreSQL database connection configuration with retry logic
//  */
// const { Pool } = require('pg');
// const logger = require('../utils/logger');

// /**
//  * Configure and connect to PostgreSQL with retry logic
//  * @returns {Object} - PostgreSQL connection pool instance
//  */
// const configureDatabase = async () => {
//   try {
//     const config = {
//       user: process.env.DB_USER,
//       host: process.env.DB_HOST,
//       port: process.env.DB_PORT || 5432,
//       password: process.env.DB_PASSWORD,
//       database: process.env.DB_NAME,
//       max: 20, // Maximum number of clients in the pool
//       idleTimeoutMillis: 30000, // 30 seconds idle timeout
//       connectionTimeoutMillis: 5000, // 5 seconds connection timeout
//     };

//     // Validate required environment variables
//     const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
//     const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
//     if (missingVars.length > 0) {
//       console.log(`Missing environment variables: ${missingVars.join(', ')}`);
//       throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
//     }

//     logger.info('Configuring PostgreSQL connection', { host: config.host, database: config.database });

//     // Retry options
//     const retryOptions = {
//       retries: 5, // Maximum retry attempts
//       minDelay: 100, // Initial delay in milliseconds
//       maxDelay: 5000, // Maximum delay in milliseconds
//       factor: 2, // Exponential backoff factor
//     };

//     let pool;
//     let attempt = 0;

//     // Retry connection logic
//     while (attempt < retryOptions.retries) {
//       try {
//         pool = new Pool(config);
        
//         // Test connection
//         const client = await pool.connect();
//         logger.info('PostgreSQL connected successfully', { host: config.host, database: config.database });
//         client.release();

//         // Event handlers
//         pool.on('connect', () => {
//           logger.info('PostgreSQL client connected');
//         });

//         pool.on('error', (error) => {
//           logger.error('PostgreSQL pool error', { error: error.message });
//         });

//         pool.on('remove', () => {
//           logger.warn('PostgreSQL client removed from pool');
//         });

//         return pool;
//       } catch (error) {
//         attempt++;
//         logger.error(`PostgreSQL connection attempt ${attempt} failed`, { error: error.message });

//         if (attempt >= retryOptions.retries) {
//           logger.error('PostgreSQL connection failed after maximum retries');
//           throw new Error('Failed to connect to PostgreSQL after maximum retries');
//         }

//         // Calculate delay with exponential backoff
//         const delay = Math.min(
//           retryOptions.minDelay * Math.pow(retryOptions.factor, attempt - 1),
//           retryOptions.maxDelay
//         );

//         logger.info(`Retrying PostgreSQL connection in ${delay}ms`, { attempt: attempt + 1 });
//         await new Promise(resolve => setTimeout(resolve, delay));
//       }
//     }
//   } catch (error) {
//     logger.error('Database configuration failed', { error: error.message });
//     throw error;
//   }
// };

// /**
//  * Get PostgreSQL pool instance (for consistency with previous API)
//  * @returns {Object} - PostgreSQL pool instance
//  */
// const getPool = async () => {
//   return await configureDatabase();
// };

// module.exports = {
//   configureDatabase,
//   getPool,
// };