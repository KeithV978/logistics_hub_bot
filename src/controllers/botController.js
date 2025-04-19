const { bot } = require('../config/telegram');
const { User, Order, Offer } = require('../models');
const { Markup } = require('telegraf');
const { Op } = require('sequelize');
const { verifyNIN } = require('../services/ninVerification');
const { calculateDistance } = require('../utils/location');

// Middleware to handle user state
bot.use(async (ctx, next) => {
  if (ctx.from) {
    ctx.state.user = await User.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });
  }
  return next();
});

// Start command
bot.command('start', async (ctx) => {
  try {
    if (ctx.state.user) {
      return ctx.reply('Welcome back! Use /help to see available commands.');
    }
    return ctx.reply(
      'Welcome to RiderFinder! Please register as a rider or errander using /register_rider or /register_errander.'
    );
  } catch (error) {
    console.error('Error in start command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Help command
bot.command('help', async (ctx) => {
  const helpMessage = `
Available commands:
- /start - Start the bot
- /help - Show this help message
- /register_rider - Register as a rider
- /register_errander - Register as an errander
- /profile - View your profile
- /create_order - Create a new logistics order
- /create_errand - Create a new errand order
- /my_orders - View your orders
- /my_offers - View your offers
- /toggle_active - Toggle your active status
`;
  return ctx.reply(helpMessage);
});

// Profile command
bot.command('profile', async (ctx) => {
  try {
    if (!ctx.state.user) {
      return ctx.reply('Please register first using /register_rider or /register_errander.');
    }

    const profileMessage = `
Your Profile:
- Name: ${ctx.state.user.fullName}
- Role: ${ctx.state.user.role}
- Rating: ${ctx.state.user.rating.toFixed(1)} (${ctx.state.user.totalRatings} ratings)
- Verification Status: ${ctx.state.user.isVerified ? '✅ Verified' : '❌ Not Verified'}
- Active Status: ${ctx.state.user.isActive ? '🟢 Active' : '🔴 Inactive'}
${ctx.state.user.role === 'rider' ? `- Vehicle Type: ${ctx.state.user.vehicleType || 'Not specified'}` : ''}
`;
    return ctx.reply(profileMessage);
  } catch (error) {
    console.error('Error in profile command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Registration commands
bot.command(['register_rider', 'register_errander'], async (ctx) => {
  try {
    if (ctx.state.user) {
      return ctx.reply('You are already registered!');
    }

    const role = ctx.message.text.includes('rider') ? 'rider' : 'errander';
    ctx.session = {
      registration: {
        telegramId: ctx.from.id.toString(),
        role,
        step: 'fullName'
      }
    };

    return ctx.reply('Please enter your full name:');
  } catch (error) {
    console.error('Error in registration command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Create order command
bot.command('create_order', async (ctx) => {
  try {
    ctx.session = {
      orderCreation: {
        type: 'logistics',
        step: 'pickup'
      }
    };
    return ctx.reply('Please share the pickup location:', 
      Markup.keyboard([
        [Markup.button.locationRequest('Share Pickup Location')]
      ]).resize());
  } catch (error) {
    console.error('Error in create order command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Create errand command
bot.command('create_errand', async (ctx) => {
  try {
    ctx.session = {
      orderCreation: {
        type: 'errand',
        step: 'location'
      }
    };
    return ctx.reply('Please share the errand location:', 
      Markup.keyboard([
        [Markup.button.locationRequest('Share Errand Location')]
      ]).resize());
  } catch (error) {
    console.error('Error in create errand command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Handle registration process
bot.on('text', async (ctx) => {
  if (!ctx.session?.registration) return;

  try {
    const { registration } = ctx.session;

    switch (registration.step) {
      case 'fullName':
        registration.fullName = ctx.message.text;
        registration.step = 'phoneNumber';
        return ctx.reply('Please enter your phone number:');

      case 'phoneNumber':
        registration.phoneNumber = ctx.message.text;
        registration.step = 'bankDetails';
        return ctx.reply('Please enter your bank account details (Account number and Bank name):');

      case 'bankDetails':
        registration.bankAccountDetails = { details: ctx.message.text };
        registration.step = 'nin';
        return ctx.reply('Please enter your NIN (National Identification Number):');

      case 'nin':
        registration.nin = ctx.message.text;
        
        // Verify NIN
        const ninVerification = await verifyNIN(registration.nin);
        if (!ninVerification.isValid) {
          return ctx.reply('Invalid NIN. Please enter a valid NIN:');
        }

        registration.step = 'photo';
        return ctx.reply('Please send your photograph:');

      case 'vehicleType':
        registration.vehicleType = ctx.message.text;
        await createUser(registration);
        ctx.session = null;
        return ctx.reply('Registration successful! Your account will be verified soon.');
    }
  } catch (error) {
    console.error('Error in registration process:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong during registration. Please try again with /register_rider or /register_errander.');
  }
});

// Handle location sharing
bot.on('location', async (ctx) => {
  if (!ctx.session?.orderCreation) return;

  try {
    const { orderCreation } = ctx.session;
    const { latitude, longitude } = ctx.message.location;

    switch (orderCreation.step) {
      case 'pickup':
        orderCreation.pickupLocation = { type: 'Point', coordinates: [longitude, latitude] };
        orderCreation.step = 'dropoff';
        return ctx.reply('Please share the drop-off location:', 
          Markup.keyboard([
            [Markup.button.locationRequest('Share Drop-off Location')]
          ]).resize());

      case 'dropoff':
        orderCreation.dropoffLocation = { type: 'Point', coordinates: [longitude, latitude] };
        orderCreation.step = 'instructions';
        return ctx.reply('Please provide delivery instructions:', Markup.removeKeyboard());

      case 'location':
        orderCreation.errandLocation = { type: 'Point', coordinates: [longitude, latitude] };
        orderCreation.step = 'instructions';
        return ctx.reply('Please provide errand details:', Markup.removeKeyboard());
    }
  } catch (error) {
    console.error('Error handling location:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong. Please try again.');
  }
});

// Handle photo for registration
bot.on('photo', async (ctx) => {
  if (!ctx.session?.registration || ctx.session.registration.step !== 'photo') return;

  try {
    const { registration } = ctx.session;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    registration.photograph = photo.file_id;

    if (registration.role === 'rider') {
      registration.step = 'vehicleType';
      return ctx.reply('Please specify your vehicle type:');
    }

    await createUser(registration);
    ctx.session = null;
    return ctx.reply('Registration successful! Your account will be verified soon.');
  } catch (error) {
    console.error('Error handling photo:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong during registration. Please try again.');
  }
});

// Create user helper function
async function createUser(data) {
  return User.create({
    telegramId: data.telegramId,
    fullName: data.fullName,
    phoneNumber: data.phoneNumber,
    bankAccountDetails: data.bankAccountDetails,
    photograph: data.photograph,
    nin: data.nin,
    role: data.role,
    vehicleType: data.vehicleType,
    isVerified: false,
    isActive: true,
    rating: 0,
    totalRatings: 0
  });
}

module.exports = bot; 