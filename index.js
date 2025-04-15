require('dotenv').config();
const { Telegraf, session, Scenes } = require('telegraf');
const { Pool } = require('pg');
const axios = require('axios');
const express = require('express');
const winston = require('winston');
const cors = require('cors');
const crypto = require('crypto');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'logistics-hub-bot' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize bot with token
const bot = new Telegraf(process.env.BOT_TOKEN);

// Set up express server for webhook
const app = express();
app.use(express.json());
app.use(cors());

// Middleware
bot.use(session());

// Import scenes
const { customerOrderScene } = require('./src/scenes/customerOrderScene');
const { customerErrandScene } = require('./src/scenes/customerErrandScene');
const { riderRegistrationScene } = require('./src/scenes/riderRegistrationScene');
const { erranderRegistrationScene } = require('./src/scenes/erranderRegistrationScene');

// Create scene manager
const stage = new Scenes.Stage([
  customerOrderScene, 
  customerErrandScene, 
  riderRegistrationScene, 
  erranderRegistrationScene
]);
bot.use(stage.middleware());

// Helper functions
const { 
  findNearbyRiders, 
  findNearbyErranders, 
  createPrivateGroup,
  validateLocation,
  calculateDistance,
  verifyNIN,
  updateProviderLocation
} = require('./src/utils/helpers');

// Command handlers
bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to the Logistics and Errand Services Bot!\n\n' +
    'Available commands:\n' +
    '/create_order - Create a delivery order\n' +
    '/create_errand - Create an errand request\n' +
    '/register_rider - Register as a delivery rider\n' +
    '/register_errander - Register as an errand runner\n' +
    '/my_profile - View your profile'
  );
});

// Create order command - start the order scene
bot.command('create_order', (ctx) => ctx.scene.enter('customerOrderScene'));

// Create errand command - start the errand scene
bot.command('create_errand', (ctx) => ctx.scene.enter('customerErrandScene'));

// Register as rider command - start the rider registration scene
bot.command('register_rider', (ctx) => ctx.scene.enter('riderRegistrationScene'));

// Register as errander command - start the errander registration scene
bot.command('register_errander', (ctx) => ctx.scene.enter('erranderRegistrationScene'));

// Command to view profile
bot.command('my_profile', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Check if user is a rider
    const riderResult = await pool.query(
      'SELECT * FROM riders WHERE telegram_id = $1',
      [userId]
    );
    
    if (riderResult.rows.length > 0) {
      const rider = riderResult.rows[0];
      await ctx.reply(
        `📋 Rider Profile:\n\n` +
        `Name: ${rider.full_name}\n` +
        `Phone: ${rider.phone_number}\n` +
        `Rating: ${rider.rating ? rider.rating.toFixed(1) + '/5' : 'No ratings yet'}\n` +
        `Verification: ${rider.is_verified ? '✅ Verified' : '⏳ Pending'}`
      );
      return;
    }
    
    // Check if user is an errander
    const erranderResult = await pool.query(
      'SELECT * FROM erranders WHERE telegram_id = $1',
      [userId]
    );
    
    if (erranderResult.rows.length > 0) {
      const errander = erranderResult.rows[0];
      await ctx.reply(
        `📋 Errander Profile:\n\n` +
        `Name: ${errander.full_name}\n` +
        `Phone: ${errander.phone_number}\n` +
        `Rating: ${errander.rating ? errander.rating.toFixed(1) + '/5' : 'No ratings yet'}\n` +
        `Verification: ${errander.is_verified ? '✅ Verified' : '⏳ Pending'}`
      );
      return;
    }
    
    // If not a rider or errander
    await ctx.reply(
      `You don't have a registered profile yet.\n\n` +
      `Use /register_rider to register as a delivery rider\n` +
      `Use /register_errander to register as an errand runner`
    );
  } catch (error) {
    console.error('Profile fetch error:', error);
    await ctx.reply('Sorry, there was an error retrieving your profile. Please try again later.');
  }
});

// Handle offer submissions from riders and erranders
bot.command('make_offer', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 2) {
      await ctx.reply('Incorrect format. Use: /make_offer [order/errand ID] [price]');
      return;
    }
    
    const [jobId, price] = args;
    
    if (isNaN(price) || parseFloat(price) <= 0) {
      await ctx.reply('Please provide a valid price (greater than 0).');
      return;
    }
    
    // Check if the job exists and is still available
    const orderCheck = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND status = $2',
      [jobId, 'PENDING']
    );
    
    const errandCheck = await pool.query(
      'SELECT * FROM errands WHERE id = $1 AND status = $2',
      [jobId, 'PENDING']
    );
    
    let jobType, customerId;
    
    if (orderCheck.rows.length > 0) {
      // It's an order
      jobType = 'order';
      customerId = orderCheck.rows[0].customer_id;
      
      // Check if the user is a verified rider
      const riderCheck = await pool.query(
        'SELECT * FROM riders WHERE telegram_id = $1 AND is_verified = TRUE',
        [userId]
      );
      
      if (riderCheck.rows.length === 0) {
        await ctx.reply('You must be a verified rider to make offers on orders.');
        return;
      }
      
      // Check if rider already made an offer
      const existingOffer = await pool.query(
        'SELECT * FROM offers WHERE job_id = $1 AND provider_id = $2 AND job_type = $3',
        [jobId, userId, 'order']
      );
      
      if (existingOffer.rows.length > 0) {
        await ctx.reply('You have already made an offer for this order.');
        return;
      }
      
      // Create the offer
      await pool.query(
        'INSERT INTO offers (job_id, provider_id, job_type, price, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [jobId, userId, 'order', parseFloat(price), 'PENDING']
      );
      
      // Get rider information to include in notification
      const riderInfo = riderCheck.rows[0];
      
      // Get the rider's vehicle type
      const vehicleInfo = await pool.query(
        'SELECT vehicle_type FROM rider_vehicles WHERE rider_id = $1',
        [userId]
      );
      
      const vehicleType = vehicleInfo.rows.length > 0 ? vehicleInfo.rows[0].vehicle_type : 'Unknown';
      
      // Notify the customer about the new offer
      await bot.telegram.sendMessage(
        customerId,
        `New offer for your order #${jobId}:\n` +
        `Rider: ${riderInfo.full_name}\n` +
        `Price: $${parseFloat(price).toFixed(2)}\n` +
        `Rating: ${riderInfo.rating ? riderInfo.rating.toFixed(1) + '/5' : 'New rider'}\n` +
        `Vehicle: ${vehicleType}\n\n` +
        `To accept this offer, use: /accept_offer ${jobId}_${userId}`
      );
      
      await ctx.reply('Your offer has been submitted successfully!');
    } else if (errandCheck.rows.length > 0) {
      // It's an errand
      jobType = 'errand';
      customerId = errandCheck.rows[0].customer_id;
      
      // Check if the user is a verified errander
      const erranderCheck = await pool.query(
        'SELECT * FROM erranders WHERE telegram_id = $1 AND is_verified = TRUE',
        [userId]
      );
      
      if (erranderCheck.rows.length === 0) {
        await ctx.reply('You must be a verified errander to make offers on errands.');
        return;
      }
      
      // Check if errander already made an offer
      const existingOffer = await pool.query(
        'SELECT * FROM offers WHERE job_id = $1 AND provider_id = $2 AND job_type = $3',
        [jobId, userId, 'errand']
      );
      
      if (existingOffer.rows.length > 0) {
        await ctx.reply('You have already made an offer for this errand.');
        return;
      }
      
      // Create the offer
      await pool.query(
        'INSERT INTO offers (job_id, provider_id, job_type, price, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [jobId, userId, 'errand', parseFloat(price), 'PENDING']
      );
      
      // Get errander information to include in notification
      const erranderInfo = erranderCheck.rows[0];
      
      // Notify the customer about the new offer
      await bot.telegram.sendMessage(
        customerId,
        `New offer for your errand #${jobId}:\n` +
        `Errander: ${erranderInfo.full_name}\n` +
        `Price: $${parseFloat(price).toFixed(2)}\n` +
        `Rating: ${erranderInfo.rating ? erranderInfo.rating.toFixed(1) + '/5' : 'New errander'}\n\n` +
        `To accept this offer, use: /accept_offer ${jobId}_${userId}`
      );
      
      await ctx.reply('Your offer has been submitted successfully!');
    } else {
      await ctx.reply('This order/errand does not exist or is no longer available.');
    }
  } catch (error) {
    console.error('Make offer error:', error);
    await ctx.reply('Sorry, there was an error processing your offer. Please try again later.');
  }
});

// Handle offer acceptance
bot.command('accept_offer', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 1) {
      await ctx.reply('Incorrect format. Use: /accept_offer [job_id]_[provider_id]');
      return;
    }
    
    const [jobId, providerId] = args[0].split('_');
    
    if (!jobId || !providerId) {
      await ctx.reply('Incorrect format. Use: /accept_offer [job_id]_[provider_id]');
      return;
    }
    
    // Check if the order exists and belongs to this customer
    const orderCheck = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND customer_id = $2 AND status = $3',
      [jobId, userId, 'PENDING']
    );
    
    const errandCheck = await pool.query(
      'SELECT * FROM errands WHERE id = $1 AND customer_id = $2 AND status = $3',
      [jobId, userId, 'PENDING']
    );
    
    let jobType, jobDetails;
    
    if (orderCheck.rows.length > 0) {
      jobType = 'order';
      jobDetails = orderCheck.rows[0];
      
      // Update order status
      await pool.query(
        'UPDATE orders SET status = $1, assigned_rider_id = $2, updated_at = NOW() WHERE id = $3',
        ['ACCEPTED', providerId, jobId]
      );
    } else if (errandCheck.rows.length > 0) {
      jobType = 'errand';
      jobDetails = errandCheck.rows[0];
      
      // Update errand status
      await pool.query(
        'UPDATE errands SET status = $1, assigned_errander_id = $2, updated_at = NOW() WHERE id = $3',
        ['ACCEPTED', providerId, jobId]
      );
    } else {
      await ctx.reply('This order/errand does not exist, is not yours, or is no longer available.');
      return;
    }
    
    // Update offer status
    await pool.query(
      'UPDATE offers SET status = $1 WHERE job_id = $2 AND provider_id = $3 AND job_type = $4',
      ['ACCEPTED', jobId, providerId, jobType]
    );
    
    // Reject all other offers
    await pool.query(
      'UPDATE offers SET status = $1 WHERE job_id = $2 AND provider_id != $3 AND job_type = $4 AND status = $5',
      ['REJECTED', jobId, providerId, jobType, 'PENDING']
    );
    
    // Get provider details
    let providerDetails;
    if (jobType === 'order') {
      const riderResult = await pool.query(
        'SELECT * FROM riders WHERE telegram_id = $1',
        [providerId]
      );
      providerDetails = riderResult.rows[0];
    } else {
      const erranderResult = await pool.query(
        'SELECT * FROM erranders WHERE telegram_id = $1',
        [providerId]
      );
      providerDetails = erranderResult.rows[0];
    }
    
    // Create a private group for communication
    const groupInfo = await createPrivateGroup(
      bot,
      userId,
      parseInt(providerId),
      `${jobType.charAt(0).toUpperCase() + jobType.slice(1)} #${jobId}`
    );
    
    if (groupInfo) {
      // Store group info in the database
      await pool.query(
        'INSERT INTO chat_groups (job_id, job_type, group_id, customer_id, provider_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [jobId, jobType, groupInfo.id, userId, providerId]
      );
      
      // Send rules message to the group
      await bot.telegram.sendMessage(
        groupInfo.id,
        `🔔 *Rules of Engagement*:\n\n` +
        `1. Be respectful and professional\n` +
        `2. Share updates regularly\n` +
        `3. Report any issues to @admin\n\n` +
        `This group will be deleted after the transaction is completed.\n\n` +
        `${jobType === 'order' ? 'Rider' : 'Errander'}, please share your live location using the button below.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📍 Start Tracking', callback_data: `start_tracking_${jobId}_${jobType}` }]
            ]
          }
        }
      );
      
      // Notify the provider that their offer was accepted
      await bot.telegram.sendMessage(
        providerId,
        `Your offer for ${jobType} #${jobId} has been accepted! Check the private group for details.`
      );
      
      // Notify other providers that their offers were rejected
      const rejectedOffers = await pool.query(
        'SELECT provider_id FROM offers WHERE job_id = $1 AND provider_id != $2 AND job_type = $3 AND status = $4',
        [jobId, providerId, jobType, 'REJECTED']
      );
      
      for (const offer of rejectedOffers.rows) {
        await bot.telegram.sendMessage(
          offer.provider_id,
          `Your offer for ${jobType} #${jobId} was not selected. The ${jobType} has been assigned to another ${jobType === 'order' ? 'rider' : 'errander'}.`
        );
      }
      
      await ctx.reply(`Offer accepted! A private group has been created for communication with the ${jobType === 'order' ? 'rider' : 'errander'}.`);
    } else {
      // Revert status changes if group creation fails
      if (jobType === 'order') {
        await pool.query(
          'UPDATE orders SET status = $1, assigned_rider_id = NULL, updated_at = NOW() WHERE id = $2',
          ['PENDING', jobId]
        );
      } else {
        await pool.query(
          'UPDATE errands SET status = $1, assigned_errander_id = NULL, updated_at = NOW() WHERE id = $2',
          ['PENDING', jobId]
        );
      }
      
      await pool.query(
        'UPDATE offers SET status = $1 WHERE job_id = $2 AND provider_id = $3 AND job_type = $4',
        ['PENDING', jobId, providerId, jobType]
      );
      
      await ctx.reply('Failed to create a private group. Please try again or contact support.');
    }
  } catch (error) {
    console.error('Offer acceptance error:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
});

// Callback for start tracking
bot.action(/start_tracking_(\d+)_(\w+)/, async (ctx) => {
  try {
    const jobId = ctx.match[1];
    const jobType = ctx.match[2];
    const userId = ctx.from.id;
    
    let isProvider = false;
    
    // Check if user is the provider for this job
    if (jobType === 'order') {
      const orderCheck = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND assigned_rider_id = $2',
        [jobId, userId]
      );
      isProvider = orderCheck.rows.length > 0;
    } else {
      const errandCheck = await pool.query(
        'SELECT * FROM errands WHERE id = $1 AND assigned_errander_id = $2',
        [jobId, userId]
      );
      isProvider = errandCheck.rows.length > 0;
    }
    
    if (!isProvider) {
      await ctx.answerCbQuery('Only the assigned rider/errander can start tracking.');
      return;
    }
    
    // Send a message asking user to share their live location
    await ctx.reply(
      'Please share your live location by:\n' +
      '1. Tap the attachment button (📎)\n' +
      '2. Select "Location"\n' +
      '3. Choose "Share My Live Location"\n' +
      '4. Select the maximum duration'
    );
    
    await ctx.answerCbQuery('Please share your live location');
  } catch (error) {
    console.error('Start tracking error:', error);
    await ctx.answerCbQuery('Error starting tracking. Please try again.');
  }
});

// Handle live location updates
bot.on('location', async (ctx) => {
  try {
    if (ctx.message.location.live_period) {
      // This is a live location
      const userId = ctx.from.id;
      const chatId = ctx.chat.id;
      
      // Check if this is a group chat and if the user is an assigned provider
      const groupCheck = await pool.query(
        'SELECT * FROM chat_groups WHERE group_id = $1 AND provider_id = $2',
        [chatId, userId]
      );
      
      if (groupCheck.rows.length > 0) {
        const groupInfo = groupCheck.rows[0];
        
        // Update tracking status in database
        await pool.query(
          'INSERT INTO location_tracking (job_id, job_type, provider_id, latitude, longitude, is_live, created_at) ' +
          'VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [groupInfo.job_id, groupInfo.job_type, userId, ctx.message.location.latitude, ctx.message.location.longitude, true]
        );
        
        await ctx.reply('Live location sharing started successfully! The customer can now track your location.');
      }
    } else {
      // This is a static location (might be used during order/errand creation)
      // Will be handled by the appropriate scene
    }
  } catch (error) {
    console.error('Location handling error:', error);
    await ctx.reply('Sorry, there was an error processing your location. Please try again.');
  }
});

// Handle transaction completion commands
bot.command('payment_received', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    
    // Check if this is a group chat and if the user is an assigned provider
    const groupCheck = await pool.query(
      'SELECT * FROM chat_groups WHERE group_id = $1 AND provider_id = $2',
      [chatId, userId]
    );
    
    if (groupCheck.rows.length === 0) {
      await ctx.reply('This command can only be used in your job group by the rider/errander.');
      return;
    }
    
    const groupInfo = groupCheck.rows[0];
    
    // Update job status
    if (groupInfo.job_type === 'order') {
      await pool.query(
        'UPDATE orders SET payment_received = TRUE, updated_at = NOW() WHERE id = $1',
        [groupInfo.job_id]
      );
    } else {
      await pool.query(
        'UPDATE errands SET payment_received = TRUE, updated_at = NOW() WHERE id = $1',
        [groupInfo.job_id]
      );
    }
    
    // Check if transaction is complete
    const isComplete = await checkTransactionComplete(groupInfo.job_id, groupInfo.job_type);
    
    if (isComplete) {
      await completeTransaction(bot, groupInfo);
    } else {
      await ctx.reply('Payment received! Waiting for delivery confirmation from the customer.');
      
      // Notify customer
      await bot.telegram.sendMessage(
        groupInfo.customer_id,
        `The ${groupInfo.job_type === 'order' ? 'rider' : 'errander'} has confirmed payment receipt. Please confirm delivery with /delivery_successful when you're satisfied.`
      );
    }
  } catch (error) {
    console.error('Payment received error:', error);
    await ctx.reply('Sorry, there was an error processing your command. Please try again later.');
  }
});

bot.command('delivery_successful', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    
    // Check if this is a group chat and if the user is the customer
    const groupCheck = await pool.query(
      'SELECT * FROM chat_groups WHERE group_id = $1 AND customer_id = $2',
      [chatId, userId]
    );
    
    if (groupCheck.rows.length === 0) {
      await ctx.reply('This command can only be used in your job group by the customer.');
      return;
    }
    
    const groupInfo = groupCheck.rows[0];
    
    // Update job status
    if (groupInfo.job_type === 'order') {
      await pool.query(
        'UPDATE orders SET delivery_successful = TRUE, updated_at = NOW() WHERE id = $1',
        [groupInfo.job_id]
      );
    } else {
      await pool.query(
        'UPDATE errands SET delivery_successful = TRUE, updated_at = NOW() WHERE id = $1',
        [groupInfo.job_id]
      );
    }
    
    // Check if transaction is complete
    const isComplete = await checkTransactionComplete(groupInfo.job_id, groupInfo.job_type);
    
    if (isComplete) {
      await completeTransaction(bot, groupInfo);
    } else {
      await ctx.reply('Delivery confirmed! Waiting for payment confirmation from the rider/errander.');
      
      // Notify provider
      await bot.telegram.sendMessage(
        groupInfo.provider_id,
        `The customer has confirmed successful delivery. Please confirm payment receipt with /payment_received when you're satisfied.`
      );
    }
  } catch (error) {
    console.error('Delivery successful error:', error);
    await ctx.reply('Sorry, there was an error processing your command. Please try again later.');
  }
});

// Rating command
bot.command('rate', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    
    if (args.length < 3) {
      await ctx.reply('Incorrect format. Use: /rate [provider_id] [1-5] [review text]');
      return;
    }
    
    const providerId = args[1];
    const rating = parseInt(args[2]);
    const reviewText = args.slice(3).join(' ');
    
    if (isNaN(rating) || rating < 1 || rating > 5) {
      await ctx.reply('Please provide a valid rating between 1 and 5.');
      return;
    }
    
    // Check if the provider exists (either as rider or errander)
    const riderCheck = await pool.query(
      'SELECT * FROM riders WHERE telegram_id = $1',
      [providerId]
    );
    
    const erranderCheck = await pool.query(
      'SELECT * FROM erranders WHERE telegram_id = $1',
      [providerId]
    );
    
    let providerType, providerExists = false;
    
    if (riderCheck.rows.length > 0) {
      providerType = 'rider';
      providerExists = true;
    } else if (erranderCheck.rows.length > 0) {
      providerType = 'errander';
      providerExists = true;
    }
    
    if (!providerExists) {
      await ctx.reply('Provider not found. Please check the ID and try again.');
      return;
    }
    
    // Check if the user has completed a transaction with this provider
    const completedJobs = await pool.query(
      `SELECT j.* FROM chat_groups cg
      JOIN (
        SELECT id, 'order' as type FROM orders WHERE customer_id = $1 AND assigned_rider_id = $2 AND payment_received = TRUE AND delivery_successful = TRUE
        UNION
        SELECT id, 'errand' as type FROM errands WHERE customer_id = $1 AND assigned_errander_id = $2 AND payment_received = TRUE AND delivery_successful = TRUE
      ) j ON cg.job_id = j.id AND cg.job_type = j.type
      WHERE cg.customer_id = $1 AND cg.provider_id = $2`,
      [userId, providerId]
    );
    
    if (completedJobs.rows.length === 0) {
      await ctx.reply('You can only rate providers after completing a transaction with them.');
      return;
    }
    
    // Check if already rated
    const ratingCheck = await pool.query(
      'SELECT * FROM ratings WHERE customer_id = $1 AND provider_id = $2 AND job_id = $3 AND job_type = $4',
      [userId, providerId, completedJobs.rows[0].id, completedJobs.rows[0].type]
    );
    
    if (ratingCheck.rows.length > 0) {
      await ctx.reply('You have already rated this provider for this job.');
      return;
    }
    
    // Add the rating
    await pool.query(
      'INSERT INTO ratings (customer_id, provider_id, job_id, job_type, rating, review, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [userId, providerId, completedJobs.rows[0].id, completedJobs.rows[0].type, rating, reviewText]
    );
    
    // Update provider's average rating
    if (providerType === 'rider') {
      const ratingAvg = await pool.query(
        'SELECT AVG(rating) as avg_rating FROM ratings WHERE provider_id = $1',
        [providerId]
      );
      
      await pool.query(
        'UPDATE riders SET rating = $1 WHERE telegram_id = $2',
        [ratingAvg.rows[0].avg_rating, providerId]
      );
    } else {
      const ratingAvg = await pool.query(
        'SELECT AVG(rating) as avg_rating FROM ratings WHERE provider_id = $1',
        [providerId]
      );
      
      await pool.query(
        'UPDATE erranders SET rating = $1 WHERE telegram_id = $2',
        [ratingAvg.rows[0].avg_rating, providerId]
      );
    }
    
    await ctx.reply('Thank you for your rating!');
    
    // Notify the provider about the new rating
    await bot.telegram.sendMessage(
      providerId,
      `You've received a new ${rating}/5 rating!\n\n` +
      `Review: "${reviewText}"\n\n` +
      `Thank you for your service!`
    );
  } catch (error) {
    console.error('Rating error:', error);
    await ctx.reply('Sorry, there was an error processing your rating. Please try again later.');
  }
});

// Helper functions
async function checkTransactionComplete(jobId, jobType) {
  try {
    if (jobType === 'order') {
      const orderCheck = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND payment_received = TRUE AND delivery_successful = TRUE',
        [jobId]
      );
      return orderCheck.rows.length > 0;
    } else {
      const errandCheck = await pool.query(
        'SELECT * FROM errands WHERE id = $1 AND payment_received = TRUE AND delivery_successful = TRUE',
        [jobId]
      );
      return errandCheck.rows.length > 0;
    }
  } catch (error) {
    console.error('Check transaction complete error:', error);
    return false;
  }
}

async function completeTransaction(bot, groupInfo) {
  try {
    // Update job status to COMPLETED
    if (groupInfo.job_type === 'order') {
      await pool.query(
        'UPDATE orders SET status = $1, completed_at = NOW() WHERE id = $2',
        ['COMPLETED', groupInfo.job_id]
      );
    } else {
      await pool.query(
        'UPDATE errands SET status = $1, completed_at = NOW() WHERE id = $2',
        ['COMPLETED', groupInfo.job_id]
      );
    }
    
    // Get provider details for rating prompt
    let providerName = '';
    if (groupInfo.job_type === 'order') {
      const riderResult = await pool.query(
        'SELECT full_name FROM riders WHERE telegram_id = $1',
        [groupInfo.provider_id]
      );
      providerName = riderResult.rows[0].full_name;
    } else {
      const erranderResult = await pool.query('SELECT full_name FROM erranders WHERE telegram_id = $1',
        [groupInfo.provider_id]
      );
      providerName = erranderResult.rows[0].full_name;
    }
    
    // Notify both users
    await bot.telegram.sendMessage(
      groupInfo.group_id,
      `🎉 Transaction complete! Thank you for using our service.\n\nThis group will be deleted in 10 seconds.`
    );
    
    // Prompt customer to rate the provider
    await bot.telegram.sendMessage(
      groupInfo.customer_id,
      `Your ${groupInfo.job_type} has been completed successfully!\n\n` +
      `Please rate ${providerName} using the command:\n` +
      `/rate ${groupInfo.provider_id} [1-5] [review text]`
    );
    
    // Wait 10 seconds before deleting the group
    setTimeout(async () => {
      try {
        // Attempt to delete the group
        await bot.telegram.leaveChat(groupInfo.group_id);
        await bot.telegram.deleteChat(groupInfo.group_id);
        
        // Mark the group as deleted in the database
        await pool.query(
          'UPDATE chat_groups SET is_deleted = TRUE, deleted_at = NOW() WHERE group_id = $1',
          [groupInfo.group_id]
        );
      } catch (error) {
        console.error('Error deleting group:', error);
        // Even if we can't delete the group, mark it as completed in our database
        await pool.query(
          'UPDATE chat_groups SET is_completed = TRUE, completed_at = NOW() WHERE group_id = $1',
          [groupInfo.group_id]
        );
      }
    }, 10000);
  } catch (error) {
    console.error('Complete transaction error:', error);
    await bot.telegram.sendMessage(
      groupInfo.group_id,
      'Sorry, there was an error completing the transaction. Please contact support.'
    );
  }
}

// Error handling middleware
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('Sorry, something went wrong. Please try again or contact support.').catch(e => {
    console.error('Error sending error message:', e);
  });
});

// Add webhook security middleware
const webhookSecurityMiddleware = (req, res, next) => {
  try {
    // In a production environment, you would validate the request
    // For example, checking Telegram's X-Telegram-Bot-Api-Secret-Token header
    if (process.env.NODE_ENV === 'production') {
      const telegramToken = req.headers['x-telegram-bot-api-secret-token'];
      
      if (!telegramToken || telegramToken !== process.env.TELEGRAM_SECRET_TOKEN) {
        logger.warn('Unauthorized webhook request');
        return res.status(403).send('Unauthorized');
      }
    }
    
    next();
  } catch (error) {
    logger.error('Webhook security middleware error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Set up webhook
const secretPath = `/telegraf/${bot.secretPathComponent()}`;

app.post(secretPath, webhookSecurityMiddleware, (req, res) => {
  try {
    bot.handleUpdate(req.body, res);
  } catch (error) {
    logger.error('Error handling webhook update:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Webhook path: ${secretPath}`);
});

// Configure webhook or polling based on environment
if (process.env.NODE_ENV !== 'production') {
  // Start polling in development
  bot.launch()
    .then(() => logger.info('Bot started in polling mode'))
    .catch(err => logger.error('Error starting bot in polling mode:', err));
} else {
  // Set webhook in production
  const webhookUrl = process.env.WEBHOOK_URL || `${process.env.WEBHOOK_DOMAIN}${secretPath}`;
  
  bot.telegram.setWebhook(webhookUrl)
    .then(() => {
      logger.info(`Webhook set to: ${webhookUrl}`);
      
      // Get webhook info for verification
      return bot.telegram.getWebhookInfo();
    })
    .then(info => {
      logger.info('Webhook info:', info);
    })
    .catch(err => {
      logger.error('Webhook setting error:', err);
    });
}

// Enhanced error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// Enable graceful stop
process.once('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  bot.stop('SIGTERM');
  process.exit(0);
});
