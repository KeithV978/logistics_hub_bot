const db = require('../database');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const createOffer = async (data) => {
  try {
    const offer = {
      offerId: uuidv4(),
      taskId: data.taskId,
      providerId: data.providerId,
      price: data.price,
      vehicleType: data.vehicleType || null,
      status: 'pending',
      createdAt: new Date()
    };
    await db.offers.insert(offer);
    return offer;
  } catch (error) {
    logger.error(`Error creating offer: ${error.message}`, { data });
    throw new CustomError('Failed to create offer', 'DatabaseError');
  }
};

const getOffers = async (taskId) => {
  try {
    const offers = await db.offers.find({ taskId });
    return offers;
  } catch (error) {
    logger.error(`Error getting offers: ${error.message}`, { taskId });
    throw new CustomError('Failed to get offers', 'DatabaseError');
  }
};

const acceptOffer = async (offerId) => {
  try {
    const offer = await db.offers.findOne({ offerId });
    if (!offer) {
      throw new CustomError('Offer not found', 'NotFoundError');
    }
    await db.offers.update(offerId, { status: 'accepted' });
    return offer;
  } catch (error) {
    logger.error(`Error accepting offer: ${error.message}`, { offerId });
    throw new CustomError('Failed to accept offer', 'DatabaseError');
  }
};

const rejectOffer = async (offerId) => {
  try {
    const offer = await db.offers.findOne({ offerId });
    if (!offer) {
      throw new CustomError('Offer not found', 'NotFoundError');
    }
    await db.offers.update(offerId, { status: 'rejected' });
    return true;
  } catch (error) {
    logger.error(`Error rejecting offer: ${error.message}`, { offerId });
    throw new CustomError('Failed to reject offer', 'DatabaseError');
  }
};

module.exports = {
  createOffer,
  getOffers,
  acceptOffer,
  rejectOffer
};