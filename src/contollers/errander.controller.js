/**
 * Errander controller for errander-specific commands and actions
 */
const logger = require('../utils/logger');
const db = require('../database');
const sessionManager = require('../utils/sessionManager');
const ninVerificationService = require('../services/ninVerificationService');

/**
 * Start the registration process for an errander
 * @param {Object} ctx - Telegram context object
 */
const startErranderRegistration = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`User ${telegramId} starting errander registration`);
    
    // Check if already registered
    const existingUser = await db.query(
      `SELECT "isVerified" FROM users WHERE "telegramId" = $1 AND role = 'errander'`,
      [telegramId]
    );
    
    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].isVerified) {
        return await ctx.reply('You are already registered and verified as an errander.');
      } else {
        return await ctx.reply('Your registration is pending verification. Please wait for the process to complete.');
      }
    }
    
    // Create a new session for registration
    sessionManager.createSession(telegramId, {
      action: 'registration',
      role: 'errander',
      step: 'fullName',
      data: {}
    });
    
    await ctx.reply(
      'Welcome to the errander registration process! I\'ll guide you through a few steps.\n\n' +
      'Please enter your full name as it appears on your identification:'
    );
    
  } catch (error) {
    logger.error(`Error in startErranderRegistration: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error starting the registration process. Please try again later.');
  }
};

/**
 * Process incoming messages for errander registration
 * @param {Object} ctx - Telegram context object
 */
const handleErranderRegistrationMessage = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);
    
    if (!session || session.action !== 'registration' || session.role !== 'errander') {
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
        session.step = 'specialties';
        sessionManager.updateSession(telegramId, session);
        
        await ctx.reply(
          'What types of errands do you specialize in? For example: groceries, pharmacy, documents, etc.\n' +
          'Please list your specialties separated by commas.'
        );
        break;
        
      case 'specialties':
        if (text.length < 3) {
          await ctx.reply('Please enter at least one specialty.');
          return true;
        }
        
        data.specialties = text.split(',').map(s => s.trim());
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
    logger.error(`Error in handleErranderRegistrationMessage: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your information. Please try again later.');
    return true;
  }
};

/**
 * Handle photo upload during errander registration
 * @param {Object} ctx - Telegram context object
 */
const handleErranderRegistrationPhoto = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const session = sessionManager.getSession(telegramId);
    
    if (!session || session.action !== 'registration' || session.role !== 'errander' || session.step !== 'photo') {
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
    startErranderVerificationProcess(ctx, telegramId, data);
    
    return true;
    
  } catch (error) {
    logger.error(`Error in handleErranderRegistrationPhoto: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your photo. Please try again later.');
    return true;
  }
};

/**
 * Start the verification process for an errander
 * @param {Object} ctx - Telegram context object
 * @param {string} telegramId - Telegram ID of the user
 * @param {Object} data - Registration data
 */
const startErranderVerificationProcess = async (ctx, telegramId, data) => {
  try {
    logger.info(`Starting verification process for errander ${telegramId}`);
    
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
        "nin", "photoUrl", "specialties", "isVerified", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        telegramId,
        'errander',
        data.fullName,
        data.phoneNumber,
        JSON.stringify({
          accountName: data.accountName,
          accountNumber: data.accountNumber,
          bankName: data.bankName
        }),
        data.nin,
        data.photoUrl,
        JSON.stringify(data.specialties),
        true // Auto-verify for now, in a real app this might be manual
      ]
    );
    
    // Clear session
    sessionManager.clearSession(telegramId);
    
    // Send verification success message
    await ctx.telegram.sendMessage(
      telegramId,
      '🎉 Congratulations! Your identity has been verified and your errander account is now active.\n\n' +
      'You can now receive and accept errand requests. Type /profile to see your profile information.\n\n' +
      'When you accept an errand, a private group will be created for you and the customer to communicate during the errand.'
    );
    
  } catch (error) {
    logger.error(`Error in startErranderVerificationProcess: ${error.message}`, { telegramId, error });
    await ctx.telegram.sendMessage(
      telegramId,
      'Sorry, there was an error verifying your information. Please try again later or contact support.'
    );
  }
};

/**
 * Handle the /profile command for erranders
 * @param {Object} ctx - Telegram context object
 */
const showErranderProfile = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`Errander ${telegramId} requesting profile information`);
    
    // Get errander profile
    const profileResult = await db.query(
      `SELECT * FROM users WHERE "telegramId" = $1 AND role = 'errander'`,
      [telegramId]
    );
    
    if (profileResult.rows.length === 0) {
      return await ctx.reply(
        'You are not registered as an errander. Use /register_errander to start the registration process.'
      );
    }
    
    const profile = profileResult.rows[0];
    const bankDetails = profile.bankDetails;
    const specialties = profile.specialties || [];
    
    // Format and send profile information
    await ctx.reply(
      `📋 Errander Profile 📋\n\n` +
      `Name: ${profile.fullName}\n` +
      `Phone: ${profile.phoneNumber}\n` +
      `Bank: ${bankDetails.bankName}\n` +
      `Account: ${bankDetails.accountNumber} (${bankDetails.accountName})\n` +
      `Specialties: ${specialties.join(', ')}\n` +
      `Rating: ${profile.rating.toFixed(1)} ⭐ (from ${profile.reviews ? profile.reviews.length : 0} reviews)\n` +
      `Verification Status: ${profile.isVerified ? '✅ Verified' : '⏳ Pending'}\n\n` +
      `To view your latest reviews, use /reviews.`
    );
    
  } catch (error) {
    logger.error(`Error in showErranderProfile: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error retrieving your profile. Please try again later.');
  }
};

/**
 * Handle the /reviews command for erranders
 * @param {Object} ctx - Telegram context object
 */
const showErranderReviews = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    logger.info(`Errander ${telegramId} requesting reviews`);
    
    // Get errander reviews
    const reviewsResult = await db.query(
      `SELECT reviews FROM users WHERE "telegramId" = $1 AND role = 'errander'`,
      [telegramId]
    );
    
    if (reviewsResult.rows.length === 0) {
      return await ctx.reply(
        'You are not registered as an errander. Use /register_errander to start the registration process.'
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
    logger.error(`Error in showErranderReviews: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error retrieving your reviews. Please try again later.');
  }
};

/**
 * Handle the errander confirming payment received
 * @param {Object} ctx - Telegram context object
 */
const confirmErrandPaymentReceived = async (ctx) => {
  try {
    const erranderId = ctx.from.id;
    const groupId = ctx.chat.id;
    
    logger.info(`Errander ${erranderId} confirming payment received in group ${groupId}`);
    
    // Get group information
    const groupResult = await db.query(
      `SELECT * FROM groups WHERE "groupId" = $1 AND "erranderId" = $2`,
      [groupId.toString(), erranderId]
    );
    
    if (groupResult.rows.length === 0) {
      return await ctx.reply('This command can only be used in an active errand group by the errander.');
    }
    
    const group = groupResult.rows[0];
    
    // Update errand status to in_progress
    await db.query(
      `UPDATE errands SET status = 'in_progress', "updatedAt" = NOW() WHERE "errandId" = $1`,
      [group.errandId]
    );
    
    await ctx.reply(
      '✅ Payment confirmation received! The errand status is now "in progress".\n\n' +
      'Please proceed with the errand. When you complete the errand, remind the customer to use /delivery_successful'
    );
    
    return { 
      confirmed: true,
      groupId,
      errandId: group.errandId
    };
    
  } catch (error) {
    logger.error(`Error in confirmErrandPaymentReceived: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your confirmation. Please try again later.');
    return { confirmed: false };
  }
};

/**
 * Make an offer for an errand
 * @param {Object} ctx - Telegram context object
 * @param {Array} args - Command arguments [errandId, price]
 */
const makeErrandOffer = async (ctx, args) => {
  try {
    const erranderId = ctx.from.id;
    
    if (!args || args.length < 2) {
      return await ctx.reply('Please provide errand ID and price: /offer <errandId> <price>');
    }
    
    const errandId = args[0];
    const price = parseFloat(args[1]);
    
    // Validate inputs
    if (isNaN(price) || price <= 0) {
      return await ctx.reply('Please provide a valid price (greater than 0).');
    }
    
    logger.info(`Errander ${erranderId} making offer for errand ${errandId} at price ${price}`);
    
    // Check if errander is verified
    const erranderResult = await db.query(
      `SELECT "isVerified" FROM users WHERE "telegramId" = $1 AND role = 'errander'`,
      [erranderId]
    );
    
    if (erranderResult.rows.length === 0 || !erranderResult.rows[0].isVerified) {
      return await ctx.reply('You must be a verified errander to make offers. Use /register_errander to complete your registration.');
    }
    
    // Check if errand exists and is pending
    const errandResult = await db.query(
      `SELECT * FROM errands WHERE "errandId" = $1 AND status = 'pending'`,
      [errandId]
    );
    
    if (errandResult.rows.length === 0) {
      return await ctx.reply('Errand not found or not available for offers.');
    }
    
    // Check if errander already made an offer for this errand
    const existingOfferResult = await db.query(
      `SELECT * FROM offers WHERE "errandId" = $1 AND "erranderId" = $2 AND status = 'pending'`,
      [errandId, erranderId]
    );
    
    if (existingOfferResult.rows.length > 0) {
      return await ctx.reply('You have already made an offer for this errand.');
    }
    
    // Create offer
    await db.query(
      `INSERT INTO offers ("offerId", "errandId", "erranderId", "price", "status", "createdAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, 'pending', NOW())`,
      [errandId, erranderId, price]
    );
    
    await ctx.reply(
      `Your offer for errand ${errandId} has been submitted.\n` +
      `Price: ₦${price.toFixed(2)}\n\n` +
      `You will be notified if the customer accepts your offer.`
    );
    
    // Get customer telegram ID to notify them
    const customerTelegramId = errandResult.rows[0].customerTelegramId;
    
    // Get errander details for the notification
    const erranderDetailsResult = await db.query(
      `SELECT "fullName", rating FROM users WHERE "telegramId" = $1`,
      [erranderId]
    );
    
    const erranderName = erranderDetailsResult.rows[0].fullName;
    const erranderRating = erranderDetailsResult.rows[0].rating;
    
    return {
      notifyCustomer: true,
      customerTelegramId,
      message: 
        `🚨 New Offer for Your Errand 🚨\n\n` +
        `Errander: ${erranderName} (${erranderRating.toFixed(1)} ⭐)\n` +
        `Price: ₦${price.toFixed(2)}\n\n` +
        `To accept this offer, use:\n/accept_offer <offerId>`
    };
    
  } catch (error) {
    logger.error(`Error in makeErrandOffer: ${error.message}`, { telegramId: ctx.from.id, args, error });
    await ctx.reply('Sorry, there was an error submitting your offer. Please try again later.');
    return { notifyCustomer: false };
  }
};

module.exports = {
  startErranderRegistration,
  handleErranderRegistrationMessage,
  handleErranderRegistrationPhoto,
  showErranderProfile,
  showErranderReviews,
  confirmErrandPaymentReceived,
  makeErrandOffer
};