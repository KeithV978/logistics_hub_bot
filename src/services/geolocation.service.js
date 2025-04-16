const db = require('../database');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const findUsersWithinRadius = async (location, radius, role) => {
  try {
    const users = await db.users.find({ role, isVerified: true });
    const nearbyUsers = [];
    for (const user of users) {
      if (user.lastKnownLocation) {
        const distance = await calculateDistance(location, user.lastKnownLocation);
        if (distance <= radius) {
          nearbyUsers.push(user);
        }
      }
    }
    return nearbyUsers;
  } catch (error) {
    logger.error(`Error finding users within radius: ${error.message}`, { location, radius, role });
    throw new CustomError('Failed to find users within radius', 'GeolocationError');
  }
};

const calculateDistance = async (location1, location2) => {
  try {
    // Assume externalGeolocationApi provides distance calculation
    const distance = await externalGeolocationApi.calculateDistance(location1, location2);
    return distance;
  } catch (error) {
    logger.error(`Error calculating distance: ${error.message}`, { location1, location2 });
    throw new CustomError('Failed to calculate distance', 'GeolocationError');
  }
};

const getCoordinates = async (address) => {
  try {
    // Assume externalGeolocationApi provides geocoding
    const coordinates = await externalGeolocationApi.getCoordinates(address);
    return coordinates;
  } catch (error) {
    logger.error(`Error getting coordinates: ${error.message}`, { address });
    throw new CustomError('Failed to get coordinates', 'GeolocationError');
  }
};

module.exports = {
  findUsersWithinRadius,
  calculateDistance,
  getCoordinates
};