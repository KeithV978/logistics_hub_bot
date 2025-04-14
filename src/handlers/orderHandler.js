const { Composer } = require('telegraf');
const { ValidationError } = require('../middlewares/errorHandler');
const { query } = require('../database/connection');
const { orderSchema, offerSchema, validate } = require('../utils/validators');
const { Markup } = require('telegraf');

const orders = new Composer();

// Order creation flow
orders.command('order', async (ctx) => {
    try {
        // Check if user exists and is verified
        const user = await query(
            'SELECT * FROM users WHERE telegram_id = $1 AND verification_status = $2',
            [ctx.from.id, 'active']
        );

        if (user.rows.length === 0) {
            throw new ValidationError('Please register and verify your account first using /register');
        }

        // Initialize order creation session
        ctx.session.orderCreation = {
            step: 'pickup_location',
            data: {}
        };

        await ctx.reply(
            'Please share the pickup location.',
            Markup.keyboard([
                [Markup.button.locationRequest('Share Pickup Location 📍')]
            ]).resize()
        );
    } catch (error) {
        throw error;
    }
});

// Handle location sharing for both pickup and dropoff
orders.on('location', async (ctx) => {
    try {
        if (!ctx.session.orderCreation?.step) return;

        const { latitude, longitude } = ctx.message.location;
        
        if (ctx.session.orderCreation.step === 'pickup_location') {
            ctx.session.orderCreation.data.pickup = { latitude, longitude };
            ctx.session.orderCreation.step = 'dropoff_location';
            
            await ctx.reply(
                'Great! Now share the dropoff location.',
                Markup.keyboard([
                    [Markup.button.locationRequest('Share Dropoff Location 📍')]
                ]).resize()
            );
        } else if (ctx.session.orderCreation.step === 'dropoff_location') {
            ctx.session.orderCreation.data.dropoff = { latitude, longitude };
            ctx.session.orderCreation.step = 'item_description';
            
            await ctx.reply(
                'Please describe the item to be delivered:',
                Markup.removeKeyboard()
            );
        }
    } catch (error) {
        throw error;
    }
});

// Handle text input for item description and instructions
orders.on('text', async (ctx) => {
    try {
        if (!ctx.session.orderCreation?.step) return;

        switch (ctx.session.orderCreation.step) {
            case 'item_description':
                ctx.session.orderCreation.data.itemDescription = ctx.message.text;
                ctx.session.orderCreation.step = 'delivery_instructions';
                await ctx.reply('Add any delivery instructions (optional):');
                break;

            case 'delivery_instructions':
                // Validate and create the order
                const orderData = {
                    ...ctx.session.orderCreation.data,
                    deliveryInstructions: ctx.message.text
                };

                await validate(orderSchema, orderData);

                // Insert order into database
                const result = await query(
                    `INSERT INTO orders (
                        customer_telegram_id,
                        pickup_latitude,
                        pickup_longitude,
                        dropoff_latitude,
                        dropoff_longitude,
                        item_description,
                        delivery_instructions
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [
                        ctx.from.id,
                        orderData.pickup.latitude,
                        orderData.pickup.longitude,
                        orderData.dropoff.latitude,
                        orderData.dropoff.longitude,
                        orderData.itemDescription,
                        orderData.deliveryInstructions
                    ]
                );

                const orderId = result.rows[0].id;

                // Clear order creation session
                ctx.session.orderCreation = {};

                await ctx.reply(
                    `✅ Order created successfully!\nOrder ID: ${orderId}\n\nRiders will be notified and can make offers. You'll be notified when offers are received.`
                );

                // Notify available riders
                const riders = await query(
                    'SELECT telegram_id FROM users WHERE user_type = $1 AND verification_status = $2',
                    ['rider', 'active']
                );

                const notificationMessage = 
                    `🆕 New delivery order!\n\n` +
                    `Item: ${orderData.itemDescription}\n` +
                    `Use /offer ${orderId} to make an offer`;

                for (const rider of riders.rows) {
                    try {
                        await ctx.telegram.sendMessage(rider.telegram_id, notificationMessage);
                    } catch (error) {
                        console.error(`Failed to notify rider ${rider.telegram_id}:`, error);
                    }
                }
                break;
        }
    } catch (error) {
        throw error;
    }
});

// Handle offers from riders
orders.command('offer', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 3) {
            throw new ValidationError('Usage: /offer <order_id> <price>');
        }

        const [_, orderId, price] = args;
        
        // Verify rider status
        const rider = await query(
            'SELECT * FROM users WHERE telegram_id = $1 AND user_type = $2 AND verification_status = $3',
            [ctx.from.id, 'rider', 'active']
        );

        if (rider.rows.length === 0) {
            throw new ValidationError('Only verified riders can make offers');
        }

        // Verify order exists and is pending
        const order = await query(
            'SELECT * FROM orders WHERE id = $1 AND status = $2',
            [orderId, 'pending']
        );

        if (order.rows.length === 0) {
            throw new ValidationError('Order not found or not available');
        }

        // Create offer
        await query(
            `INSERT INTO offers (user_id, order_id, price)
             VALUES ($1, $2, $3)`,
            [rider.rows[0].id, orderId, parseFloat(price)]
        );

        await ctx.reply('Offer submitted successfully! You will be notified if accepted.');

        // Notify customer
        const notificationMessage = 
            `🎉 New offer received!\n\n` +
            `Order ID: ${orderId}\n` +
            `Price: $${price}\n\n` +
            `Use /accept_offer ${orderId} ${rider.rows[0].id} to accept`;

        await ctx.telegram.sendMessage(
            order.rows[0].customer_telegram_id,
            notificationMessage
        );
    } catch (error) {
        throw error;
    }
});

// Handle offer acceptance
orders.command('accept_offer', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 3) {
            throw new ValidationError('Usage: /accept_offer <order_id> <rider_id>');
        }

        const [_, orderId, riderId] = args;

        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Update order status and assign rider
            const result = await client.query(
                `UPDATE orders 
                 SET status = $1, rider_id = $2
                 WHERE id = $3 AND customer_telegram_id = $4 AND status = $5
                 RETURNING *`,
                ['in_progress', riderId, orderId, ctx.from.id, 'pending']
            );

            if (result.rows.length === 0) {
                throw new ValidationError('Order not found or not available');
            }

            // Update other offers as rejected
            await client.query(
                `UPDATE offers 
                 SET status = $1
                 WHERE order_id = $2 AND user_id != $3`,
                ['rejected', orderId, riderId]
            );

            await client.query('COMMIT');

            await ctx.reply('Offer accepted! The rider will be notified.');

            // Get rider's telegram ID
            const rider = await query(
                'SELECT telegram_id FROM users WHERE id = $1',
                [riderId]
            );

            // Notify rider
            await ctx.telegram.sendMessage(
                rider.rows[0].telegram_id,
                `🎉 Your offer for order ${orderId} has been accepted! You can start the delivery.`
            );
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        throw error;
    }
});

// Handle order completion
orders.command('complete_order', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 2) {
            throw new ValidationError('Usage: /complete_order <order_id>');
        }

        const [_, orderId] = args;
        
        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify order exists and is in progress
            const order = await client.query(
                `SELECT * FROM orders 
                WHERE id = $1 
                AND (customer_telegram_id = $2 OR rider_id IN (
                    SELECT id FROM users WHERE telegram_id = $2
                ))
                AND status = $3`,
                [orderId, ctx.from.id, 'in_progress']
            );

            if (order.rows.length === 0) {
                throw new ValidationError('Order not found or cannot be completed');
            }

            // Update order status
            await client.query(
                'UPDATE orders SET status = $1 WHERE id = $2',
                ['completed', orderId]
            );

            await client.query('COMMIT');

            // Get the other party's telegram ID
            let otherPartyId;
            if (order.rows[0].customer_telegram_id === ctx.from.id) {
                const rider = await query(
                    'SELECT telegram_id FROM users WHERE id = $1',
                    [order.rows[0].rider_id]
                );
                otherPartyId = rider.rows[0].telegram_id;
            } else {
                otherPartyId = order.rows[0].customer_telegram_id;
            }

            // Notify both parties
            await ctx.reply(
                '✅ Order marked as completed! Please rate your experience using:\n' +
                `/rate_order ${orderId} <1-5> [review text]`
            );

            await ctx.telegram.sendMessage(
                otherPartyId,
                `Order ${orderId} has been marked as completed!\n` +
                `Please rate your experience using:\n` +
                `/rate_order ${orderId} <1-5> [review text]`
            );

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        throw error;
    }
});

// Handle rating submission
orders.command('rate_order', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            throw new ValidationError('Usage: /rate_order <order_id> <rating 1-5> [review text]');
        }

        const [_, orderId, ratingStr, ...reviewParts] = args;
        const rating = parseInt(ratingStr);
        const review = reviewParts.join(' ');

        if (isNaN(rating) || rating < 1 || rating > 5) {
            throw new ValidationError('Rating must be a number between 1 and 5');
        }

        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify order exists and is completed
            const order = await client.query(
                `SELECT * FROM orders 
                WHERE id = $1 
                AND (customer_telegram_id = $2 OR rider_id IN (
                    SELECT id FROM users WHERE telegram_id = $2
                ))
                AND status = $3`,
                [orderId, ctx.from.id, 'completed']
            );

            if (order.rows.length === 0) {
                throw new ValidationError('Order not found or cannot be rated');
            }

            // Get user ID of the person being rated
            let ratedUserId;
            if (order.rows[0].customer_telegram_id === ctx.from.id) {
                ratedUserId = order.rows[0].rider_id;
            } else {
                const customer = await client.query(
                    'SELECT id FROM users WHERE telegram_id = $1',
                    [order.rows[0].customer_telegram_id]
                );
                ratedUserId = customer.rows[0].id;
            }

            // Check if already rated
            const existingRating = await client.query(
                'SELECT * FROM ratings WHERE order_id = $1 AND user_id = $2',
                [orderId, ratedUserId]
            );

            if (existingRating.rows.length > 0) {
                throw new ValidationError('You have already rated this order');
            }

            // Insert rating
            await client.query(
                `INSERT INTO ratings (user_id, order_id, rating, review)
                VALUES ($1, $2, $3, $4)`,
                [ratedUserId, orderId, rating, review]
            );

            await client.query('COMMIT');

            await ctx.reply('Thank you for your rating!');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        throw error;
    }
});

// Handle dispute creation
orders.command('dispute_order', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            throw new ValidationError('Usage: /dispute_order <order_id> <description>');
        }

        const [_, orderId, ...descriptionParts] = args;
        const description = descriptionParts.join(' ');

        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify order exists and user is involved
            const order = await client.query(
                `SELECT * FROM orders 
                WHERE id = $1 
                AND (customer_telegram_id = $2 OR rider_id IN (
                    SELECT id FROM users WHERE telegram_id = $2
                ))`,
                [orderId, ctx.from.id]
            );

            if (order.rows.length === 0) {
                throw new ValidationError('Order not found or you are not involved in it');
            }

            // Create dispute
            await client.query(
                `INSERT INTO disputes (
                    order_id, 
                    created_by_telegram_id,
                    description
                ) VALUES ($1, $2, $3)`,
                [orderId, ctx.from.id, description]
            );

            // Update order status
            await client.query(
                'UPDATE orders SET status = $1 WHERE id = $2',
                ['disputed', orderId]
            );

            await client.query('COMMIT');

            // Notify both parties and admin
            await ctx.reply('Dispute has been registered. An admin will review the case.');

            // Get the other party's telegram ID
            let otherPartyId;
            if (order.rows[0].customer_telegram_id === ctx.from.id) {
                const rider = await query(
                    'SELECT telegram_id FROM users WHERE id = $1',
                    [order.rows[0].rider_id]
                );
                otherPartyId = rider.rows[0].telegram_id;
            } else {
                otherPartyId = order.rows[0].customer_telegram_id;
            }

            // Notify other party
            await ctx.telegram.sendMessage(
                otherPartyId,
                `A dispute has been opened for order ${orderId}. An admin will review the case.`
            );

            // Notify admin
            if (process.env.ADMIN_CHAT_ID) {
                await ctx.telegram.sendMessage(
                    process.env.ADMIN_CHAT_ID,
                    `🚨 New dispute opened!\n\n` +
                    `Order ID: ${orderId}\n` +
                    `Created by: ${ctx.from.id}\n` +
                    `Description: ${description}`
                );
            }

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        throw error;
    }
});

module.exports = orders;