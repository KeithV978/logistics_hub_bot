const db = require('../database');
const userService = require('./user.service');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const submitRating = async (taskId, rating, review) => {
  try {
    const task = await db.orders.findOne({ orderId: taskId }) || await db.errands.findOne({ errandId: taskId });
    if (!task) {
      throw new CustomError('Task not found', 'NotFoundError');
    }
    const providerId = task.riderId || task.erranderId;
    const reviewData = { rating, comment: review || null, createdAt: new Date() };
    await userService.addReview(providerId, reviewData);
    return true;
  } catch (error) {
    logger.error(`Error submitting rating: ${error.message}`, { taskId, rating });
    throw new CustomError('Failed to submit rating', 'RatingError');
  }
};

const calculateAverageRating = async (userId) => {
  try {
    const user = await db.users.findOne({ telegramId: userId });
    if (!user) {
      throw new CustomError('User not found', 'NotFoundError');
    }
    const totalRatings = user.reviews.reduce((sum, r) => sum + r.rating, 0);
    return user.reviews.length ? totalRatings / user.reviews.length : 0;
  } catch (error) {
    logger.error(`Error calculating average rating: ${error.message}`, { userId });
    throw new CustomError('Failed to calculate average rating', 'RatingError');
  }
};

module.exports = {
  submitRating,
  calculateAverageRating
};