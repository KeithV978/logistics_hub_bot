const telegramUtils = require('../utils/telegramUtils');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const sendNotification = async (userId, message) => {
  try {
    await telegramUtils.sendMessage(userId, message);
    return true;
  } catch (error) {
    logger.error(`Error sending notification: ${error.message}`, { userId });
    throw new CustomError('Failed to send notification', 'NotificationError');
  }
};

const notifyRiders = async (order, riders) => {
  try {
    const message = `New order available: Pickup at ${order.pickupLocation.address}, Drop-off at ${order.dropoffLocation.address}. Instructions: ${order.instructions || 'None'}.`;
    for (const rider of riders) {
      await sendNotification(rider.telegramId, message);
    }
    return true;
  } catch (error) {
    logger.error(`Error notifying riders: ${error.message}`, { orderId: order.orderId });
    throw new CustomError('Failed to notify riders', 'NotificationError');
  }
};

const notifyErranders = async (errand, erranders) => {
  try {
    const message = `New errand available: Location at ${errand.location.address}. Description: ${errand.description}.`;
    for (const errander of erranders) {
      await sendNotification(errander.telegramId, message);
    }
    return true;
  } catch (error) {
    logger.error(`Error notifying erranders: ${error.message}`, { errandId: errand.errandId });
    throw new CustomError('Failed to notify erranders', 'NotificationError');
  }
};

const notifyOfferStatus = async (offerId, status) => {
  try {
    const offer = await db.offers.findOne({ offerId });
    if (!offer) {
      throw new CustomError('Offer not found', 'NotFoundError');
    }
    const message = `Your offer for task ${offer.taskId} has been ${status}.`;
    await sendNotification(offer.providerId, message);
    return true;
  } catch (error) {
    logger.error(`Error notifying offer status: ${error.message}`, { offerId, status });
    throw new CustomError('Failed to notify offer status', 'NotificationError');
  }
};

module.exports = {
  sendNotification,
  notifyRiders,
  notifyErranders,
  notifyOfferStatus
};