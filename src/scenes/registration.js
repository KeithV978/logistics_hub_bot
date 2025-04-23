const { Scenes } = require('telegraf');
const config = require('../config/config');
const UserService = require('../services/user');
const logger = require('../utils/logger');

const registrationScene = new Scenes.WizardScene(
  'registration',
  // Step 1: Get full name
  async (ctx) => {
    try {
      ctx.scene.state.role = ctx.scene.state.role || ctx.match[1];
      await ctx.cleanup();
      await ctx.reply('Please enter your full name:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 1 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
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
  // Step 3: Get bank account
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text || !config.PHONE_REGEX.test(ctx.message.text)) {
        await ctx.reply(config.messages.invalidPhone);
        return;
      }
      
      ctx.scene.state.phoneNumber = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your bank account details:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 3 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 4: Get NIN
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter valid bank account details.');
        return;
      }
      
      ctx.scene.state.bankAccount = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your National Identification Number (NIN):');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Registration step 4 error:', error);
      await ctx.reply('Sorry, there was an error. Please try /register again.');
      return ctx.scene.leave();
    }
  },
  // Step 5: Complete registration
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter a valid NIN.');
        return;
      }
      
      const nin = ctx.message.text;
      await ctx.cleanup();
      
      // Verify NIN
      try {
        const isValid = await UserService.verifyNIN(nin);
        if (!isValid) {
          await ctx.reply('Invalid NIN provided. Please try /register again.');
          return ctx.scene.leave();
        }
      } catch (error) {
        logger.error('NIN verification error:', error);
        // Continue with manual verification if NIN service is down
        await ctx.telegram.sendMessage(
          config.ADMIN_CHAT_ID,
          `Manual verification needed for user ${ctx.from.id}\nNIN: ${nin}`
        );
      }
      
      // Update user details
      await UserService.updateRegistrationDetails(ctx.from.id, {
        fullName: ctx.scene.state.fullName,
        phoneNumber: ctx.scene.state.phoneNumber,
        bankAccount: ctx.scene.state.bankAccount,
        nin: nin
      });
      
      await ctx.reply(config.messages.verificationPending);
      return ctx.scene.leave();
    } catch (error) {
      logger.error('Registration completion error:', error);
      await ctx.reply('Sorry, there was an error completing your registration. Please try /register again.');
      return ctx.scene.leave();
    }
  }
);

// Handle /cancel command in scene
registrationScene.command('cancel', async (ctx) => {
  await ctx.cleanup();
  await ctx.reply('Registration cancelled. Use /register to start again.');
  return ctx.scene.leave();
});

module.exports = registrationScene;