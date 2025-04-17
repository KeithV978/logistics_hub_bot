/**
 * External API configurations (NIN Verification and Google Maps)
 */
const logger = require('../utils/logger');

/**
 * Configure external API settings
 * @returns {Object} - External APIs configuration object
 */
const configureExternalApis = () => {
  try {
    const ninApiKey = process.env.NIN_API_KEY;
    const geolocationApiKey = process.env.GEOLOCATION_API_KEY;

    if (!ninApiKey) {
      throw new Error('NIN_API_KEY environment variable is not set');
    }
    if (!geolocationApiKey) {
      throw new Error('GEOLOCATION_API_KEY environment variable is not set');
    }

    logger.info('Configuring external APIs');

    const config = {
      ninVerification: {
        apiKey: ninApiKey,
        baseUrl: 'https://api.nin-verification-service.com', // Hypothetical NIN API URL
        timeout: 5000, // 5 seconds timeout
      },
      googleMaps: {
        apiKey: geolocationApiKey,
        geocodeUrl: 'https://maps.googleapis.com/maps/api/geocode/json',
        distanceMatrixUrl: 'https://maps.googleapis.com/maps/api/distancematrix/json',
        timeout: 5000, // 5 seconds timeout
      },
    };

    logger.info('External APIs configuration loaded successfully');
    return config;
  } catch (error) {
    logger.error('External APIs configuration failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  configureExternalApis,
};