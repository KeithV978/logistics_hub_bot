const { Markup, Scenes } = require('telegraf');
const { User } = require('../../models');
const { verifyNIN } = require('../../services/ninVerification');
const { sendMessage } = require('../../utils/sendMessage');
const { bot } = require('../../config/telegram');

// Helper function to delete recent messages
async function deleteMessages(ctx) {
  try {
    // Delete bot's message if it exists
    if (ctx.message?.message_id) {
      await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    }
    // Delete user's message if it exists
    if (ctx.message?.message_id - 1) {
      await ctx.deleteMessage(ctx.message.message_id - 1).catch(() => {});
    }
  } catch (error) {
    console.error('Error deleting messages:', error);
  }
}

// Create registration wizard scene
const registrationWizard = new Scenes.WizardScene(
  'registration',
  // Step 1 - Role Selection
  async (ctx) => {
    await deleteMessages(ctx);
    await sendMessage(ctx, 'Please select your role: ', {
      reply_markup: {
        keyboard: [
          ['🏍️ Rider', '🛍️ Errander']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return ctx.wizard.next();
  },
  // Step 2 - Full Name
  async (ctx) => {
    await deleteMessages(ctx);
    ctx.wizard.state.role = ctx.message.text.includes('Rider') ? 'rider' : 'errander';
    await sendMessage(ctx, 'Please enter your full name (Surname FirstName):');
    return ctx.wizard.next();
  },
  // Step 3 - Phone Number
  async (ctx) => {
    
    await deleteMessages(ctx);
    ctx.wizard.state.fullName = ctx.message.text;
    await sendMessage(ctx, 'Please enter your phone number:');
    return ctx.wizard.next();
  },
  // Step 4 - Location
  async (ctx) => {
    await deleteMessages(ctx);
    ctx.wizard.state.phoneNumber = ctx.message.text;
    await sendMessage(ctx, 'Please share your location:', {
      reply_markup: {
        keyboard: [[{ text: '📍 Share Location', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return ctx.wizard.next();
  },
  // Step 5 - Bank Account Number
  async (ctx) => {
    await deleteMessages(ctx);
    if (!ctx.message.location) {
      await sendMessage(ctx, 'Please share your location using the button below:', {
        reply_markup: {
          keyboard: [[{ text: '📍 Share Location', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }
    ctx.wizard.state.location = {
      latitude: ctx.message.location.latitude,
      longitude: ctx.message.location.longitude
    };
    await sendMessage(ctx, 'Please enter your bank account number:');
    return ctx.wizard.next();
  },
  // Step 6 - Bank Name
  async (ctx) => {
    await deleteMessages(ctx);
    ctx.wizard.state.bankAccountNumber = ctx.message.text;
    await sendMessage(ctx, 'Please enter your bank name:');
    return ctx.wizard.next();
  },
  // Step 7 - Account Name
  async (ctx) => {
    await deleteMessages(ctx);
    ctx.wizard.state.bankName = ctx.message.text;
    await sendMessage(ctx, 'Please enter your account name:');
    return ctx.wizard.next();
  },
  // Step 8 - Vehicle Type (for riders only)
  async (ctx) => {
    await deleteMessages(ctx);
    ctx.wizard.state.accountName = ctx.message.text;
    if (ctx.wizard.state.role === 'rider') {
      await sendMessage(ctx, 'Please select your vehicle type:', {
        reply_markup: {
          keyboard: [
            ['🚲 Bicycle', '🏍️ Motorcycle'],
            ['🚗 Car', '🚚 Van', '🚛 Truck']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else {
      ctx.wizard.state.vehicleType = null;
      return ctx.wizard.next();
    }
    return ctx.wizard.next();
  },
  // Step 9 - NIN
  async (ctx) => {
    await deleteMessages(ctx);
    if (ctx.wizard.state.role === 'rider') {
      ctx.wizard.state.vehicleType = ctx.message.text.split(' ')[1];
    }
    await sendMessage(ctx, 'Please enter your NIN (National Identification Number):');
    return ctx.wizard.next();
  },
  // Step 10 - Photo
  async (ctx) => {
    await deleteMessages(ctx);
    ctx.wizard.state.nin = ctx.message.text;
    // Verify NIN
    const ninVerification = await verifyNIN(ctx.wizard.state.nin);
    if (!ninVerification.isValid) {
      await sendMessage(ctx, 'Invalid NIN. Please start the registration process again.');
      return ctx.scene.leave();
    }
    await sendMessage(ctx, 'Please send your photograph:', {
      reply_markup: {
        keyboard: [[{ text: '📸 Send Photo' }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return ctx.wizard.next();
  },
  // Step 11 - Eligibility Slip
  async (ctx) => {
    await deleteMessages(ctx);
    if (!ctx.message.photo) {
      await sendMessage(ctx, 'Please send a photo. Try again:');
      return;
    }
    ctx.wizard.state.photograph = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    await sendMessage(ctx, 'Please upload your Eligibility slip document:');
    return ctx.wizard.next();
  },
  // Final Step - Create User
  async (ctx) => {
    await deleteMessages(ctx);
    try {
      if (!ctx.message.document) {
        await sendMessage(ctx, 'Please upload a document. Try again:');
        return;
      }

      const userData = {
        telegramId: ctx.from.id.toString(),
        fullName: ctx.wizard.state.fullName,
        phoneNumber: ctx.wizard.state.phoneNumber,
        location: ctx.wizard.state.location,
        bankAccountDetails: {
          accountNumber: ctx.wizard.state.bankAccountNumber,
          bankName: ctx.wizard.state.bankName,
          accountName: ctx.wizard.state.accountName
        },
        nin: ctx.wizard.state.nin,
        role: ctx.wizard.state.role,
        vehicleType: ctx.wizard.state.vehicleType,
        photograph: ctx.wizard.state.photograph,
        documents: ctx.message.document.file_id
      };

      const user = await createUser(userData);
      await sendMessage(ctx, 'Registration completed successfully! Use /profile to view your details.', {
        reply_markup: { remove_keyboard: true }
      });
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error creating user:', error);
      await sendMessage(ctx, 'Sorry, something went wrong during registration. Please try again.', {
        reply_markup: { remove_keyboard: true }
      });
      return ctx.scene.leave();
    }
  }
);

// Set up the stage with the wizard
const stage = new Scenes.Stage([registrationWizard]);
bot.use(stage.middleware());

// Registration command handler
async function handleRegistrationCommand(ctx) { 
  try { 
    const existingUser = await User.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    if (existingUser) {
      return sendMessage(ctx, 'You are already registered!');
    }
    
    // Display welcome message
    await ctx.reply(`👋 Welcome to the signup wizard!

      I'll guide you through creating your account step by step.
      
      During registration, you'll need to provide:
      • Your role (rider or errander(errand runner))
      • Full name
      • Phone number
      • Bank account details
      • National ID Number (NIN)
      • Your photo
      • Eligibility Slip
      
      Let's get started! 🚀`);

    // Enter the registration scene
    return ctx.scene.enter('registration');
          
  } catch (error) {
    console.error('Error in registration command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.' + error);
  }
} 

// Profile command handler
async function handleProfileCommand(ctx) {
  try {
    if (!ctx.state.user) {
      return sendMessage(ctx, 'Please register first using the /start command.');
    }

    const user = ctx.state.user;
    let locationText = '';
    if (user.location) {
      locationText = `📍 Location: ${user.location.latitude}, ${user.location.longitude}\n`;
    }

    const profileMessage = `
👤 *Your Profile*

*Personal Details*
• Name: ${user.fullName}
• Role: ${user.role === 'rider' ? '🏍️ Rider' : '🛍️ Errander'}
• Phone: ${user.phoneNumber}
${locationText}
*Account Status*
• Verification: ${user.isVerified ? '✅ Verified' : '❌ Not Verified'}
• Status: ${user.isActive ? '🟢 Active' : '🔴 Inactive'}
• Rating: ${user.rating ? `⭐ ${user.rating.toFixed(1)} (${user.totalRatings} ratings)` : 'No ratings yet'}

*Bank Details*
• Bank: ${user.bankAccountDetails.bankName}
• Account Name: ${user.bankAccountDetails.accountName}
• Account Number: ${user.bankAccountDetails.accountNumber}

${user.role === 'rider' ? `*Vehicle Information*\n• Type: ${user.vehicleType || 'Not specified'}` : ''}

Use /help to see available commands.`;

    return sendMessage(ctx, profileMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in profile command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
  }
}

// Create user helper function
async function createUser(data) {
  return User.create({
    telegramId: data.telegramId,
    fullName: data.fullName,
    phoneNumber: data.phoneNumber,
    location: data.location,
    bankAccountDetails: {bankName: data.bankName, accountNumber: data.bankAccountNumber, accountName: data.accountName},
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
  handleRegistrationCommand,
  handleProfileCommand
}; 