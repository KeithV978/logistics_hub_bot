/**
 * Customer controller for customer-specific commands and actions
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const db = require('../config/database');
const sessionManager = require('../utils/sessionManager');

/**
 * Process a customer rating for a rider or errander
 * @param {Object} ctx - Telegram context object
 * @param {string} targetUserId - Telegram ID of rider/errander to rate
 * @param {string} serviceType - 'order' or 'errand'
 * @param {string} serviceId - ID of the order/errand
 * @param {number} rating - Rating value (1-5)
 * @param {string} comment - Optional review comment
 */
const handleRating = async (ctx, targetUserId, serviceType, serviceId, rating, comment = '') => {
  try {
    const customerTelegramId = ctx.from.id;
    logger.info(`Customer ${customerTelegramId} rating ${targetUserId} with ${rating} stars for ${serviceType} ${serviceId}`);

    // Validate rating
    const ratingNumber = parseInt(rating, 10);
    if (isNaN(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      return await ctx.reply('Please provide a valid rating between 1 and 5 stars.');
    }

    // Add review to user's reviews array
    await db.query(
      `UPDATE users 
       SET reviews = reviews || $1::jsonb, 
           rating = (SELECT AVG(r.rating) FROM jsonb_array_elements(reviews || $1::jsonb) AS r(rating))
       WHERE "telegramId" = $2`,
      [
        JSON.stringify([{ customerId: customerTelegramId, comment, rating: ratingNumber }]), 
        targetUserId
      ]
    );

    await ctx.reply('Thank you for your rating! Your feedback helps improve our community.');
    
  } catch (error) {
    logger.error(`Error in handleRating: ${error.message}`, { 
      telegramId: ctx.from.id, 
      targetUserId, 
      serviceType, 
      serviceId, 
      error 
    });
    await ctx.reply('Sorry, there was an error processing your rating. Please try again later.');
  }
};

/**
 * Handle the command to accept an offer
 * @param {Object} ctx - Telegram context object
 * @param {string} offerId - ID of the offer to accept
 */
const acceptOffer = async (ctx, offerId) => {
  try {
    if (!offerId) {
      return await ctx.reply('Please provide an offer ID: /accept_offer <offerId>');
    }
    
    const customerTelegramId = ctx.from.id;
    logger.info(`Customer ${customerTelegramId} accepting offer ${offerId}`);

    // Begin transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get offer details
      const offerResult = await client.query(
        `SELECT * FROM offers WHERE "offerId" = $1`, 
        [offerId]
      );
      
      if (offerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return await ctx.reply('Offer not found. Please check the offer ID and try again.');
      }
      
      const offer = offerResult.rows[0];
      
      // Determine if this is for an order or errand
      let serviceType, serviceId, servicerId;
      
      if (offer.orderId) {
        serviceType = 'order';
        serviceId = offer.orderId;
        servicerId = offer.riderId;
        
        // Verify customer owns this order
        const orderResult = await client.query(
          `SELECT * FROM orders WHERE "orderId" = $1 AND "customerTelegramId" = $2`,
          [serviceId, customerTelegramId]
        );
        
        if (orderResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return await ctx.reply('You are not authorized to accept offers for this order.');
        }
        
        // Update order status
        await client.query(
          `UPDATE orders 
           SET status = 'accepted', "riderId" = $1, "updatedAt" = NOW() 
           WHERE "orderId" = $2`,
          [servicerId, serviceId]
        );
      } else if (offer.errandId) {
        serviceType = 'errand';
        serviceId = offer.errandId;
        servicerId = offer.erranderId;
        
        // Verify customer owns this errand
        const errandResult = await client.query(
          `SELECT * FROM errands WHERE "errandId" = $1 AND "customerTelegramId" = $2`,
          [serviceId, customerTelegramId]
        );
        
        if (errandResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return await ctx.reply('You are not authorized to accept offers for this errand.');
        }
        
        // Update errand status
        await client.query(
          `UPDATE errands 
           SET status = 'accepted', "erranderId" = $1, "updatedAt" = NOW() 
           WHERE "errandId" = $2`,
          [servicerId, serviceId]
        );
      } else {
        await client.query('ROLLBACK');
        return await ctx.reply('Invalid offer type. Please contact support.');
      }
      
      // Update the accepted offer
      await client.query(
        `UPDATE offers SET status = 'accepted' WHERE "offerId" = $1`,
        [offerId]
      );
      
      // Reject all other offers for this order/errand
      await client.query(
        `UPDATE offers 
         SET status = 'rejected' 
         WHERE "offerId" != $1 AND (${serviceType === 'order' ? '"orderId"' : '"errandId"'} = $2)`,
        [offerId, serviceId]
      );
      
      await client.query('COMMIT');
      
      await ctx.reply(`Offer accepted! A private group will be created for you and the ${serviceType === 'order' ? 'rider' : 'errander'}.`);
      
      // Return data for creating the group
      return {
        serviceType,
        serviceId,
        servicerId,
        customerTelegramId
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error(`Error in acceptOffer: ${error.message}`, { telegramId: ctx.from.id, offerId, error });
    await ctx.reply('Sorry, there was an error accepting the offer. Please try again later.');
    return null;
  }
};

/**
 * Mark a delivery as successful (for customer)
 * @param {Object} ctx - Telegram context object
 */
const markDeliverySuccessful = async (ctx) => {
  try {
    const customerTelegramId = ctx.from.id;
    const groupId = ctx.chat.id;
    
    logger.info(`Customer ${customerTelegramId} marking delivery as successful in group ${groupId}`);
    
    // Get group information
    const groupResult = await db.query(
      `SELECT * FROM groups WHERE "groupId" = $1 AND "customerTelegramId" = $2`,
      [groupId.toString(), customerTelegramId]
    );
    
    if (groupResult.rows.length === 0) {
      return await ctx.reply('This command can only be used in an active delivery group by the customer.');
    }
    
    const group = groupResult.rows[0];
    
    // Check if the rider/errander has already confirmed payment received
    const serviceType = group.orderId ? 'order' : 'errand';
    const serviceId = group.orderId || group.errandId;
    const servicerId = group.riderId || group.erranderId;
    
    let statusResult;
    if (serviceType === 'order') {
      statusResult = await db.query(
        `SELECT status FROM orders WHERE "orderId" = $1`,
        [serviceId]
      );
    } else {
      statusResult = await db.query(
        `SELECT status FROM errands WHERE "errandId" = $1`,
        [serviceId]
      );
    }
    
    if (statusResult.rows[0].status === 'completed') {
      return await ctx.reply('This delivery is already marked as completed.');
    }
    
    if (statusResult.rows[0].status !== 'in_progress') {
      return await ctx.reply(`The ${serviceType} must be in progress before it can be marked as successful.`);
    }
    
    // Update status to completed
    if (serviceType === 'order') {
      await db.query(
        `UPDATE orders SET status = 'completed', "updatedAt" = NOW() WHERE "orderId" = $1`,
        [serviceId]
      );
    } else {
      await db.query(
        `UPDATE errands SET status = 'completed', "updatedAt" = NOW() WHERE "errandId" = $1`,
        [serviceId]
      );
    }
    
    await ctx.reply(`Thank you! The ${serviceType} has been marked as completed.`);
    
    // Prompt for rating
    await ctx.reply(
      `Please rate your ${serviceType === 'order' ? 'rider' : 'errander'} from 1-5 stars:\n` +
      `Type: /rate 5 Great service!\n` +
      `Or just: /rate 4\n\n` +
      `This group will be closed soon.`
    );
    
    // Set session to capture rating
    sessionManager.createSession(customerTelegramId, {
      action: 'rating',
      targetUserId: servicerId,
      serviceType,
      serviceId,
      inGroup: true
    });
    
    return { 
      completed: true, 
      groupId,
      serviceType,
      serviceId,
      servicerId,
      customerTelegramId 
    };
    
  } catch (error) {
    logger.error(`Error in markDeliverySuccessful: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
    return { completed: false };
  }
};

/**
 * Handle the /rate command
 * @param {Object} ctx - Telegram context object
 * @param {Array} args - Command arguments [rating, ...commentWords]
 */
const handleRateCommand = async (ctx, args) => {
  try {
    const customerTelegramId = ctx.from.id;
    
    if (!args || args.length === 0) {
      return await ctx.reply('Please provide a rating: /rate <1-5> [comment]');
    }
    
    // Get active rating session
    const session = sessionManager.getSession(customerTelegramId);
    if (!session || session.action !== 'rating') {
      return await ctx.reply('No active rating session. Use this command after completing a delivery.');
    }
    
    // Parse rating and comment
    const rating = parseInt(args[0], 10);
    const comment = args.slice(1).join(' ');
    
    // Process rating
    await handleRating(
      ctx,
      session.targetUserId,
      session.serviceType,
      session.serviceId,
      rating,
      comment
    );
    
    // Clear session
    sessionManager.clearSession(customerTelegramId);
    
    // If rating was in a group, return group info for cleanup
    if (session.inGroup) {
      return {
        groupId: ctx.chat.id,
        rated: true
      };
    }
    
    return { rated: true };
    
  } catch (error) {
    logger.error(`Error in handleRateCommand: ${error.message}`, { telegramId: ctx.from.id, error });
    await ctx.reply('Sorry, there was an error processing your rating. Please try again later.');
    return { rated: false };
  }
};

/**
 * Cancel an order or errand (for customer)
 * @param {Object} ctx - Telegram context object
 * @param {string} type - 'order' or 'errand'
 * @param {string} id - ID of order or errand
 */
const cancelService = async (ctx, type, id) => {
  try {
    const customerTelegramId = ctx.from.id;
    logger.info(`Customer ${customerTelegramId} canceling ${type} ${id}`);
    
    if (!id) {
      return await ctx.reply(`Please provide an ID: /cancel_${type} <${type}Id>`);
    }
    
    // Verify ownership and status
    let result;
    if (type === 'order') {
      result = await db.query(
        `SELECT status FROM orders WHERE "orderId" = $1 AND "customerTelegramId" = $2`,
        [id, customerTelegramId]
      );
    } else {
      result = await db.query(
        `SELECT status FROM errands WHERE "errandId" = $1 AND "customerTelegramId" = $2`,
        [id, customerTelegramId]
      );
    }
    
    if (result.rows.length === 0) {
      return await ctx.reply(`${type.charAt(0).toUpperCase() + type.slice(1)} not found or not owned by you.`);
    }
    
    const status = result.rows[0].status;
    if (status === 'completed' || status === 'canceled') {
      return await ctx.reply(`This ${type} is already ${status} and cannot be canceled.`);
    }
    
    if (status === 'accepted' || status === 'in_progress') {
      return await ctx.reply(`This ${type} is already ${status}. Please contact the ${type === 'order' ? 'rider' : 'errander'} in your group chat.`);
    }
    
    // Update status to canceled
    if (type === 'order') {
      await db.query(
        `UPDATE orders SET status = 'canceled', "updatedAt" = NOW() WHERE "orderId" = $1`,
        [id]
      );
    } else {
      await db.query(
        `UPDATE errands SET status = 'canceled', "updatedAt" = NOW() WHERE "errandId" = $1`,
        [id]
      );
    }
    
    // Cancel any pending offers
    await db.query(
      `UPDATE offers SET status = 'rejected' WHERE ${type === 'order' ? '"orderId"' : '"errandId"'} = $1 AND status = 'pending'`,
      [id]
    );
    
    await ctx.reply(`Your ${type} has been canceled.`);
    return { canceled: true, type, id };
    
  } catch (error) {
    logger.error(`Error in cancelService: ${error.message}`, { telegramId: ctx.from.id, type, id, error });
    await ctx.reply('Sorry, there was an error canceling your request. Please try again later.');
    return { canceled: false };
  }
};

module.exports = {
  handleRating,
  acceptOffer,
  markDeliverySuccessful,
  handleRateCommand,
  cancelService
};