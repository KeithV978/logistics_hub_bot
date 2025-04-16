const db = require('../database');
const geolocationService = require('./geolocation.service');
const { v4: uuidv4 } = require('uuid');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const createErrand = async (data) => {
  try {
    const errand = {
      errandId: uuidv4(),
      customerTelegramId: data.customerTelegramId,
      location: data.location,
      description: data.description,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.errands.insert(errand);
    return errand;
  } catch (error) {
    logger.error(`Error creating errand: ${error.message}`, { data });
    throw new CustomError('Failed to create errand', 'DatabaseError');
  }
};

const getErrand = async (errandId) => {
  try {
    const errand = await db.errands.findOne({ errandId });
    if (!errand) {
      throw new CustomError('Errand not found', 'NotFoundError');
    }
    return errand;
  } catch (error) {
    logger.error(`Error getting errand: ${error.message}`, { errandId });
    throw error;
  }
};

const updateErrand = async (errandId, updates) => {
  try {
    const errand = await db.errands.findOne({ errandId });
    if (!errand) {
      throw new CustomError('Errand not found', 'NotFoundError');
    }
    await db.errands.update(errandId, updates);
    return true;
  } catch (error) {
    logger.error(`Error updating errand: ${error.message}`, { errandId, updates });
    throw new CustomError('Failed to update errand', 'DatabaseError');
  }
};

const findNearbyErranders = async (location, radius) => {
  try {
    return await geolocationService.findUsersWithinRadius(location, radius, 'errander');
  } catch (error) {
    logger.error(`Error finding nearby erranders: ${error.message}`, { location, radius });
    throw new CustomError('Failed to find nearby erranders', 'GeolocationError');
  }
};

const assignErrander = async (errandId, erranderId) => {
  try {
    await updateErrand(errandId, { erranderId, status: 'accepted' });
    return true;
  } catch (error) {
    logger.error(`Error assigning errander: ${error.message}`, { errandId, erranderId });
    throw error;
  }
};

const updateErrandStatus = async (errandId, status) => {
  try {
    await updateErrand(errandId, { status });
    return true;
  } catch (error) {
    logger.error(`Error updating errand status: ${error.message}`, { errandId, status });
    throw error;
  }
};

module.exports = {
  createErrand,
  getErrand,
  updateErrand,
  findNearbyErranders,
  assignErrander,
  updateErrandStatus
};