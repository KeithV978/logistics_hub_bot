const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const { verifyNIN } = require('../utils/helpers');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a new scene for rider registration
const riderRegistrationScene = new Scenes.WizardScene(
  'riderRegistrationScene',
  
  // Step 1: Welcome message and check if already registered
  async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Check if user is already registered as a rider
      const existingRider = await pool.query(
        'SELECT * FROM riders WHERE telegram_id = $1',
        [userId]
      );
      
      if (existingRider.rows.length > 0) {
        const rider = existingRider.rows[0];
        
        if (rider.is_verified) {
          await ctx.reply(
            '✅ You are already registered and verified as a rider.\n\n' +
            'You can start accepting delivery orders.'
          );
        } else {
          await ctx.reply(
            '⏳ You are already registered as a rider, but your verification is pending.\n\n' +
            'Our team is reviewing your information. You will be notified once verified.'
          );
        }
        
        return ctx.scene.leave();
      }
      
      // Initialize registration data
      ctx.wizard.state.riderData = {
        telegram_id: userId,
        full_name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '')
      };
      
      await ctx.reply(
        'Welcome to rider registration! 🚚\n\n' +
        'To register as a delivery rider, we need to collect some information from you.\n\n' +
        'You can type /cancel at any time to exit the registration process.\n\n' +
        'Let\'s start! Please enter your full name:'
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error in rider registration start:', error);
      await ctx.reply('Sorry, there was an error starting the registration process. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 2: Collect full name
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter your full name as text.');
        return;
      }
      
      const fullName = ctx.message.text.trim();
      
      if (fullName.length < 3) {
        await ctx.reply('Please enter a valid full name (at least 3 characters).');
        return;
      }
      
      ctx.wizard.state.riderData.full_name = fullName;
      
      await ctx.reply(
        'Great! Now please enter your phone number in the format: +1234567890'
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error collecting full name:', error);
      await ctx.reply('Sorry, there was an error processing your input. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Collect phone number
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter your phone number as text.');
        return;
      }
      
      const phoneNumber = ctx.message.text.trim();
      
      // Simple phone number validation
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(phoneNumber)) {
        await ctx.reply('Please enter a valid phone number (10-15 digits, optionally starting with +).');
        return;
      }
      
      ctx.wizard.state.riderData.phone_number = phoneNumber;
      
      await ctx.reply(
        'Now, please enter your bank account details in the following format:\n\n' +
        'Bank Name: [Your Bank]\n' +
        'Account Number: [Your Account Number]\n' +
        'Account Name: [Your Account Name]'
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error collecting phone number:', error);
      await ctx.reply('Sorry, there was an error processing your input. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 4: Collect bank account details
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter your bank account details as text.');
        return;
      }
      
      const bankDetails = ctx.message.text.trim();
      
      if (bankDetails.length < 10) {
        await ctx.reply('Please provide more detailed bank account information.');
        return;
      }
      
      ctx.wizard.state.riderData.bank_account_details = bankDetails;
      
      await ctx.reply(
        'Please upload a clear photograph of yourself (selfie) that shows your face clearly.'
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error collecting bank details:', error);
      await ctx.reply('Sorry, there was an error processing your input. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 5: Collect photo
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.photo) {
        await ctx.reply('Please upload a photograph of yourself. Send it as an image, not as a file.');
        return;
      }
      
      // Get the file ID of the largest photo (best quality)
      const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.wizard.state.riderData.photo_file_id = photoFileId;
      
      await ctx.reply(
        'Now, please enter your National Identification Number (NIN):'
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error collecting photo:', error);
      await ctx.reply('Sorry, there was an error processing your photo. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 6: Collect NIN
  async (ctx) => {
    try {
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply('Please enter your NIN as text.');
        return;
      }
      
      const nin = ctx.message.text.trim();
      
      // Simple NIN validation (adjust based on your country's NIN format)
      if (nin.length < 5) {
        await ctx.reply('Please enter a valid NIN.');
        return;
      }
      
      ctx.wizard.state.riderData.nin = nin;
      
      await ctx.reply(
        'Finally, please select your vehicle type:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🏍️ Motorcycle', 'vehicle_motorcycle'),
            Markup.button.callback('🚗 Car', 'vehicle_car')
          ],
          [
            Markup.button.callback('🚚 Van', 'vehicle_van'),
            Markup.button.callback('🚲 Bicycle', 'vehicle_bicycle')
          ]
        ])
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error collecting NIN:', error);
      await ctx.reply('Sorry, there was an error processing your input. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 7: Process vehicle selection and complete registration
  async (ctx) => {
    // This step is handled by action handlers below
    return;
  }
);

// Handle vehicle type selection
riderRegistrationScene.action(/^vehicle_(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const vehicleType = ctx.match[1];
    ctx.wizard.state.riderData.vehicle_type = vehicleType;
    
    // Show summary of collected information
    await ctx.editMessageText(
      '📋 Registration Summary:\n\n' +
      `Full Name: ${ctx.wizard.state.riderData.full_name}\n` +
      `Phone: ${ctx.wizard.state.riderData.phone_number}\n` +
      `Bank Details: ${ctx.wizard.state.riderData.bank_account_details}\n` +
      `NIN: ${ctx.wizard.state.riderData.nin}\n` +
      `Vehicle: ${vehicleType}\n\n` +
      'Is this information correct?',
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirm Registration', 'confirm_registration'),
        Markup.button.callback('❌ Cancel', 'cancel_registration')
      ])
    );
  } catch (error) {
    console.error('Error processing vehicle selection:', error);
    await ctx.reply('Sorry, there was an error processing your selection. Please try again later.');
    return ctx.scene.leave();
  }
});

// Handle registration confirmation
riderRegistrationScene.action('confirm_registration', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const riderData = ctx.wizard.state.riderData;
    
    // Attempt to verify NIN
    await ctx.editMessageText('Verifying your information... Please wait.');
    
    const ninVerification = await verifyNIN(riderData.nin);
    
    // Insert rider into database
    const riderResult = await pool.query(
      `INSERT INTO riders (
        telegram_id, full_name, phone_number, bank_account_details,
        photo_file_id, nin, is_verified, verification_status,
        verification_notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id`,
      [
        riderData.telegram_id,
        riderData.full_name,
        riderData.phone_number,
        riderData.bank_account_details,
        riderData.photo_file_id,
        riderData.nin,
        false, // is_verified (starts as false)
        ninVerification.verified ? 'PENDING_REVIEW' : 'PENDING_VERIFICATION',
        ninVerification.message
      ]
    );
    
    const riderId = riderResult.rows[0].id;
    
    // Insert vehicle information
    await pool.query(
      `INSERT INTO rider_vehicles (
        rider_id, vehicle_type, created_at, updated_at
      ) VALUES ($1, $2, NOW(), NOW())`,
      [
        riderData.telegram_id,
        riderData.vehicle_type
      ]
    );
    
    // Notify admin about new rider registration (in a real app)
    // await ctx.telegram.sendMessage(
    //   process.env.ADMIN_CHAT_ID,
    //   `🚨 New rider registration:\n\n` +
    //   `ID: ${riderId}\n` +
    //   `Name: ${riderData.full_name}\n` +
    //   `Phone: ${riderData.phone_number}\n` +
    //   `NIN: ${riderData.nin}\n` +
    //   `NIN Verification: ${ninVerification.verified ? 'Passed' : 'Failed'}\n` +
    //   `Vehicle: ${riderData.vehicle_type}\n\n` +
    //   `Use /verify_rider ${riderId} to approve this rider.`
    // );
    
    await ctx.editMessageText(
      '✅ Registration submitted successfully!\n\n' +
      'Your information will be verified by our team. ' +
      'This process usually takes 24-48 hours.\n\n' +
      'You will receive a notification once your account is verified and you can start accepting delivery orders.'
    );
    
    return ctx.scene.leave();
  } catch (error) {
    console.error('Error confirming registration:', error);
    await ctx.reply('Sorry, there was an error processing your registration. Please try again later.');
    return ctx.scene.leave();
  }
});

// Handle registration cancellation
riderRegistrationScene.action('cancel_registration', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Registration cancelled. You can start again with /register_rider.');
  return ctx.scene.leave();
});

// Handle cancellation during any step
riderRegistrationScene.command('cancel', async (ctx) => {
  await ctx.reply('Registration cancelled. You can start again with /register_rider.');
  return ctx.scene.leave();
});

module.exports = { riderRegistrationScene };
