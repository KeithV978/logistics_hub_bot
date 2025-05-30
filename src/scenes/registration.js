const { Scenes } = require('telegraf');
const config = require('../config/config');
const UserService = require('../services/user');
const { logger } = require('../utils/logger');

const registrationScene = new Scenes.WizardScene(
  'registration',
  // Step 1: Get full name
  async (ctx) => {
    try {
      // console.log({role: ctx.scene.state.role})
      // Get role from scene state (set during scene.enter)
      if (!ctx.scene.state.role) {
        await ctx.reply('Invalid registration. Please use the signup buttons from the main menu /start.');
        return ctx.scene.leave();
      }

      // Initialize user record
      try {
        await UserService.startRegistration(ctx.from.id, ctx.scene.state.role);
      } catch (error) {
        if (error.message === 'User already registered') {
          await ctx.reply('You are already registered. Use /start to access the menu.');
          return ctx.scene.leave();
        }
        throw error;
      }
      
      await ctx.cleanup();
      await ctx.reply(config.messages.registerStart);
      return ctx.wizard.next();
    } catch (error) {
      // console.log({error: error})
      logger.error('Registration step 1 error:', { error: error.message, userId: ctx.from.id });
      await ctx.reply('Sorry, there was an error. Please try registering again from the main menu /start.');
      return ctx.scene.leave();
    }
  },
  // Step 2: Get phone number
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter a valid name.');
        return;
      }
      
      ctx.scene.state.fullName = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please share your phone number (e.g., +1234567890):');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 2 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 3: Get bank name
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text || !config.PHONE_REGEX.test(ctx.message.text)) {
        await ctx.reply(config.messages.invalidPhone);
        return;
      }
      
      ctx.scene.state.phoneNumber = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your bank name:');
      ctx.scene.state.bankDetails = {};
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 3 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 4: Get account number
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter a valid bank name.');
        return;
      }
      
      ctx.scene.state.bankDetails.bankName = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your account number:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 4 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 5: Get account name
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text || !/^\d+$/.test(ctx.message.text)) {
        await ctx.reply('Please enter a valid account number (numbers only).');
        return;
      }
      
      ctx.scene.state.bankDetails.accountNumber = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter the account name:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 5 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 6: Get vehicle type (for riders) or eligibility slip
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter a valid account name.');
        return;
      }
      
      ctx.scene.state.bankDetails.accountName = ctx.message.text;
      await ctx.cleanup();
      
      // Ask for eligibility slip upload
      await ctx.reply('Please upload your eligibility slip document (photo or PDF, max 5MB):');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 6 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 7: Handle eligibility slip and get vehicle type (for riders) or NIN
  async (ctx) => {
    try {
      // Check for file upload
      const document = ctx.message?.document || ctx.message?.photo?.[0];
      if (!document) {
        await ctx.reply('Please upload a valid document (photo or PDF).');
        return;
      }

      // Verify file size
      if (document.file_size > config.MAX_PHOTO_SIZE) {
        await ctx.reply(`File too large. Maximum size is ${config.MAX_PHOTO_SIZE / (1024 * 1024)}MB.`);
        return;
      }

      // Verify file type for documents (not needed for photos as they're pre-validated by Telegram)
      if (ctx.message?.document && !config.SUPPORTED_FILE_TYPES.includes(document.mime_type)) {
        await ctx.reply(config.messages.invalidFileType);
        return;
      }

      // Store file ID
      ctx.scene.state.eligibilitySlipFileId = document.file_id;
      await ctx.cleanup();
      await ctx.reply(config.messages.uploadSuccess);

      if (ctx.scene.state.role === 'rider') {
        // Show vehicle type selection keyboard for riders
        const keyboard = {
          inline_keyboard: config.VEHICLE_TYPES.map(type => ([
            { text: type, callback_data: `vehicle_${type}` }
          ]))
        };
        await ctx.reply(config.messages.selectVehicle, { reply_markup: keyboard });
        return ctx.wizard.next();
      } else {
        // Skip to NIN for erranders
        await ctx.reply('Please enter your National Identification Number (NIN):');
        ctx.scene.state.skipVehicle = true;
        return ctx.wizard.next();
      }
    } catch (error) {
      logger.error('Registration step 7 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 8: Get NIN (after vehicle type for riders)
  async (ctx) => {
    try {
      if (!ctx.scene.state.skipVehicle) {
        // Handle vehicle type selection for riders
        if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('vehicle_')) {
          await ctx.reply(config.messages.invalidVehicle);
          return;
        }
        ctx.scene.state.vehicleType = ctx.callbackQuery.data.replace('vehicle_', '');
        await ctx.answerCbQuery();
        await ctx.reply('Please enter your National Identification Number (NIN):');
        return ctx.wizard.next();
      }
      
      // Handle NIN input for erranders
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter a valid NIN.');
        return;
      }
      ctx.scene.state.nin = ctx.message.text;
      return await completeRegistration(ctx);
    } catch (error) {
      logger.error('Registration step 8 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 9: Complete registration (for riders)
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter a valid NIN.');
        return;
      }
      ctx.scene.state.nin = ctx.message.text;
      return await completeRegistration(ctx);
    } catch (error) {
      logger.error('Registration completion error:', error);
      await ctx.reply('Sorry, there was an error completing your registration. Please try /register again.');
      return ctx.scene.leave();
    }
  }
);

// Add scene enter handler to ensure clean state
registrationScene.enter(async (ctx) => {
  // Initialize message tracking for cleanup
  if (!ctx.session.messageIds) {
    ctx.session.messageIds = [];
  }

  // Initialize cleanup function if not already set
  if (!ctx.cleanup) {
    ctx.cleanup = async () => {
      try {
        for (const msgId of ctx.session.messageIds) {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
          } catch (error) {
            // Ignore errors from already deleted messages
            if (error.description !== 'Bad Request: message to delete not found') {
              logger.error('Message deletion error:', { messageId: msgId, error: error.message });
            }
          }
        }
        ctx.session.messageIds = [];
      } catch (error) {
        logger.error('Cleanup error:', error);
      }
    };
  }

  // Preserve only the role from scene state, clear everything else
  const role = ctx.scene.state.role;
  ctx.scene.state = { role };
  return Promise.resolve();
});

// Helper function to complete registration
async function completeRegistration(ctx) {
  try {
    await ctx.cleanup();
    
    let verificationStatus = 'pending';
    
    // Verify NIN
    try {
      const isValid = await UserService.verifyNIN(ctx.scene.state.nin);
      if (!isValid) {
        await ctx.reply('Invalid NIN provided. Please try /register again.');
        return ctx.scene.leave();
      }
      verificationStatus = 'pending_manual'; // NIN valid but needs manual check
    } catch (error) {
      logger.error('NIN verification error:', error);
      verificationStatus = 'pending_manual'; // Service down, needs manual verification
      await ctx.telegram.sendMessage(
        config.ADMIN_CHAT_ID,
        `Manual verification needed for user ${ctx.from.id}\nNIN: ${ctx.scene.state.nin}\nReason: ${error.message}`
      );
    }
    
    // Update user details
    await UserService.updateRegistrationDetails(ctx.from.id, {
      fullName: ctx.scene.state.fullName,
      phoneNumber: ctx.scene.state.phoneNumber,
      bankAccount: ctx.scene.state.bankDetails,
      vehicleType: ctx.scene.state.vehicleType,
      nin: ctx.scene.state.nin,
      eligibilitySlipFileId: ctx.scene.state.eligibilitySlipFileId,
      verificationStatus: verificationStatus
    });
    
    await ctx.reply(config.messages.verificationPending);
    return ctx.scene.leave();
  } catch (error) {
    logger.error('Registration completion error:', error);
    await ctx.reply('Sorry, there was an error completing your registration. Please try /register again.');
    return ctx.scene.leave();
  }
}

// Handle /cancel command in scene
registrationScene.command('cancel', async (ctx) => {
  await ctx.cleanup();
  await ctx.reply('Registration cancelled. Use /register to start again.');
  return ctx.scene.leave();
});

module.exports = registrationScene;