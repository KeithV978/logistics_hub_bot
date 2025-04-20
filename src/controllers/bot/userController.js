const { Markup } = require('telegraf');
const { User } = require('../../models');
const { verifyNIN } = require('../../services/ninVerification');
const { sendMessage } = require('../../utils/sendMessage');
 

// Profile command handler
async function handleProfileCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return sendMessage(ctx, 'Please register first using /register_rider or /register_errander.');
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
    return sendMessage(ctx, profileMessage);
  } catch (error) {
    console.error('Error in profile command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
  }
}

// Registration command handler
async function handleRegistrationCommand(ctx) {
  try {
    if (ctx.state.user) {
      return sendMessage(ctx, 'You are already registered!');
    }

    const role = ctx.message.text.includes('rider') ? 'rider' : 'errander';
    ctx.session = {
      registration: {
        telegramId: ctx.from.id.toString(),
        role,
        step: 'fullName'
      }
    };

    return sendMessage(ctx, 'Please enter your full name:', {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error in registration command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
  }
}

// Registration process handler
async function handleRegistrationProcess(ctx) {
  if (!ctx.session?.registration) return;
  // Check if user already exists in database
  const existingUser = await User.findOne({
    where: { telegramId: ctx.from.id.toString() }
  });

  if (existingUser) {
    const profileMessage = `
Your Profile:
- Name: ${existingUser.fullName}
- Role: ${existingUser.role}
- Rating: ${existingUser.rating.toFixed(1)} (${existingUser.totalRatings} ratings) 
- Verification Status: ${existingUser.isVerified ? '✅ Verified' : '❌ Not Verified'}
- Active Status: ${existingUser.isActive ? '🟢 Active' : '🔴 Inactive'}
${existingUser.role === 'rider' ? `- Vehicle Type: ${existingUser.vehicleType || 'Not specified'}` : ''}
`;
    return sendMessage(ctx, profileMessage);
  }


  try {
    const { registration } = ctx.session;

    // Try to delete user's message
    try {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    } catch (error) {
      console.log('Could not delete user message');
    }

    switch (registration.step) {
      case 'fullName':
        registration.fullName = ctx.message.text;
        registration.step = 'phoneNumber';
        return sendMessage(ctx, 'Please enter your phone number:');

      case 'phoneNumber':
        registration.phoneNumber = ctx.message.text;
        registration.step = 'bankDetails';
        return sendMessage(ctx, 'Please enter your bank account details (Account number and Bank name):');

      case 'bankDetails':
        registration.bankAccountDetails = { details: ctx.message.text };
        registration.step = 'nin';
        return sendMessage(ctx, 'Please enter your NIN (National Identification Number):');

      case 'nin':
        registration.nin = ctx.message.text;
        
        const ninVerification = await verifyNIN(registration.nin);
        if (!ninVerification.isValid) {
          return sendMessage(ctx, 'Invalid NIN. Please enter a valid NIN:');
        }

        registration.step = 'photo';
        return sendMessage(ctx, 'Please send your photograph:', {
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
        return sendMessage(ctx, 'Registration successful! Your account will be verified soon.', {
          reply_markup: { remove_keyboard: true }
        });
    }
  } catch (error) {
    console.error('Error in registration process:', error);
    ctx.session = null;
    return sendMessage(ctx, 'Sorry, something went wrong during registration. Please try again with /register_rider or /register_errander.', {
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

    // Try to delete user's photo message
    try {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    } catch (error) {
      console.log('Could not delete photo message');
    }

    if (registration.role === 'rider') {
      registration.step = 'vehicleType';
      return sendMessage(ctx, 'Please specify your vehicle type:', {
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
    return sendMessage(ctx, 'Registration successful! Your account will be verified soon.', {
      reply_markup: { remove_keyboard: true }
    });
  } catch (error) {
    console.error('Error handling photo:', error);
    ctx.session = null;
    return sendMessage(ctx, 'Sorry, something went wrong during registration. Please try again.', {
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