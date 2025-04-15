const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const { validateLocation, findNearbyErranders } = require('../utils/helpers');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a new scene for customer errand creation
const customerErrandScene = new Scenes.WizardScene(
  'customerErrandScene',
  
  // Step 1: Welcome message and ask for errand location
  async (ctx) => {
    ctx.wizard.state.errandData = {};
    await ctx.reply(
      'Welcome to errand creation!\n\n' +
      'Please share the location where the errand needs to be performed by:\n' +
      '1. Tap the attachment button (📎)\n' +
      '2. Select "Location"\n' +
      '3. Share a location on the map\n\n' +
      'Or type the errand location as text (e.g., "Shoprite Mall, Lekki").'
    );
    return ctx.wizard.next();
  },
  
  // Step 2: Process errand location and ask for errand details
  async (ctx) => {
    try {
      if (ctx.message.location) {
        // User shared location via Telegram's location feature
        const { latitude, longitude } = ctx.message.location;
        
        // Validate location
        const isValid = await validateLocation(latitude, longitude);
        if (!isValid) {
          await ctx.reply('Sorry, this location is outside our service area. Please try a different location.');
          return;
        }
        
        ctx.wizard.state.errandData.errandLatitude = latitude;
        ctx.wizard.state.errandData.errandLongitude = longitude;
        ctx.wizard.state.errandData.errandLocationText = 'Location shared via map';
      } else if (ctx.message.text) {
        // User entered location as text
        const locationText = ctx.message.text;
        
        // Store text location for now - in a real app, you might want to geocode this
        ctx.wizard.state.errandData.errandLocationText = locationText;
        
        // For this demo, we'll assign default coordinates
        // In a real app, you would use a geocoding service
        ctx.wizard.state.errandData.errandLatitude = 51.5074;
        ctx.wizard.state.errandData.errandLongitude = -0.1278;
      } else {
        await ctx.reply('Please share a location or enter an address as text.');
        return;
      }
      
      await ctx.reply(
        'Great! Now please describe the errand in detail. Be specific about what needs to be done.\n\n' +
        'For example: "Buy 2 loaves of bread and 1 liter of milk from the grocery store" or "Pick up my package from the post office, reference #12345".'
      );
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing errand location:', error);
      await ctx.reply('Sorry, there was an error processing your location. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Process errand details and confirm
  async (ctx) => {
    try {
      const errandDetails = ctx.message.text;
      
      if (!errandDetails || errandDetails.length < 10) {
        await ctx.reply('Please provide more detailed information about the errand (at least 10 characters).');
        return;
      }
      
      ctx.wizard.state.errandData.errandDetails = errandDetails;
      
      // Confirm the errand details
      await ctx.reply(
        '📋 Errand Details:\n\n' +
        `Location: ${ctx.wizard.state.errandData.errandLocationText}\n` +
        `Task: ${ctx.wizard.state.errandData.errandDetails}\n\n` +
        'Is this correct?',
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Confirm Errand', 'confirm_errand'),
          Markup.button.callback('❌ Cancel', 'cancel_errand')
        ])
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing errand details:', error);
      await ctx.reply('Sorry, there was an error processing your errand details. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 4: Handle confirmation or cancellation
  async (ctx) => {
    // This step is handled by action handlers below
    return;
  }
);

// Handle errand confirmation
customerErrandScene.action('confirm_errand', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const errandData = ctx.wizard.state.errandData;
    const customerId = ctx.from.id;
    
    // Insert the errand into the database
    const errandResult = await pool.query(
      `INSERT INTO errands (
        customer_id, errand_location_text, errand_latitude, errand_longitude,
        errand_details, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id`,
      [
        customerId,
        errandData.errandLocationText,
        errandData.errandLatitude,
        errandData.errandLongitude,
        errandData.errandDetails,
        'PENDING'
      ]
    );
    
    const errandId = errandResult.rows[0].id;
    
    await ctx.editMessageText(
      `Your errand #${errandId} has been created! Looking for nearby erranders...`
    );
    
    // Find nearby erranders
    const { erranders, radius } = await findNearbyErranders(
      errandData.errandLatitude,
      errandData.errandLongitude
    );
    
    if (erranders.length > 0) {
      await ctx.reply(
        `🏃 We found ${erranders.length} erranders within ${radius}km of your location!\n` +
        `You will receive notifications as erranders submit their offers.`
      );
      
      // Notify erranders about the new errand
      for (const errander of erranders) {
        try {
          await ctx.telegram.sendMessage(
            errander.telegram_id,
            `🔔 New errand request #${errandId}:\n\n` +
            `Location: ${errandData.errandLocationText}\n` +
            `Task: ${errandData.errandDetails}\n\n` +
            `Distance: ${errander.distance.toFixed(2)}km from your location\n\n` +
            `To make an offer, use:\n/make_offer ${errandId} [your_price]`
          );
        } catch (error) {
          console.error(`Error notifying errander ${errander.telegram_id}:`, error);
        }
      }
    } else {
      await ctx.reply(
        `We couldn't find any erranders within ${radius}km of your location.\n` +
        `Your errand #${errandId} has been created and erranders will be notified when they become available.`
      );
    }
    
    return ctx.scene.leave();
  } catch (error) {
    console.error('Error confirming errand:', error);
    await ctx.reply('Sorry, there was an error creating your errand. Please try again later.');
    return ctx.scene.leave();
  }
});

// Handle errand cancellation
customerErrandScene.action('cancel_errand', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Errand creation cancelled. You can start again with /create_errand.');
  return ctx.scene.leave();
});

// Handle cancellation during any step
customerErrandScene.command('cancel', async (ctx) => {
  await ctx.reply('Errand creation cancelled. You can start again with /create_errand.');
  return ctx.scene.leave();
});

module.exports = { customerErrandScene };
