const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler, notFoundHandler } = require('./src/utils/error-handler');
const { logger, stream } = require('./src/utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const sequelize = require('./src/config/');

// Create Express app
const app = express();

// Apply security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
app.use(apiLimiter);

// Apply logging
app.use(morgan('combined', { stream }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes
app.use('/api/users', require('./src/routes/users'));
// app.use('/api/orders', require('./routes/orders'));
// app.use('/api/errands', require('./routes/errands'));
// app.use('/api/offers', require('./routes/offers'));
// app.use('/api/payments', require('./routes/payments'));
// app.use('/api/reviews', require('./routes/reviews'));
// app.use('/api/notifications', require('./routes/notifications'));
// app.use('/api/settings', require('./routes/settings'));

// Apply error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection and server startup
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    
    // Sync database models
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized.');
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal. Closing HTTP server and database connection...');
  
  // Close database connection
  await sequelize.close();
  logger.info('Database connection closed.');
  
  process.exit(0);
};

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();

module.exports = app; 