const { Scenes } = require('telegraf');
const config = require('../config/config');
const CustomerService = require('../services/customer');
const { logger } = require('../utils/logger');

const customerRegistrationScene = new Scenes.WizardScene(
  'customer-registration',
  // Step 1: Start registration and get full name
  async (ctx) => {
    try {
      // Initialize customer record
      try {
        await CustomerService.startRegistration(ctx.from.id);
      } catch (error) {
        if (error.message === 'Customer already registered') {
          await ctx.reply('You are already registered as a customer.');
          return ctx.scene.leave();
        }
        throw error;
      }

      await ctx.cleanup();
      await ctx.reply('Welcome to customer registration! Please enter your full name:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 1 error:', error);
      await ctx.reply('Sorry, there was an error starting registration. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 2: Get email
  async (ctx) => {
    try {
      if (!ctx.message?.text) {
        await ctx.reply('Please enter a valid name.');
        return;
      }

      ctx.scene.state.fullName = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your email address:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 2 error:', error);
      await ctx.reply('Sorry, there was an error. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 3: Get phone number
  async (ctx) => {
    try {
      if (!ctx.message?.text || !validateEmail(ctx.message.text)) {
        await ctx.reply('Please enter a valid email address.');
        return;
      }

      ctx.scene.state.email = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please share your phone number (e.g., +1234567890):');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 3 error:', error);
      await ctx.reply('Sorry, there was an error. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 4: Get bank name
  async (ctx) => {
    try {
      if (!ctx.message?.text || !config.PHONE_REGEX.test(ctx.message.text)) {
        await ctx.reply(config.messages.invalidPhone);
        return;
      }

      ctx.scene.state.phoneNumber = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your bank name:');
      ctx.scene.state.bankAccount = {};
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 4 error:', error);
      await ctx.reply('Sorry, there was an error. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 5: Get account number
  async (ctx) => {
    try {
      if (!ctx.message?.text) {
        await ctx.reply('Please enter a valid bank name.');
        return;
      }

      ctx.scene.state.bankAccount.bankName = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter your account number:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 5 error:', error);
      await ctx.reply('Sorry, there was an error. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 6: Get account name
  async (ctx) => {
    try {
      if (!ctx.message?.text || !/^\d+$/.test(ctx.message.text)) {
        await ctx.reply('Please enter a valid account number (numbers only).');
        return;
      }

      ctx.scene.state.bankAccount.accountNumber = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Please enter the account name:');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 6 error:', error);
      await ctx.reply('Sorry, there was an error. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 7: Get default address (optional)
  async (ctx) => {
    try {
      if (!ctx.message?.text) {
        await ctx.reply('Please enter a valid account name.');
        return;
      }

      ctx.scene.state.bankAccount.accountName = ctx.message.text;
      await ctx.cleanup();
      await ctx.reply('Would you like to set a default address? Send your location or type the address (or type "skip"):');
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Customer registration step 7 error:', error);
      await ctx.reply('Sorry, there was an error. Please try again.');
      return ctx.scene.leave();
    }
  },

  // Step 8: Complete registration
  async (ctx) => {
    try {
      let defaultAddress = null;
      
      if (ctx.message?.location) {
        defaultAddress = {
          latitude: ctx.message.location.latitude,
          longitude: ctx.message.location.longitude,
          type: 'coordinates'
        };
      } else if (ctx.message?.text && ctx.message.text.toLowerCase() !== 'skip') {
        defaultAddress = {
          address: ctx.message.text,
          type: 'text'
        };
      }

      await ctx.cleanup();

      // Update customer details
      await CustomerService.updateRegistrationDetails(ctx.from.id, {
        fullName: ctx.scene.state.fullName,
        email: ctx.scene.state.email,
        phoneNumber: ctx.scene.state.phoneNumber,
        bankAccount: ctx.scene.state.bankAccount,
        defaultAddress
      });

      await ctx.reply('Registration completed successfully! You can now create orders and errands.');
      return ctx.scene.leave();
    } catch (error) {
      logger.error('Customer registration completion error:', error);
      await ctx.reply('Sorry, there was an error completing your registration. Please try again.');
      return ctx.scene.leave();
    }
  }
);

// Initialize scene state and message cleanup
customerRegistrationScene.enter(async (ctx) => {
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

  ctx.scene.state = {};
  return Promise.resolve();
});

// Handle /cancel command
customerRegistrationScene.command('cancel', async (ctx) => {
  await ctx.cleanup();
  await ctx.reply('Registration cancelled.');
  return ctx.scene.leave();
});

// Email validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

module.exports = customerRegistrationScene;