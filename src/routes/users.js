const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { withErrorHandling } = require('../utils/dbErrorHandler');
const { User } = require('../db/models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { validateRequired, validateLength, validatePhoneNumber } = require('../utils/validation');
const { logger } = require('../utils/logger');

// Get all users
router.get('/', 
  authenticate, 
  authorize(['admin']), 
  asyncHandler(async (req, res) => {
    const users = await withErrorHandling(async () => {
      return await User.findAll();
    });
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  })
);

// Get user by ID
router.get('/:telegramId', 
  authenticate, 
  asyncHandler(async (req, res) => {
    const user = await withErrorHandling(async () => {
      return await User.findOne({ where: { telegramId: req.params.telegramId } });
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  })
);

// Create user
router.post('/', 
  authenticate, 
  authorize(['admin']), 
  validateRequest((data) => {
    // Validate required fields
    validateRequired(data, ['telegramId', 'role', 'fullName', 'phoneNumber', 'nin', 'photoUrl']);
    
    // Validate role
    if (!['rider', 'errander'].includes(data.role)) {
      throw new ValidationError('Validation failed', [{
        field: 'role',
        message: 'Role must be either rider or errander'
      }]);
    }
    
    // Validate full name
    validateLength(data.fullName, 'fullName', 2, 100);
    
    // Validate phone number
    validatePhoneNumber(data.phoneNumber);
    
    // Validate NIN
    validateLength(data.nin, 'nin', 11, 11);
    
    // Validate photo URL
    if (!data.photoUrl.startsWith('http')) {
      throw new ValidationError('Validation failed', [{
        field: 'photoUrl',
        message: 'Photo URL must be a valid HTTP URL'
      }]);
    }
    
    return true;
  }),
  asyncHandler(async (req, res) => {
    const user = await withErrorHandling(async () => {
      return await User.create(req.body);
    });
    
    logger.info(`User created: ${user.telegramId}`);
    
    res.status(201).json({
      success: true,
      data: user
    });
  })
);

// Update user
router.put('/:telegramId', 
  authenticate, 
  asyncHandler(async (req, res) => {
    // Check if user exists
    const existingUser = await withErrorHandling(async () => {
      return await User.findOne({ where: { telegramId: req.params.telegramId } });
    });
    
    if (!existingUser) {
      throw new NotFoundError('User');
    }
    
    // Check if user is authorized to update
    if (req.user.role !== 'admin' && req.user.telegramId !== req.params.telegramId) {
      throw new ValidationError('You are not authorized to update this user');
    }
    
    // Update user
    const user = await withErrorHandling(async () => {
      return await existingUser.update(req.body);
    });
    
    logger.info(`User updated: ${user.telegramId}`);
    
    res.status(200).json({
      success: true,
      data: user
    });
  })
);

// Delete user
router.delete('/:telegramId', 
  authenticate, 
  authorize(['admin']), 
  asyncHandler(async (req, res) => {
    // Check if user exists
    const user = await withErrorHandling(async () => {
      return await User.findOne({ where: { telegramId: req.params.telegramId } });
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    // Delete user
    await withErrorHandling(async () => {
      await user.destroy();
    });
    
    logger.info(`User deleted: ${req.params.telegramId}`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  })
);

module.exports = router; 