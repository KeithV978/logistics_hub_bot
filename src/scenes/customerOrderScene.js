const { Scenes, Markup } = require('telegraf');
const { Pool } = require('pg');
const { validateLocation, findNearbyRiders } = require('../utils/helpers');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a new scene for customer order creation
const customerOrderScene = new Scenes.WizardScene(
  'customerOrderScene',
  
  // Step 1: Welcome message and ask for pickup location
  async (ctx) => {
    ctx.wizard.state.orderData = {};
    await ctx.reply(
      'Welcome to order creation!\n\n' +
      'Please share your pickup location by:\n' +
      '1. Tap the attachment button (📎)\n' +
      '2. Select "Location"\n' +
      '3. Share your current location or select a location on the map\n\n' +
      'Or type the pickup address as text.'
    );
    return ctx.wizard.next();
  },
  
  // Step 2: Process pickup location and ask for drop-off location
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
        
        ctx.wizard.state.orderData.pickupLatitude = latitude;
        ctx.wizard.state.orderData.pickupLongitude = longitude;
        ctx.wizard.state.orderData.pickupLocationText = 'Location shared via map';
      } else if (ctx.message.text) {
        // User entered location as text
        const locationText = ctx.message.text;
        
        // Store text location for now - in a real app, you might want to geocode this
        ctx.wizard.state.orderData.pickupLocationText = locationText;
        
        // For this demo, we'll assign default coordinates
        // In a real app, you would use a geocoding service
        ctx.wizard.state.orderData.pickupLatitude = 51.5074;
        ctx.wizard.state.orderData.pickupLongitude = -0.1278;
      } else {
        await ctx.reply('Please share a location or enter an address as text.');
        return;
      }
      
      await ctx.reply(
        'Great! Now please share your drop-off location in the same way (share location or type address).'
      );
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing pickup location:', error);
      await ctx.reply('Sorry, there was an error processing your location. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Process drop-off location and ask for delivery instructions
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
        
        ctx.wizard.state.orderData.dropoffLatitude = latitude;
        ctx.wizard.state.orderData.dropoffLongitude = longitude;
        ctx.wizard.state.orderData.dropoffLocationText = 'Location shared via map';
      } else if (ctx.message.text) {
        // User entered location as text
        const locationText = ctx.message.text;
        
        // Store text location for now - in a real app, you might want to geocode this
        ctx.wizard.state.orderData.dropoffLocationText = locationText;
        
        // For this demo, we'll assign default coordinates
        // In a real app, you would use a geocoding service
        ctx.wizard.state.orderData.dropoffLatitude = 51.5074;
        ctx.wizard.state.orderData.dropoffLongitude = -0.1278;
      } else {
        await ctx.reply('Please share a location or enter an address as text.');
        return;
      }
      
      await ctx.reply(
        'Last step! Please provide any specific delivery instructions (e.g., "Leave at gate", "Call upon arrival").\n\n' +
        'Or type "None" if you don\'t have any special instructions.'
      );
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing drop-off location:', error);
      await ctx.reply('Sorry, there was an error processing your location. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 4: Process delivery instructions and create the order
  async (ctx) => {
    try {
      const instructions = ctx.message.text;
      ctx.wizard.state.orderData.deliveryInstructions = instructions;
      
      // Confirm the order details
      await ctx.reply(
        '📋 Order Details:\n\n' +
        `Pickup: ${ctx.wizard.state.orderData.pickupLocationText}\n` +
        `Drop-off: ${ctx.wizard.state.orderData.dropoffLocationText}\n` +
        `Instructions: ${ctx.wizard.state.orderData.deliveryInstructions}\n\n` +
        'Is this correct?',
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Confirm Order', 'confirm_order'),
          Markup.button.callback('❌ Cancel', 'cancel_order')
        ])
      );
      
      return ctx.wizard.next();
    } catch (error) {
      console.error('Error processing delivery instructions:', error);
      await ctx.reply('Sorry, there was an error processing your instructions. Please try again later.');
      return ctx.scene.leave();
    }
  },
  
  // Step 5: Handle confirmation or cancellation
  async (ctx) => {
    // This step is handled by action handlers below
    return;
  }
);

// Handle order confirmation
customerOrderScene.action('confirm_order', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const orderData = ctx.wizard.state.orderData;
    const customerId = ctx.from.id;
    
    // Insert the order into the database
    const orderResult = await pool.query(
      `INSERT INTO orders (
        customer_id, pickup_location_text, pickup_latitude, pickup_longitude,
        dropoff_location_text, dropoff_latitude, dropoff_longitude,
        delivery_instructions, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id`,
      [
        customerId,
        orderData.pickupLocationText,
        orderData.pickupLatitude,
        orderData.pickupLongitude,
        orderData.dropoffLocationText,
        orderData.dropoffLatitude,
        orderData.dropoffLongitude,
        orderData.deliveryInstructions,
        'PENDING'
      ]
    );
    
    const orderId = orderResult.rows[0].id;
    
    await ctx.editMessageText(
      `Your order #${orderId} has been created! Looking for nearby riders...`
    );
    
    // Find nearby riders
    const { riders, radius } = await findNearbyRiders(
      orderData.pickupLatitude,
      orderData.pickupLongitude
    );
    
    if (riders.length > 0) {
      await ctx.reply(
        `🚚 We found ${riders.length} riders within ${radius}km of your pickup location!\n` +
        `You will receive notifications as riders submit their offers.`
      );
      
      // Notify riders about the new order
      for (const rider of riders) {
        try {
          await ctx.telegram.sendMessage(
            rider.telegram_id,
            `🔔 New delivery request #${orderId}:\n\n` +
            `Pickup: ${orderData.pickupLocationText}\n` +
            `Drop-off: ${orderData.dropoffLocationText}\n` +
            `Instructions: ${orderData.deliveryInstructions}\n\n` +
            `Distance: ${rider.distance.toFixed(2)}km from your location\n\n` +
            `To make an offer, use:\n/make_offer ${orderId} [your_price]`
          );
        } catch (error) {
          console.error(`Error notifying rider ${rider.telegram_id}:`, error);
        }
      }
    } else {
      await ctx.reply(
        `We couldn't find any riders within ${radius}km of your pickup location.\n` +
        `Your order #${orderId} has been created and riders will be notified when they become available.`
      );
    }
    
    return ctx.scene.leave();
  } catch (error) {
    console.error('Error confirming order:', error);
    await ctx.reply('Sorry, there was an error creating your order. Please try again later.');
    return ctx.scene.leave();
  }
});

// Handle order cancellation
customerOrderScene.action('cancel_order', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Order creation cancelled. You can start again with /create_order.');
  return ctx.scene.leave();
});

// Handle cancellation during any step
customerOrderScene.command('cancel', async (ctx) => {
  await ctx.reply('Order creation cancelled. You can start again with /create_order.');
  return ctx.scene.leave();
});

module.exports = { customerOrderScene };