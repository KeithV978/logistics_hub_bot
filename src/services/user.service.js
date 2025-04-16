const db = require('../database');
const cryptoUtils = require('../utils/cryptoUtils');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

// Validation function (simplified)
const validateUserData = (data) => {
  if (!data.telegramId || !data.fullName || !data.phoneNumber || !data.bankDetails || !data.nin || !data.photoUrl || !data.role) {
    throw new CustomError('Missing required fields', 'ValidationError');
  }
  if (!['rider', 'errander'].includes(data.role)) {
    throw new CustomError('Invalid role', 'ValidationError');
  }
};

const registerUser = async (data) => {
  try {
    validateUserData(data);
    const encryptedNin = cryptoUtils.encrypt(data.nin);
    const encryptedBankDetails = cryptoUtils.encrypt(JSON.stringify(data.bankDetails));
    const user = {
      telegramId: data.telegramId,
      role: data.role,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      bankDetails: encryptedBankDetails,
      nin: encryptedNin,
      photoUrl: data.photoUrl,
      rating: 0,
      reviews: [],
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.users.insert(user);
    return user;
  } catch (error) {
    logger.error(`Error registering user: ${error.message}`, { data });
    throw new CustomError('Failed to register user', 'DatabaseError');
  }
};

const getUserProfile = async (telegramId) => {
  try {
    const user = await db.users.findOne({ telegramId });
    if (!user) {
      throw new CustomError('User not found', 'NotFoundError');
    }
    return {
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      rating: user.rating,
      reviews: user.reviews
    };
  } catch (error) {
    logger.error(`Error getting user profile: ${error.message}`, { telegramId });
    throw error;
  }
};

const updateUser = async (telegramId, updates) => {
  try {
    const user = await db.users.findOne({ telegramId });
    if (!user) {
      throw new CustomError('User not found', 'NotFoundError');
    }
    if (updates.nin) {
      updates.nin = cryptoUtils.encrypt(updates.nin);
    }
    if (updates.bankDetails) {
      updates.bankDetails = cryptoUtils.encrypt(JSON.stringify(updates.bankDetails));
    }
    await db.users.update(telegramId, updates);
    return true;
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`, { telegramId, updates });
    throw new CustomError('Failed to update user', 'DatabaseError');
  }
};

const setVerified = async (telegramId, status) => {
  try {
    await updateUser(telegramId, { isVerified: status });
    return true;
  } catch (error) {
    logger.error(`Error setting verification status: ${error.message}`, { telegramId });
    throw error;
  }
};

const isUserVerified = async (telegramId) => {
  try {
    const user = await db.users.findOne({ telegramId });
    return user ? user.isVerified : false;
  } catch (error) {
    logger.error(`Error checking verification status: ${error.message}`, { telegramId });
    throw new CustomError('Failed to check verification status', 'DatabaseError');
  }
};

const addReview = async (telegramId, review) => {
  try {
    const user = await db.users.findOne({ telegramId });
    if (!user) {
      throw new CustomError('User not found', 'NotFoundError');
    }
    const updatedReviews = [...user.reviews, review];
    const totalRatings = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const newRating = totalRatings / updatedReviews.length;
    await db.users.update(telegramId, { reviews: updatedReviews, rating: newRating });
    return true;
  } catch (error) {
    logger.error(`Error adding review: ${error.message}`, { telegramId, review });
    throw new CustomError('Failed to add review', 'DatabaseError');
  }
};

module.exports = {
  registerUser,
  getUserProfile,
  updateUser,
  setVerified,
  isUserVerified,
  addReview
};