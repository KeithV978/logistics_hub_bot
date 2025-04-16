const db = require('../database');
const groupService = require('./group.service');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const startTracking = async (taskId) => {
  try {
    const group = await db.groups.findOne({ taskId });
    if (!group) {
      throw new CustomError('Group not found for task', 'NotFoundError');
    }
    await groupService.sendMessageToGroup(group.groupId, 'Please share your live location to start tracking.');
    return true;
  } catch (error) {
    logger.error(`Error starting tracking: ${error.message}`, { taskId });
    throw new CustomError('Failed to start tracking', 'TrackingError');
  }
};

const stopTracking = async (taskId) => {
  try {
    const group = await db.groups.findOne({ taskId });
    if (!group) {
      throw new CustomError('Group not found for task', 'NotFoundError');
    }
    await groupService.sendMessageToGroup(group.groupId, 'Live location tracking has been stopped.');
    return true;
  } catch (error) {
    logger.error(`Error stopping tracking: ${error.message}`, { taskId });
    throw new CustomError('Failed to stop tracking', 'TrackingError');
  }
};

const updateLocation = async (taskId, location) => {
  try {
    const group = await db.groups.findOne({ taskId });
    if (!group) {
      throw new CustomError('Group not found for task', 'NotFoundError');
    }
    await db.users.update(group.providerId, { lastKnownLocation: location });
    await groupService.sendMessageToGroup(group.groupId, 'Location updated.');
    return true;
  } catch (error) {
    logger.error(`Error updating location: ${error.message}`, { taskId, location });
    throw new CustomError('Failed to update location', 'TrackingError');
  }
};

module.exports = {
  startTracking,
  stopTracking,
  updateLocation
};