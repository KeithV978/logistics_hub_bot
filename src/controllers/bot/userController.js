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
const { Scenes } = require('telegraf');

// Create registration wizard scene
const registrationWizard = new Scenes.WizardScene(
  'registration',
  // Step 1 - Full Name
  async (ctx) => {
    await sendMessage(ctx, 'Please enter your full name:');
    return ctx.wizard.next();
  },
  // Step 2 - Email
  async (ctx) => {
    ctx.wizard.state.fullName = ctx.message.text;
    await sendMessage(ctx, 'Please enter your email address:');
    return ctx.wizard.next();
  },
  // Step 3 - Phone Number  
  async (ctx) => {
    ctx.wizard.state.email = ctx.message.text;
    await sendMessage(ctx, 'Please enter your phone number:');
    return ctx.wizard.next();
  },
  // Step 4 - Bank Details
  async (ctx) => {
    ctx.wizard.state.phoneNumber = ctx.message.text;
    await sendMessage(ctx, 'Please enter your bank account number:');
    return ctx.wizard.next();
  },
  // Step 5 - Bank Name
  async (ctx) => {
    ctx.wizard.state.bankAccountNumber = ctx.message.text;
    await sendMessage(ctx, 'Please enter your bank name:');
    return ctx.wizard.next();
  },
  // Step 6 - Account Name
  async (ctx) => {
    ctx.wizard.state.bankName = ctx.message.text;
    await sendMessage(ctx, 'Please enter the account name:');
    return ctx.wizard.next();
  },
  // Step 7 - NIN
  async (ctx) => {
    ctx.wizard.state.accountName = ctx.message.text;
    await sendMessage(ctx, 'Please enter your NIN (National Identification Number):');
    return ctx.wizard.next();
  },
  // Step 8 - Documents
  async (ctx) => {
    ctx.wizard.state.nin = ctx.message.text;
    await sendMessage(ctx, 'Please upload the required documents (ID card, proof of address, etc.):');
    return ctx.wizard.next();
  },
  // Final Step - Create User
  async (ctx) => {
    try {
      const userData = {
        telegramId: ctx.from.id.toString(),
        fullName: ctx.wizard.state.fullName,
        email: ctx.wizard.state.email,
        phoneNumber: ctx.wizard.state.phoneNumber,
        bankAccountDetails: {
          accountNumber: ctx.wizard.state.bankAccountNumber,
          bankName: ctx.wizard.state.bankName,
          accountName: ctx.wizard.state.accountName
        },
        nin: ctx.wizard.state.nin,
        role: ctx.wizard.state.role || 'user',
        documents: ctx.message.document ? ctx.message.document.file_id : null
      };

      const user = await createUser(userData);
      await sendMessage(ctx, 'Registration completed successfully! Use /profile to view your details.');
      return ctx.scene.leave();
    } catch (error) {
      console.error('Error creating user:', error);
      await sendMessage(ctx, 'Sorry, something went wrong during registration. Please try again.');
      return ctx.scene.leave();
    }
  }
);

// Handler for registration command
async function handleRegistrationCommand(ctx) {
  try {
    const existingUser = await User.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    if (existingUser) {
      return sendMessage(ctx, 'You are already registered!');
    }

    await ctx.scene.enter('registration');
  } catch (error) {
    console.error('Error in registration command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
  }
}
}

// Registration process handler
// async function handleRegistrationProcess(ctx) {
//   if (!ctx.session?.registration) return;
//   // Check if user already exists in database
//   const existingUser = await User.findOne({
//     where: { telegramId: ctx.from.id.toString() }
//   });

//   if (existingUser) {
//     const profileMessage = `
// Your Profile:
// - Name: ${existingUser.fullName}
// - Role: ${existingUser.role}
// - Rating: ${existingUser.rating.toFixed(1)} (${existingUser.totalRatings} ratings) 
// - Verification Status: ${existingUser.isVerified ? '✅ Verified' : '❌ Not Verified'}
// - Active Status: ${existingUser.isActive ? '🟢 Active' : '🔴 Inactive'}
// ${existingUser.role === 'rider' ? `- Vehicle Type: ${existingUser.vehicleType || 'Not specified'}` : ''}
// `;
//     return sendMessage(ctx, profileMessage);
//   }


//   try {
//     const { registration } = ctx.session;

//     // Try to delete user's message
//     try {
//       await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
//     } catch (error) {
//       console.log('Could not delete user message');
//     }

//     switch (registration.step) {
//       case 'fullName':
//         registration.fullName = ctx.message.text;
//         registration.step = 'phoneNumber';
//         return sendMessage(ctx, 'Please enter your phone number:');

//       case 'phoneNumber':
//         registration.phoneNumber = ctx.message.text;
//         registration.step = 'bankDetails';
//         return sendMessage(ctx, 'Please enter your bank account details (Account number and Bank name):');

//       case 'bankDetails':
//         registration.bankAccountDetails = { details: ctx.message.text };
//         registration.step = 'nin';
//         return sendMessage(ctx, 'Please enter your NIN (National Identification Number):');

//       case 'nin':
//         registration.nin = ctx.message.text;
        
//         const ninVerification = await verifyNIN(registration.nin);
//         if (!ninVerification.isValid) {
//           return sendMessage(ctx, 'Invalid NIN. Please enter a valid NIN:');
//         }

//         registration.step = 'photo';
//         return sendMessage(ctx, 'Please send your photograph:', {
//           reply_markup: {
//             keyboard: [[{ text: '📸 Send Photo', request_contact: false }]],
//             resize_keyboard: true,
//             one_time_keyboard: true
//           }
//         });

//       case 'vehicleType':
//         registration.vehicleType = ctx.message.text;
//         await createUser(registration);
//         ctx.session = null;
//         return sendMessage(ctx, 'Registration successful! Your account will be verified soon.', {
//           reply_markup: { remove_keyboard: true }
//         });
//     }
//   } catch (error) {
//     console.error('Error in registration process:', error);
//     ctx.session = null;
//     return sendMessage(ctx, 'Sorry, something went wrong during registration. Please try again with /register_rider or /register_errander.', {
//       reply_markup: { remove_keyboard: true }
//     });
//   }
// }

// Photo handler for registration
// async function handleRegistrationPhoto(ctx) {
//   if (!ctx.session?.registration || ctx.session.registration.step !== 'photo') return;

//   try {
//     const { registration } = ctx.session;
//     const photo = ctx.message.photo[ctx.message.photo.length - 1];
//     registration.photograph = photo.file_id;

//     // Try to delete user's photo message
//     try {
//       await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
//     } catch (error) {
//       console.log('Could not delete photo message');
//     }

//     if (registration.role === 'rider') {
//       registration.step = 'vehicleType';
//       return sendMessage(ctx, 'Please specify your vehicle type:', {
//         reply_markup: {
//           keyboard: [
//             ['🏍️ Motorcycle', '🚗 Car'],
//             ['🚚 Van', '🚛 Truck']
//           ],
//           resize_keyboard: true,
//           one_time_keyboard: true
//         }
//       });
//     }

//     await createUser(registration);
//     ctx.session = null;
//     return sendMessage(ctx, 'Registration successful! Your account will be verified soon.', {
//       reply_markup: { remove_keyboard: true }
//     });
//   } catch (error) {
//     console.error('Error handling photo:', error);
//     ctx.session = null;
//     return sendMessage(ctx, 'Sorry, something went wrong during registration. Please try again.', {
//       reply_markup: { remove_keyboard: true }
//     });
//   }
// }

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
}; 