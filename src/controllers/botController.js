const { bot } = require('../config/telegram');
const { User } = require('../models');

// Start command
bot.command('start', async (ctx) => {
  try {
    const { id: telegramId } = ctx.from;
    const user = await User.findOne({ where: { telegramId: telegramId.toString() } });

    if (user) {
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
- /create_order - Create a new logistics or errand order
- /my_orders - View your orders
- /my_offers - View your offers
`;
  return ctx.reply(helpMessage);
});

// Profile command
bot.command('profile', async (ctx) => {
  try {
    const { id: telegramId } = ctx.from;
    const user = await User.findOne({ where: { telegramId: telegramId.toString() } });

    if (!user) {
      return ctx.reply('Please register first using /register_rider or /register_errander.');
    }

    const profileMessage = `
Your Profile:
- Name: ${user.fullName}
- Role: ${user.role}
- Rating: ${user.rating.toFixed(1)} (${user.totalRatings} ratings)
- Verification Status: ${user.isVerified ? '✅ Verified' : '❌ Not Verified'}
- Active Status: ${user.isActive ? '🟢 Active' : '🔴 Inactive'}
${user.role === 'rider' ? `- Vehicle Type: ${user.vehicleType || 'Not specified'}` : ''}
`;
    return ctx.reply(profileMessage);
  } catch (error) {
    console.error('Error in profile command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Register command handlers
bot.command(['register_rider', 'register_errander'], async (ctx) => {
  const role = ctx.message.text.includes('rider') ? 'rider' : 'errander';
  
  try {
    const { id: telegramId } = ctx.from;
    const existingUser = await User.findOne({ where: { telegramId: telegramId.toString() } });

    if (existingUser) {
      return ctx.reply('You are already registered!');
    }

    // Start registration process
    ctx.session = {
      registrationData: {
        telegramId: telegramId.toString(),
        role,
        step: 'fullName',
      },
    };

    return ctx.reply('Please enter your full name:');
  } catch (error) {
    console.error('Error in registration command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

// Handle registration process
bot.on('text', async (ctx) => {
  if (!ctx.session?.registrationData) {
    return;
  }

  const { registrationData } = ctx.session;

  try {
    switch (registrationData.step) {
      case 'fullName':
        registrationData.fullName = ctx.message.text;
        registrationData.step = 'phoneNumber';
        return ctx.reply('Please enter your phone number:');

      case 'phoneNumber':
        registrationData.phoneNumber = ctx.message.text;
        registrationData.step = 'bankDetails';
        return ctx.reply('Please enter your bank account details (Account number and Bank name):');

      case 'bankDetails':
        registrationData.bankAccountDetails = { details: ctx.message.text };
        registrationData.step = 'nin';
        return ctx.reply('Please enter your NIN (National Identification Number):');

      case 'nin':
        registrationData.nin = ctx.message.text;
        registrationData.step = 'photo';
        return ctx.reply('Please send your photograph:');

      case 'photo':
        if (!ctx.message.photo) {
          return ctx.reply('Please send a valid photograph.');
        }

        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        registrationData.photograph = photoId;

        if (registrationData.role === 'rider') {
          registrationData.step = 'vehicleType';
          return ctx.reply('Please specify your vehicle type:');
        }

        // Create user for errander
        await createUser(registrationData);
        ctx.session = null;
        return ctx.reply('Registration successful! Your account will be verified soon.');

      case 'vehicleType':
        registrationData.vehicleType = ctx.message.text;
        await createUser(registrationData);
        ctx.session = null;
        return ctx.reply('Registration successful! Your account will be verified soon.');
    }
  } catch (error) {
    console.error('Error in registration process:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong during registration. Please try again with /register_rider or /register_errander.');
  }
});

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
  });
}

module.exports = bot; 