const db = require('../config/database');
const telegramUtils = require('../utils/telegramUtils');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const createGroup = async (taskId, customerId, providerId) => {
  try {
    const group = await telegramUtils.createGroup([customerId, providerId]);
    const groupData = {
      groupId: group.groupId,
      taskId,
      customerId,
      providerId,
      createdAt: new Date()
    };
    await db.groups.insert(groupData);
    await telegramUtils.sendMessage(group.groupId, `
RULES OF ENGAGEMENT:
- No abusive language.
- Share live location when requested.
- Contact support for issues: /help
    `);
    return groupData;
  } catch (error) {
    logger.error(`Error creating group: ${error.message}`, { taskId, customerId, providerId });
    throw new CustomError('Failed to create group', 'GroupError');
  }
};

const deleteGroup = async (groupId) => {
  try {
    await telegramUtils.deleteGroup(groupId);
    await db.groups.delete({ groupId });
    return true;
  } catch (error) {
    logger.error(`Error deleting group: ${error.message}`, { groupId });
    throw new CustomError('Failed to delete group', 'GroupError');
  }
};

const sendMessageToGroup = async (groupId, message) => {
  try {
    await telegramUtils.sendMessage(groupId, message);
    return true;
  } catch (error) {
    logger.error(`Error sending message to group: ${error.message}`, { groupId });
    throw new CustomError('Failed to send message to group', 'GroupError');
  }
};

module.exports = {
  createGroup,
  deleteGroup,
  sendMessageToGroup
};