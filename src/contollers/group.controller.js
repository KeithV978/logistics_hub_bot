/**
 * Group controller for handling Telegram group creation and management
 */
const logger = require('../utils/logger');
const db = require('../database');
const { createGroup, sendMessage, deleteGroup } = require('../utils/telegramUtils');

/**
 * Custom error class for group-related errors
 */
class GroupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GroupError';
  }
}

/**
 * Create a private Telegram group for a transaction (order or errand)
 * @param {Object} params - Parameters for group creation
 * @param {string} params.customerId - Customer's Telegram ID
 * @param {string} params.riderId - Rider or errander's Telegram ID
 * @param {string} params.orderId - Order or errand ID
 * @param {string} params.type - Type of transaction ('order' or 'errand')
 */
const createTransactionGroup = async ({ customerId, riderId, orderId, type }) => {
  try {
    logger.info(`Creating transaction group for ${type} ${orderId}`, { customerId, riderId });

    // Create a private Telegram group with customer, rider/errander, and bot
    const group = await createGroup([customerId, riderId]);
    if (!group.groupId) {
      throw new GroupError('Failed to create Telegram group.');
    }

    // Post rules of engagement
    const rulesMessage = `
RULES OF ENGAGEMENT:
- No abusive language or inappropriate behavior.
- Share live location when requested to ensure smooth coordination.
- Contact support for issues via /help.
- Complete the transaction promptly and confirm using /payment_received and /delivery_successful.
    `;
    await sendMessage(group.groupId, rulesMessage);

    // Prompt rider/errander to share live location
    const role = type === 'order' ? 'rider' : 'errander';
    await sendMessage(group.groupId, `Please, ${role}, share your live location to begin the ${type}.`);

    // Save group details in database
    const groupData = {
      groupId: group.groupId,
      [type === 'order' ? 'orderId' : 'errandId']: orderId,
      customerId,
      [type === 'order' ? 'riderId' : 'erranderId']: riderId,
      createdAt: new Date()
    };
    await db.groups.insert(groupData);
    logger.info(`Group created: ${group.groupId}`, { orderId, type });

    return groupData;

  } catch (error) {
    logger.error(`Error in createTransactionGroup: ${error.message}`, { customerId, riderId, orderId, type });
    throw new GroupError('Failed to create transaction group.');
  }
};

/**
 * Close a transaction group after completion
 * @param {Object} ctx - Telegram context object
 * @param {string} groupId - Telegram group ID
 */
const closeTransactionGroup = async (ctx, groupId) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`Closing transaction group ${groupId}`, { telegramId });

    // Verify group exists and is active
    const group = await db.groups.findOne({ groupId });
    if (!group) {
      throw new GroupError('Group not found.');
    }

    // Check if both /payment_received and /delivery_successful have been issued
    const transactionId = group.orderId || group.errandId;
    const type = group.orderId ? 'order' : 'errand';
    const transaction = await db[type === 'order' ? 'orders' : 'errands'].findOne({ [type + 'Id']: transactionId });
    if (transaction.status !== 'completed') {
      await ctx.reply('Cannot close group: Transaction is not yet completed.');
      return;
    }

    // Remove all members and delete the group
    await deleteGroup(groupId);
    await db.groups.delete(groupId);
    logger.info(`Group closed: ${groupId}`, { transactionId, type });

    // Notify customer to rate the rider/errander
    const role = type === 'order' ? 'rider' : 'errander';
    await sendMessage(group.customerId, `Thank you! Please rate the ${role} (1-5 stars) for ${type} ${transactionId}.`);

  } catch (error) {
    logger.error(`Error in closeTransactionGroup: ${error.message}`, { groupId, telegramId });
    await ctx.reply('Sorry, there was an error closing the group.');
    throw new GroupError('Failed to close transaction group.');
  }
};

module.exports = {
  createTransactionGroup,
  closeTransactionGroup
};