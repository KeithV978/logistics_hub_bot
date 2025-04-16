/**
 * Rider controller for rider-specific commands and actions
 */
const logger = require('../utils/logger');
const db = require('../database');
const sessionManager = require('../utils/sessionManager');
const ninVerificationService = require('../services/ninVerificationService');

/**
 * Start the registration process for a rider
 * @param {Object} ctx - Telegram context object
 */
const startRegistration = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`User ${telegramId} starting rider registration`);
    
    // Check if already registered
    const existingUser = await db.query(
      `SELECT "isVerified" FROM users WHERE "telegramId" = $1 AND role = 'rider'`,
      [telegramId]
    );
    
    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].isVerified) {
        return await ctx.reply('You are already registered and verified as a rider.');
      } else {
        return await ctx.reply('Your registration is pending verification. Please wait for the process to complete.');
      }
    }
    
    // Create a new session for registration
    sessionManager.createSession(telegramId, {
      action: 'registration',
      role: 'rider',
      step: 'fullName',
      data: {}
    });
    
    await ctx.reply(
      'Welcome to the rider registration process! I\'ll guide you through a few steps.\n\n' +
      'Please enter your full name as it appears on your identification:'
    );
    
  } catch (error) {
    logger.error(`Error in startRegistration: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error starting the registration process. Please try again later.');
  }
};

/**
 * Process incoming messages for registration
 * @param {Object} ctx - Telegram context object
 */
const handleRegistrationMessage = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);
    
    if (!session || session.action !== 'registration' || session.role !== 'rider') {
      return false; // Not in registration mode
    }
    
    const { step, data } = session;
    const message = ctx.message;
    const text = message.text;
    
    switch (step) {
      case 'fullName':
        if (text.length < 3) {
          await ctx.reply('Please enter a valid full name (at least 3 characters).');
          return true;
        }
        
        data.fullName = text;
        session.step = 'phoneNumber';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply(
          'Thanks! Now, please enter your phone number in this format: +2348012345678'
        );
        break;
        
      case 'phoneNumber':
        // Basic validation for Nigerian phone number
        const phoneRegex = /^\+234[0-9]{10}$/;
        if (!phoneRegex.test(text)) {
          await ctx.reply('Please enter a valid Nigerian phone number in the format: +2348012345678');
          return true;
        }
        
        data.phoneNumber = text;
        session.step = 'bankName';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply(
          'Great! Now, please provide your bank details.\n\n' +
          'First, what is your bank name?'
        );
        break;
        
      case 'bankName':
        if (text.length < 2) {
          await ctx.reply('Please enter a valid bank name.');
          return true;
        }
        
        data.bankName = text;
        session.step = 'accountNumber';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply('Please enter your 10-digit bank account number:');
        break;
        
      case 'accountNumber':
        const accountRegex = /^[0-9]{10}$/;
        if (!accountRegex.test(text)) {
          await ctx.reply('Please enter a valid 10-digit bank account number.');
          return true;
        }
        
        data.accountNumber = text;
        session.step = 'accountName';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply('Please enter the account name as it appears on your bank statements:');
        break;
        
      case 'accountName':
        if (text.length < 3) {
          await ctx.reply('Please enter a valid account name (at least 3 characters).');
          return true;
        }
        
        data.accountName = text;
        session.step = 'nin';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply('Please enter your National Identification Number (NIN):');
        break;
        
      case 'nin':
        const ninRegex = /^[0-9]{11}$/;
        if (!ninRegex.test(text)) {
          await ctx.reply('Please enter a valid 11-digit NIN.');
          return true;
        }
        
        data.nin = text;
        session.step = 'vehicleType';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply(
          'What type of vehicle do you use? Please select from the following options:\n' +
          '- Motorcycle\n' +
          '- Car\n' +
          '- Van\n' +
          '- Bicycle'
        );
        break;
        
      case 'vehicleType':
        const validVehicles = ['motorcycle', 'car', 'van', 'bicycle'];
        if (!validVehicles.includes(text.toLowerCase())) {
          await ctx.reply(
            'Please select a valid vehicle type:\n' +
            '- Motorcycle\n' +
            '- Car\n' +
            '- Van\n' +
            '- Bicycle'
          );
          return true;
        }
        
        data.vehicleType = text.toLowerCase();
        session.step = 'photo';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply(
          'Last step! Please send a clear photo of yourself holding your ID card.'
        );
        break;
        
      case 'photo':
        // If we're expecting a photo but got text
        await ctx.reply('Please send a photo of yourself holding your ID card.');
        break;
        
      default:
        logger.warn(`Unknown registration step: ${step}`, { telegramId });
        return false;
    }
    
    return true; // Message was handled
    
  } catch (error) {
    logger.error(`Error in handleRegistrationMessage: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your information. Please try again later.');
    return true;
  }
};

/**
 * Handle photo upload during registration
 * @param {Object} ctx - Telegram context object
 */
const handleRegistrationPhoto = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);
    
    if (!session || session.action !== 'registration' || session.role !== 'rider' || session.step !== 'photo') {
      return false; // Not expecting a photo
    }
    
    const { data } = session;
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    data.photoUrl = photoId;
    
    // Complete registration
    session.step = 'complete';
    sessionManager.updateSession(telegramId, session);
    
    await ctx.reply(
      'Thank you for providing all the necessary information! Your registration is now being processed.\n\n' +
      'We will verify your NIN and other details. This might take a little time.\n\n' +
      'You will receive a notification once your verification is complete.'
    );
    
    // Start verification process
    startVerificationProcess(ctx, telegramId, data);
    
    return true;
    
  } catch (error) {
    logger.error(`Error in handleRegistrationPhoto: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your photo. Please try again later.');
    return true;
  }
};

/**
 * Start the verification process for a rider
 * @param {Object} ctx - Telegram context object
 * @param {string} telegramId - Telegram ID of the user
 * @param {Object} data - Registration data
 */
const startVerificationProcess = async (ctx, telegramId, data) => {
  try {
    logger.info(`Starting verification process for rider ${telegramId}`);
    
    // Verify NIN via external API
    const ninVerificationResult = await ninVerificationService.verify(data.nin, {
      fullName: data.fullName,
      phoneNumber: data.phoneNumber
    });
    
    if (!ninVerificationResult.success) {
      await ctx.telegram.sendMessage(
        telegramId,
        `We could not verify your NIN. Error: ${ninVerificationResult.message}\n\n` +
        'Please start the registration process again with correct information using /register.'
      );
      sessionManager.clearSession(telegramId);
      return;
    }
    
    // Create user record with isVerified = false
    await db.query(
      `INSERT INTO users (
        "telegramId", "role", "fullName", "phoneNumber", "bankDetails", 
        "nin", "photoUrl", "isVerified", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        telegramId,
        'rider',
        data.fullName,
        data.phoneNumber,
        JSON.stringify({
          accountName: data.accountName,
          accountNumber: data.accountNumber,
          bankName: data.bankName
        }),
        data.nin,
        data.photoUrl,
        true // Auto-verify for now, in a real app this might be manual
      ]
    );
    
    // Clear session
    sessionManager.clearSession(telegramId);
    
    // Send verification success message
    await ctx.telegram.sendMessage(
      telegramId,
      '🎉 Congratulations! Your identity has been verified and your rider account is now active.\n\n' +
      'You can now receive and accept delivery orders. Type /profile to see your profile information.\n\n' +
      'When you accept an order, a private group will be created for you and the customer to communicate during the delivery.'
    );
    
  } catch (error) {
    logger.error(`Error in startVerificationProcess: ${error.message}`, { telegramId, error });
    await ctx.telegram.sendMessage(
      telegramId,
      'Sorry, there was an error verifying your information. Please try again later or contact support.'
    );
  }
};

/**
 * Handle the /profile command for riders
 * @param {Object} ctx - Telegram context object
 */
const showProfile = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`Rider ${telegramId} requesting profile information`);
    
    // Get rider profile
    const profileResult = await db.query(
      `SELECT * FROM users WHERE "telegramId" = $1 AND role = 'rider'`,
      [telegramId]
    );
    
    if (profileResult.rows.length === 0) {
      return await ctx.reply(
        'You are not registered as a rider. Use /register to start the registration process.'
      );
    }
    
    const profile = profileResult.rows[0];
    const bankDetails = profile.bankDetails;
    
    // Format and send profile information
    await ctx.reply(
      `📋 Rider Profile 📋\n\n` +
      `Name: ${profile.fullName}\n` +
      `Phone: ${profile.phoneNumber}\n` +
      `Bank: ${bankDetails.bankName}\n` +
      `Account: ${bankDetails.accountNumber} (${bankDetails.accountName})\n` +
      `Rating: ${profile.rating.toFixed(1)} ⭐ (from ${profile.reviews ? profile.reviews.length : 0} reviews)\n` +
      `Verification Status: ${profile.isVerified ? '✅ Verified' : '⏳ Pending'}\n\n` +
      `To view your latest reviews, use /reviews.`);
    
    } catch (error) {
      logger.error(`Error in showProfile: ${error.message}`, { telegramId: ctx.from.id, error });
      await ctx.reply('Sorry, there was an error retrieving your profile. Please try again later.');
    }
  };
  
  /**
   * Handle the /reviews command for riders
   * @param {Object} ctx - Telegram context object
   */
  const showReviews = async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      logger.info(`Rider ${telegramId} requesting reviews`);
      
      // Get rider reviews
      const reviewsResult = await db.query(
        `SELECT reviews FROM users WHERE "telegramId" = $1 AND role = 'rider'`,
        [telegramId]
      );
      
      if (reviewsResult.rows.length === 0) {
        return await ctx.reply(
          'You are not registered as a rider. Use /register to start the registration process.'
        );
      }
      
      const reviews = reviewsResult.rows[0].reviews || [];
      
      if (reviews.length === 0) {
        return await ctx.reply('You don\'t have any reviews yet.');
      }
      
      // Format and send reviews
      let reviewsMessage = '📝 Your Latest Reviews 📝\n\n';
      
      // Get the 5 most recent reviews
      const recentReviews = reviews.slice(-5).reverse();
      
      recentReviews.forEach((review, index) => {
        reviewsMessage += `${index + 1}. Rating: ${review.rating} ⭐\n`;
        if (review.comment) {
          reviewsMessage += `   Comment: "${review.comment}"\n`;
        }
        reviewsMessage += '\n';
      });
      
      await ctx.reply(reviewsMessage);
      
    } catch (error) {
      logger.error(`Error in showReviews: ${error.message}`, { telegramId: ctx.from.id, error });
      await ctx.reply('Sorry, there was an error retrieving your reviews. Please try again later.');
    }
  };
  
  /**
   * Handle the rider confirming payment received
   * @param {Object} ctx - Telegram context object
   */
  const confirmPaymentReceived = async (ctx) => {
    try {
      const riderId = ctx.from.id;
      const groupId = ctx.chat.id;
      
      logger.info(`Rider ${riderId} confirming payment received in group ${groupId}`);
      
      // Get group information
      const groupResult = await db.query(
        `SELECT * FROM groups WHERE "groupId" = $1 AND "riderId" = $2`,
        [groupId.toString(), riderId]
      );
      
      if (groupResult.rows.length === 0) {
        return await ctx.reply('This command can only be used in an active delivery group by the rider.');
      }
      
      const group = groupResult.rows[0];
      
      // Update order status to in_progress
      await db.query(
        `UPDATE orders SET status = 'in_progress', "updatedAt" = NOW() WHERE "orderId" = $1`,
        [group.orderId]
      );
      
      await ctx.reply(
        '✅ Payment confirmation received! The order status is now "in progress".\n\n' +
        'Please proceed with the delivery. When you deliver the package, remind the customer to use /delivery_successful'
      );
      
      return { 
        confirmed: true,
        groupId,
        orderId: group.orderId
      };
      
    } catch (error) {
      logger.error(`Error in confirmPaymentReceived: ${error.message}`, { telegramId: ctx.from.id, error });
      await ctx.reply('Sorry, there was an error processing your confirmation. Please try again later.');
      return { confirmed: false };
    }
  };
  
  /**
   * Make an offer for an order
   * @param {Object} ctx - Telegram context object
   * @param {Array} args - Command arguments [orderId, price, vehicleType]
   */
  const makeOrderOffer = async (ctx, args) => {
    try {
      const riderId = ctx.from.id;
      
      if (!args || args.length < 2) {
        return await ctx.reply('Please provide order ID and price: /offer <orderId> <price> [vehicleType]');
      }
      
      const orderId = args[0];
      const price = parseFloat(args[1]);
      const vehicleType = args.length > 2 ? args[2].toLowerCase() : null;
      
      // Validate inputs
      if (isNaN(price) || price <= 0) {
        return await ctx.reply('Please provide a valid price (greater than 0).');
      }
      
      logger.info(`Rider ${riderId} making offer for order ${orderId} at price ${price}`);
      
      // Check if rider is verified
      const riderResult = await db.query(
        `SELECT "isVerified" FROM users WHERE "telegramId" = $1 AND role = 'rider'`,
        [riderId]
      );
      
      if (riderResult.rows.length === 0 || !riderResult.rows[0].isVerified) {
        return await ctx.reply('You must be a verified rider to make offers. Use /register to complete your registration.');
      }
      
      // Check if order exists and is pending
      const orderResult = await db.query(
        `SELECT * FROM orders WHERE "orderId" = $1 AND status = 'pending'`,
        [orderId]
      );
      
      if (orderResult.rows.length === 0) {
        return await ctx.reply('Order not found or not available for offers.');
      }
      
      // Check if rider already made an offer for this order
      const existingOfferResult = await db.query(
        `SELECT * FROM offers WHERE "orderId" = $1 AND "riderId" = $2 AND status = 'pending'`,
        [orderId, riderId]
      );
      
      if (existingOfferResult.rows.length > 0) {
        return await ctx.reply('You have already made an offer for this order.');
      }
      
      // Create offer
      await db.query(
        `INSERT INTO offers ("offerId", "orderId", "riderId", "price", "vehicleType", "status", "createdAt")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, 'pending', NOW())`,
        [orderId, riderId, price, vehicleType]
      );
      
      await ctx.reply(
        `Your offer for order ${orderId} has been submitted.\n` +
        `Price: ₦${price.toFixed(2)}\n` +
        `Vehicle: ${vehicleType || 'Not specified'}\n\n` +
        `You will be notified if the customer accepts your offer.`
      );
      
      // Get customer telegram ID to notify them
      const customerTelegramId = orderResult.rows[0].customerTelegramId;
      
      // Get rider details for the notification
      const riderDetailsResult = await db.query(
        `SELECT "fullName", rating FROM users WHERE "telegramId" = $1`,
        [riderId]
      );
      
      const riderName = riderDetailsResult.rows[0].fullName;
      const riderRating = riderDetailsResult.rows[0].rating;
      
      return {
        notifyCustomer: true,
        customerTelegramId,
        message: 
          `🚨 New Offer for Your Order 🚨\n\n` +
          `Rider: ${riderName} (${riderRating.toFixed(1)} ⭐)\n` +
          `Price: ₦${price.toFixed(2)}\n` +
          `Vehicle: ${vehicleType || 'Not specified'}\n\n` +
          `To accept this offer, use:\n/accept_offer <offerId>`
      };
      
    } catch (error) {
      logger.error(`Error in makeOrderOffer: ${error.message}`, { telegramId: ctx.from.id, args, error });
      await ctx.reply('Sorry, there was an error submitting your offer. Please try again later.');
      return { notifyCustomer: false };
    }
  };
  
  module.exports = {
    startRegistration,
    handleRegistrationMessage,
    handleRegistrationPhoto,
    showProfile,
    showReviews,
    confirmPaymentReceived,
    makeOrderOffer
  };