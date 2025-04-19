const { Markup } = require('telegraf');
const { User } = require('../../models');
const { verifyNIN } = require('../../services/ninVerification');

// Profile command handler
async function handleProfileCommand(ctx) {
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
}

// Registration command handler
async function handleRegistrationCommand(ctx) {
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

    await ctx.reply('Please enter your full name:', {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error in registration command:', error);
    return ctx.reply('Sorry, something went wrong. Please try again later.');
  }
}

// Registration process handler
async function handleRegistrationProcess(ctx) {
  if (!ctx.session?.registration) return;

  try {
    const { registration } = ctx.session;
    const messageId = ctx.message.message_id;
    const prevMessageId = messageId - 1;

    // Try to delete the previous bot message
    try {
      await ctx.deleteMessage(prevMessageId);
    } catch (error) {
      console.log('Could not delete previous message');
    }

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
        
        const ninVerification = await verifyNIN(registration.nin);
        if (!ninVerification.isValid) {
          return ctx.reply('Invalid NIN. Please enter a valid NIN:');
        }

        registration.step = 'photo';
        return ctx.reply('Please send your photograph:', {
          reply_markup: {
            keyboard: [[{ text: '📸 Send Photo', request_contact: false }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });

      case 'vehicleType':
        registration.vehicleType = ctx.message.text;
        await createUser(registration);
        ctx.session = null;
        return ctx.reply('Registration successful! Your account will be verified soon.', {
          reply_markup: { remove_keyboard: true }
        });
    }
  } catch (error) {
    console.error('Error in registration process:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong during registration. Please try again with /register_rider or /register_errander.', {
      reply_markup: { remove_keyboard: true }
    });
  }
}

// Photo handler for registration
async function handleRegistrationPhoto(ctx) {
  if (!ctx.session?.registration || ctx.session.registration.step !== 'photo') return;

  try {
    const { registration } = ctx.session;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    registration.photograph = photo.file_id;

    if (registration.role === 'rider') {
      registration.step = 'vehicleType';
      return ctx.reply('Please specify your vehicle type:', {
        reply_markup: {
          keyboard: [
            ['🏍️ Motorcycle', '🚗 Car'],
            ['🚚 Van', '🚛 Truck']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }

    await createUser(registration);
    ctx.session = null;
    return ctx.reply('Registration successful! Your account will be verified soon.', {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error handling photo:', error);
    ctx.session = null;
    return ctx.reply('Sorry, something went wrong during registration. Please try again.', {
      reply_markup: { remove_keyboard: true }
    });
  }
}

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

module.exports = {
  handleProfileCommand,
  handleRegistrationCommand,
  handleRegistrationProcess,
  handleRegistrationPhoto
}; 