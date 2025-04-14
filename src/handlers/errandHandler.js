const { Composer } = require('telegraf');
const { ValidationError } = require('../middlewares/errorHandler');
const { query } = require('../database/connection');
const { errandSchema, offerSchema, validate } = require('../utils/validators');
const { Markup } = require('telegraf');

const errands = new Composer();

// Errand creation command
errands.command('errand', async (ctx) => {
    try {
        // Check if user exists and is verified
        const user = await query(
            'SELECT * FROM users WHERE telegram_id = $1 AND verification_status = $2',
            [ctx.from.id, 'active']
        );

        if (user.rows.length === 0) {
            throw new ValidationError('Please register and verify your account first using /register');
        }

        // Initialize errand creation session
        ctx.session.errandCreation = {
            step: 'location',
            data: {}
        };

        await ctx.reply(
            'Please share the location where the errand needs to be performed.',
            Markup.keyboard([
                [Markup.button.locationRequest('Share Location 📍')]
            ]).resize()
        );
    } catch (error) {
        throw error;
    }
});

// Handle location for errand
errands.on('location', async (ctx) => {
    try {
        if (!ctx.session.errandCreation?.step === 'location') return;

        const { latitude, longitude } = ctx.message.location;
        ctx.session.errandCreation.data.location = { latitude, longitude };
        ctx.session.errandCreation.step = 'task_description';

        await ctx.reply(
            'Please describe the task that needs to be done:',
            Markup.removeKeyboard()
        );
    } catch (error) {
        throw error;
    }
});

// Handle text inputs for errand creation
errands.on('text', async (ctx) => {
    try {
        if (!ctx.session.errandCreation?.step) return;

        switch (ctx.session.errandCreation.step) {
            case 'task_description':
                ctx.session.errandCreation.data.taskDescription = ctx.message.text;
                ctx.session.errandCreation.step = 'budget';
                await ctx.reply('What is your budget for this errand? (Enter amount in dollars)');
                break;

            case 'budget':
                const budget = parseFloat(ctx.message.text);
                if (isNaN(budget) || budget <= 0) {
                    throw new ValidationError('Please enter a valid budget amount');
                }
                
                ctx.session.errandCreation.data.budget = budget;
                ctx.session.errandCreation.step = 'deadline';
                await ctx.reply('When does this need to be done? (Format: YYYY-MM-DD HH:MM or "flexible")');
                break;

            case 'deadline':
                let deadline = null;
                if (ctx.message.text.toLowerCase() !== 'flexible') {
                    deadline = new Date(ctx.message.text);
                    if (isNaN(deadline.getTime())) {
                        throw new ValidationError('Please enter a valid date/time or "flexible"');
                    }
                }

                ctx.session.errandCreation.data.deadline = deadline;
                ctx.session.errandCreation.step = 'instructions';
                await ctx.reply('Any additional instructions? (or type "none")');
                break;

            case 'instructions':
                const errandData = {
                    ...ctx.session.errandCreation.data,
                    additionalInstructions: ctx.message.text === 'none' ? '' : ctx.message.text
                };

                await validate(errandSchema, errandData);

                // Insert errand into database
                const result = await query(
                    `INSERT INTO errands (
                        customer_telegram_id,
                        location_latitude,
                        location_longitude,
                        task_description,
                        budget,
                        deadline,
                        additional_instructions
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [
                        ctx.from.id,
                        errandData.location.latitude,
                        errandData.location.longitude,
                        errandData.taskDescription,
                        errandData.budget,
                        errandData.deadline,
                        errandData.additionalInstructions
                    ]
                );

                const errandId = result.rows[0].id;

                // Clear errand creation session
                ctx.session.errandCreation = {};

                await ctx.reply(
                    `✅ Errand created successfully!\nErrand ID: ${errandId}\n\nErranders will be notified and can make offers.`
                );

                // Notify available erranders
                const erranders = await query(
                    'SELECT telegram_id FROM users WHERE user_type = $1 AND verification_status = $2',
                    ['errander', 'active']
                );

                const notificationMessage = 
                    `🆕 New errand request!\n\n` +
                    `Task: ${errandData.taskDescription}\n` +
                    `Budget: $${errandData.budget}\n` +
                    `Use /offer_errand ${errandId} to make an offer`;

                for (const errander of erranders.rows) {
                    try {
                        await ctx.telegram.sendMessage(errander.telegram_id, notificationMessage);
                    } catch (error) {
                        console.error(`Failed to notify errander ${errander.telegram_id}:`, error);
                    }
                }
                break;
        }
    } catch (error) {
        throw error;
    }
});

// Handle offers from erranders
errands.command('offer_errand', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 3) {
            throw new ValidationError('Usage: /offer_errand <errand_id> <price>');
        }

        const [_, errandId, price] = args;
        
        // Verify errander status
        const errander = await query(
            'SELECT * FROM users WHERE telegram_id = $1 AND user_type = $2 AND verification_status = $3',
            [ctx.from.id, 'errander', 'active']
        );

        if (errander.rows.length === 0) {
            throw new ValidationError('Only verified erranders can make offers');
        }

        // Verify errand exists and is pending
        const errand = await query(
            'SELECT * FROM errands WHERE id = $1 AND status = $2',
            [errandId, 'pending']
        );

        if (errand.rows.length === 0) {
            throw new ValidationError('Errand not found or not available');
        }

        // Create offer
        await query(
            `INSERT INTO offers (user_id, errand_id, price)
             VALUES ($1, $2, $3)`,
            [errander.rows[0].id, errandId, parseFloat(price)]
        );

        await ctx.reply('Offer submitted successfully! You will be notified if accepted.');

        // Notify customer
        const notificationMessage = 
            `🎉 New offer for your errand!\n\n` +
            `Errand ID: ${errandId}\n` +
            `Price: $${price}\n\n` +
            `Use /accept_errand ${errandId} ${errander.rows[0].id} to accept`;

        await ctx.telegram.sendMessage(
            errand.rows[0].customer_telegram_id,
            notificationMessage
        );
    } catch (error) {
        throw error;
    }
});

// Handle errand offer acceptance
errands.command('accept_errand', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 3) {
            throw new ValidationError('Usage: /accept_errand <errand_id> <errander_id>');
        }

        const [_, errandId, erranderId] = args;

        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Update errand status and assign errander
            const result = await client.query(
                `UPDATE errands 
                 SET status = $1, errander_id = $2
                 WHERE id = $3 AND customer_telegram_id = $4 AND status = $5
                 RETURNING *`,
                ['in_progress', erranderId, errandId, ctx.from.id, 'pending']
            );

            if (result.rows.length === 0) {
                throw new ValidationError('Errand not found or not available');
            }

            // Update other offers as rejected
            await client.query(
                `UPDATE offers 
                 SET status = $1
                 WHERE errand_id = $2 AND user_id != $3`,
                ['rejected', errandId, erranderId]
            );

            await client.query('COMMIT');

            await ctx.reply('Offer accepted! The errander will be notified.');

            // Get errander's telegram ID
            const errander = await query(
                'SELECT telegram_id FROM users WHERE id = $1',
                [erranderId]
            );

            // Notify errander
            await ctx.telegram.sendMessage(
                errander.rows[0].telegram_id,
                `🎉 Your offer for errand ${errandId} has been accepted! You can start the task.`
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

// Handle errand completion
errands.command('complete_errand', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 2) {
            throw new ValidationError('Usage: /complete_errand <errand_id>');
        }

        const [_, errandId] = args;
        
        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify errand exists and is in progress
            const errand = await client.query(
                `SELECT * FROM errands 
                WHERE id = $1 
                AND (customer_telegram_id = $2 OR errander_id IN (
                    SELECT id FROM users WHERE telegram_id = $2
                ))
                AND status = $3`,
                [errandId, ctx.from.id, 'in_progress']
            );

            if (errand.rows.length === 0) {
                throw new ValidationError('Errand not found or cannot be completed');
            }

            // Update errand status
            await client.query(
                'UPDATE errands SET status = $1 WHERE id = $2',
                ['completed', errandId]
            );

            await client.query('COMMIT');

            // Get the other party's telegram ID
            let otherPartyId;
            if (errand.rows[0].customer_telegram_id === ctx.from.id) {
                const errander = await query(
                    'SELECT telegram_id FROM users WHERE id = $1',
                    [errand.rows[0].errander_id]
                );
                otherPartyId = errander.rows[0].telegram_id;
            } else {
                otherPartyId = errand.rows[0].customer_telegram_id;
            }

            // Notify both parties
            await ctx.reply(
                '✅ Errand marked as completed! Please rate your experience using:\n' +
                `/rate_errand ${errandId} <1-5> [review text]`
            );

            await ctx.telegram.sendMessage(
                otherPartyId,
                `Errand ${errandId} has been marked as completed!\n` +
                `Please rate your experience using:\n` +
                `/rate_errand ${errandId} <1-5> [review text]`
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

// Handle rating submission for errands
errands.command('rate_errand', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            throw new ValidationError('Usage: /rate_errand <errand_id> <rating 1-5> [review text]');
        }

        const [_, errandId, ratingStr, ...reviewParts] = args;
        const rating = parseInt(ratingStr);
        const review = reviewParts.join(' ');

        if (isNaN(rating) || rating < 1 || rating > 5) {
            throw new ValidationError('Rating must be a number between 1 and 5');
        }

        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify errand exists and is completed
            const errand = await client.query(
                `SELECT * FROM errands 
                WHERE id = $1 
                AND (customer_telegram_id = $2 OR errander_id IN (
                    SELECT id FROM users WHERE telegram_id = $2
                ))
                AND status = $3`,
                [errandId, ctx.from.id, 'completed']
            );

            if (errand.rows.length === 0) {
                throw new ValidationError('Errand not found or cannot be rated');
            }

            // Get user ID of the person being rated
            let ratedUserId;
            if (errand.rows[0].customer_telegram_id === ctx.from.id) {
                ratedUserId = errand.rows[0].errander_id;
            } else {
                const customer = await query(
                    'SELECT id FROM users WHERE telegram_id = $1',
                    [errand.rows[0].customer_telegram_id]
                );
                ratedUserId = customer.rows[0].id;
            }

            // Check if already rated
            const existingRating = await query(
                'SELECT * FROM ratings WHERE errand_id = $1 AND user_id = $2',
                [errandId, ratedUserId]
            );

            if (existingRating.rows.length > 0) {
                throw new ValidationError('You have already rated this errand');
            }

            // Insert rating
            await client.query(
                `INSERT INTO ratings (user_id, errand_id, rating, review)
                VALUES ($1, $2, $3, $4)`,
                [ratedUserId, errandId, rating, review]
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

// Handle dispute creation for errands
errands.command('dispute_errand', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            throw new ValidationError('Usage: /dispute_errand <errand_id> <description>');
        }

        const [_, errandId, ...descriptionParts] = args;
        const description = descriptionParts.join(' ');

        // Start transaction
        const client = await query.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify errand exists and user is involved
            const errand = await client.query(
                `SELECT * FROM errands 
                WHERE id = $1 
                AND (customer_telegram_id = $2 OR errander_id IN (
                    SELECT id FROM users WHERE telegram_id = $2
                ))`,
                [errandId, ctx.from.id]
            );

            if (errand.rows.length === 0) {
                throw new ValidationError('Errand not found or you are not involved in it');
            }

            // Create dispute
            await client.query(
                `INSERT INTO disputes (
                    errand_id, 
                    created_by_telegram_id,
                    description
                ) VALUES ($1, $2, $3)`,
                [errandId, ctx.from.id, description]
            );

            // Update errand status
            await client.query(
                'UPDATE errands SET status = $1 WHERE id = $2',
                ['disputed', errandId]
            );

            await client.query('COMMIT');

            // Notify both parties and admin
            await ctx.reply('Dispute has been registered. An admin will review the case.');

            // Get the other party's telegram ID
            let otherPartyId;
            if (errand.rows[0].customer_telegram_id === ctx.from.id) {
                const errander = await query(
                    'SELECT telegram_id FROM users WHERE id = $1',
                    [errand.rows[0].errander_id]
                );
                otherPartyId = errander.rows[0].telegram_id;
            } else {
                otherPartyId = errand.rows[0].customer_telegram_id;
            }

            // Notify other party
            await ctx.telegram.sendMessage(
                otherPartyId,
                `A dispute has been opened for errand ${errandId}. An admin will review the case.`
            );

            // Notify admin
            if (process.env.ADMIN_CHAT_ID) {
                await ctx.telegram.sendMessage(
                    process.env.ADMIN_CHAT_ID,
                    `🚨 New dispute opened!\n\n` +
                    `Errand ID: ${errandId}\n` +
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

module.exports = errands;