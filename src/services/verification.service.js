const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const verifyNIN = async (nin) => {
  try {
    // Assume externalNINApi is a module for NIN verification
    const isValid = await externalNINApi.verify(nin);
    return isValid;
  } catch (error) {
    logger.error(`Error verifying NIN: ${error.message}`, { nin });
    throw new CustomError('Failed to verify NIN', 'VerificationError');
  }
};

module.exports = {
  verifyNIN
};