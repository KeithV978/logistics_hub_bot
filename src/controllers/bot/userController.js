const { Markup, Scenes } = require('telegraf');
const { User } = require('../../models');
const { verifyNIN } = require('../../services/ninVerification');
const { sendMessage } = require('../../utils/sendMessage'); 

// Profile command handler
// async function handleProfileCommand(ctx) {
//   try {
//     if (!ctx.state.user) {
//       return sendMessage(ctx, 'Please register first using /register_rider or /register_errander.');
//     }

//     const profileMessage = `
// Your Profile:
// - Name: ${ctx.state.user.fullName}
// - Role: ${ctx.state.user.role}
// - Rating: ${ctx.state.user.rating.toFixed(1)} (${ctx.state.user.totalRatings} ratings)
// - Verification Status: ${ctx.state.user.isVerified ? '✅ Verified' : '❌ Not Verified'}
// - Active Status: ${ctx.state.user.isActive ? '🟢 Active' : '🔴 Inactive'}
// ${ctx.state.user.role === 'rider' ? `- Vehicle Type: ${ctx.state.user.vehicleType || 'Not specified'}` : ''}
// `;
//     return sendMessage(ctx, profileMessage);
//   } catch (error) {
//     console.error('Error in profile command:', error);
//     return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
//   }
// }

// Registration command handler
async function handleRegistrationCommand(ctx) { 
  try { 
    const existingUser = await User.findOne({
      where: { telegramId: ctx.from.id.toString() }
    });

    if (existingUser) {
      return sendMessage(ctx, 'You are already registered!');
    }
    // Clear any existing registration data
    // ctx.session.registration = {
    //   telegramId: ctx.from.id,
    //   step: 'role'
    // };
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
          
          // Enter the registration wizard scene
          // ctx.scene.enter('registrationWizard');
        // } catch (error) {
        //   console.error('Error starting registration wizard:', error);
        //   return ctx.reply('Sorry, there was an error starting the registration process. Please try again later.');
        // } 
  // Create registration wizard scene
  const registrationWizard = new Scenes.WizardScene('registrationWizard',
    [
    // Step 1 - Full Name
    async (ctx) => {
      const summary = `Signup details:
No information yet.

Please enter your full name (Surname FirstName):`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
    // Step 2 - Role Selection
    async (ctx) => {
      ctx.wizard.state.fullName = ctx.message.text;
      const summary = `Signup details:
Full Name: ${ctx.wizard.state.fullName}

Please select your role:`;
      await sendMessage(ctx, summary, {
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
    // Step 3 - Email
    async (ctx) => {
      ctx.wizard.state.role = ctx.message.text;
      const summary = `Signup details:
Full Name: ${ctx.wizard.state.fullName}
Role: ${ctx.wizard.state.role}

Please enter your email address:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
    // Step 4 - Phone Number
    async (ctx) => {
      ctx.wizard.state.email = ctx.message.text;
      const summary = `Signup details:
Full Name: ${ctx.wizard.state.fullName}
Role: ${ctx.wizard.state.role}
Email: ${ctx.wizard.state.email}

Please enter your phone number:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
    // Step 5 - Bank Account Number
    async (ctx) => {
      ctx.wizard.state.phoneNumber = ctx.message.text;
      const summary = `Signup details:
Full Name: ${ctx.wizard.state.fullName}
Role: ${ctx.wizard.state.role}
Email: ${ctx.wizard.state.email}
Phone: ${ctx.wizard.state.phoneNumber}

Please enter your bank account number:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
       
    // Step 6 - Bank Name
    async (ctx) => {
      ctx.wizard.state.bankAccountNumber = ctx.message.text;
      const summary = `Signup details:
Full Name: ${ctx.wizard.state.fullName}
Role: ${ctx.wizard.state.role}
Email: ${ctx.wizard.state.email}
Phone: ${ctx.wizard.state.phoneNumber}
Bank Account Number: ${ctx.wizard.state.bankAccountNumber}
Please enter your bank name:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
         
    // Step 7 - Account Name
    async (ctx) => {
      ctx.wizard.state.bankName = ctx.message.text;
      const summary = `Signup details:
      Full Name: ${ctx.wizard.state.fullName}
      Role: ${ctx.wizard.state.role}
      Email: ${ctx.wizard.state.email}
      Phone: ${ctx.wizard.state.phoneNumber}
      Bank Account Number: ${ctx.wizard.state.bankAccountNumber}
      Bank Name: ${ctx.wizard.state.bankName}
      Please enter your account name:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next(); 
      
    },
      // Step 8 - Vehicle Type Selection
     async (ctx) => {
      ctx.wizard.state.vehicleType = ctx.message.text;
      const summary = `Signup details:
Full Name: ${ctx.wizard.state.fullName}
Role: ${ctx.wizard.state.role}
Email: ${ctx.wizard.state.email}
Phone: ${ctx.wizard.state.phoneNumber}
Bank Account Number: ${ctx.wizard.state.bankAccountNumber}
Bank Name: ${ctx.wizard.state.bankName}
Account Name: ${ctx.wizard.state.accountName}
      
Please select your vehicle type:`;
      await sendMessage(ctx, summary, {
        reply_markup: {
          keyboard: [
            ['🚲 Bicycle', '🏍️ Motorcycle', '🚗 Car', '🚚 Van', '🚛 Truck']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return ctx.wizard.next();
    },
    // Step 9 - NIN
    async (ctx) => { 
      ctx.wizard.state.vehicleType = ctx.message.text;
      const summary = `Signup details:
      Full Name: ${ctx.wizard.state.fullName}
      Role: ${ctx.wizard.state.role}
      Email: ${ctx.wizard.state.email}
      Phone: ${ctx.wizard.state.phoneNumber}
      Bank Account Number: ${ctx.wizard.state.bankAccountNumber}
      Bank Name: ${ctx.wizard.state.bankName}
      Account Name: ${ctx.wizard.state.accountName}
      Please enter your NIN:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
    // Step 10 - Documents
    async (ctx) => {
      ctx.wizard.state.nin = ctx.message.text;
      const summary = `Signup details:
      Full Name: ${ctx.wizard.state.fullName}
      Role: ${ctx.wizard.state.role}
      Email: ${ctx.wizard.state.email}
      Phone: ${ctx.wizard.state.phoneNumber}
      Bank Account Number: ${ctx.wizard.state.bankAccountNumber}
      Bank Name: ${ctx.wizard.state.bankName}
      Account Name: ${ctx.wizard.state.accountName}
      NIN: ${ctx.wizard.state.nin}
      Please upload your Eligibility slip:`;
      await sendMessage(ctx, summary);
      return ctx.wizard.next();
    },
    // Final Step - Create User
    async (ctx) => {
      ctx.wizard.state.eligibilitySlip = ctx.message.document ? ctx.message.document.file_id : null;
      try {
        // Verify NIN before creating user
        const ninVerification = await verifyNIN(ctx.wizard.state.nin);
        if (!ninVerification.isValid) {
          await sendMessage(ctx, 'Invalid NIN. Please start the registration process again.');
          return ctx.scene.leave();
        }

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
          role: ctx.wizard.state.role,
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
  ]);

 

 
  } catch (error) {
    console.error('Error in registration command:', error);
    return sendMessage(ctx, 'Sorry, something went wrong. Please try again later.');
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
  registrationWizard
}; 