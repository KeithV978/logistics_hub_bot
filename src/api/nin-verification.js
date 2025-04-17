/**
 * NIN Verification API client
 */
const axios = require('axios');
const logger = require('../utils/logger');
const { APIFailureError } = require('../utils/error-handler');

/**
 * Verify NIN using external API
 * @param {string} nin - National Identification Number
 * @returns {boolean} - True if NIN is valid, false otherwise
 */
const verifyNIN = async (nin) => {
  try {
    const apiKey = process.env.NIN_API_KEY;
    if (!apiKey) {
      throw new APIFailureError('NIN API key not configured');
    }

    logger.info('Initiating NIN verification', { nin: nin.substring(0, 4) + '****' });

    const response = await axios.post(
      'https://api.nin-verification-service.com/verify', // Hypothetical API endpoint
      { nin },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5 seconds timeout
      }
    );

    const { isValid } = response.data;
    logger.info('NIN verification completed', { isValid });

    return isValid === true;
  } catch (error) {
    logger.error(`NIN verification failed: ${error.message}`, {
      nin: nin.substring(0, 4) + '****',
      status: error.response?.status,
      response: error.response?.data,
    });

    // Retry logic for transient errors (e.g., 429, 503)
    if (error.response?.status === 429 || error.response?.status === 503) {
      logger.info('Retrying NIN verification due to transient error');
      try {
        const retryResponse = await axios.post(
          'https://api.nin-verification-service.com/verify',
          { nin },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );
        const { isValid } = retryResponse.data;
        logger.info('NIN verification retry successful', { isValid });
        return isValid === true;
      } catch (retryError) {
        logger.error(`NIN verification retry failed: ${retryError.message}`, {
          nin: nin.substring(0, 4) + '****',
        });
        throw new APIFailureError('NIN verification failed after retry');
      }
    }

    throw new APIFailureError('NIN verification service unavailable');
  }
};

module.exports = {
  verifyNIN,
};