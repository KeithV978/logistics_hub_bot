require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const express = require('express');
const axios = require('axios');

// Initialize Telegram bot and Express app
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());

// Postgres connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Middleware to verify webhook requests (optional security)
const webhookSecret = process.env.BOT_TOKEN.split(':')[1];
app.use((req, res, next) => {
    const telegramSignature = req.headers['x-telegram-bot-api-secret-token'];
    if (telegramSignature !== webhookSecret) {
        return res.status(403).send('Unauthorized');
    }
    next();
});

// Utility functions
async function verifyNIN(nin) {
    // Mock NIN verification (replace with real API)
    return Promise.resolve(true);
}

async function calculateDistance(lat1, lon1, lat2, lon2) {
    // Mock geolocation distance calculation (replace with real API)
    return Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2); // Simplified
}

// Registration for riders and erranders
bot.command(['register_rider', 'register_errander'], async (ctx) => {
    const role = ctx.command === '/register_rider' ? 'rider' : 'errander';
    const telegramId = ctx.from.id.toString();

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    if (existingUser.rows.length > 0) {
        return ctx.reply('You are already registered.');
    }

    // Collect details (simplified here; use a conversation flow in production)
    await ctx.reply('Please provide your full name, phone number, bank details, NIN, and a photograph (send as a photo message).');
    bot.on('text', async (ctx) => {
        const [fullName, phoneNumber, bankDetails, nin] = ctx.message.text.split(',').map(s => s.trim());
        const photo = ctx.message.photo ? ctx.message.photo[0].file_id : null;

        const isNinValid = await verifyNIN(nin);
        if (!isNinValid) {
            return ctx.reply('NIN verification failed. Please try again or contact support.');
        }

        await pool.query(
            'INSERT INTO users (telegram_id, full_name, phone_number, bank_details, photograph_url, nin, role) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [telegramId, fullName, phoneNumber, bankDetails, photo, nin, role]
        );
        ctx.reply('Registration submitted for verification.');
    });
});

// Order creation
bot.command('create_order', async (ctx) => {
    const customerId = ctx.from.id.toString();
    await ctx.reply('Please provide pickup location, drop-off location, and instructions (comma-separated).');
    bot.on('text', async (ctx) => {
        const [pickup, dropOff, instructions] = ctx.message.text.split(',').map(s => s.trim());
        const { rows } = await pool.query(
            'INSERT INTO orders (customer_telegram_id, pickup_location, drop_off_location, instructions) VALUES ($1, $2, $3, $4) RETURNING id',
            [customerId, pickup, dropOff, instructions || '']
        );
        const orderId = rows[0].id;

        // Search for riders (mock radius logic)
        const riders = await pool.query('SELECT * FROM users WHERE role = $1 AND verification_status = $2', ['rider', 'verified']);
        if (riders.rows.length === 0) {
            return ctx.reply('No riders available. Please try again later.');
        }

        riders.rows.forEach(rider => {
            bot.telegram.sendMessage(rider.telegram_id, `New order #${orderId}: Pickup: ${pickup}, Drop-off: ${dropOff}, Instructions: ${instructions || 'None'}`);
        });
        ctx.reply(`${riders.rows.length} riders found. Please wait for offers.`);
    });
});

// Errand creation
bot.command('create_errand', async (ctx) => {
    const customerId = ctx.from.id.toString();
    await ctx.reply('Please provide errand location and details (comma-separated).');
    bot.on('text', async (ctx) => {
        const [location, details] = ctx.message.text.split(',').map(s => s.trim());
        const { rows } = await pool.query(
            'INSERT INTO errands (customer_telegram_id, location, details) VALUES ($1, $2, $3) RETURNING id',
            [customerId, location, details]
        );
        const errandId = rows[0].id;

        // Search for erranders (mock radius logic)
        const erranders = await pool.query('SELECT * FROM users WHERE role = $1 AND verification_status = $2', ['errander', 'verified']);
        if (erranders.rows.length === 0) {
            return ctx.reply('No erranders available. Please try again later.');
        }

        erranders.rows.forEach(errander => {
            bot.telegram.sendMessage(errander.telegram_id, `New errand #${errandId}: Location: ${location}, Details: ${details}`);
        });
        ctx.reply(`${erranders.rows.length} erranders found. Please wait for offers.`);
    });
});

// Offer management
bot.command('make_offer', async (ctx) => {
    const [_, id, price] = ctx.message.text.split(' ');
    const userId = ctx.from.id.toString();
    const user = await pool.query('SELECT * FROM users WHERE telegram_id = $1 AND verification_status = $2', [userId, 'verified']);
    if (user.rows.length === 0) return ctx.reply('You must be a verified rider/errander.');

    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND status = $2', [id, 'pending']);
    const errand = await pool.query('SELECT * FROM errands WHERE id = $1 AND status = $2', [id, 'pending']);
    if (order.rows.length === 0 && errand.rows.length === 0) return ctx.reply('Invalid or taken order/errand.');

    const offerData = {
        user_id: user.rows[0].id,
        price: parseFloat(price),
        vehicle_type: user.rows[0].role === 'rider' ? 'bike' : null, // Simplified
    };
    const table = order.rows.length > 0 ? 'order_id' : 'errand_id';
    const value = order.rows.length > 0 ? order.rows[0].id : errand.rows[0].id;

    const { rows } = await pool.query(
        `INSERT INTO offers (${table}, user_id, price, vehicle_type) VALUES ($1, $2, $3, $4) RETURNING id`,
        [value, offerData.user_id, offerData.price, offerData.vehicle_type]
    );
    const offerId = rows[0].id;

    const customerId = order.rows.length > 0 ? order.rows[0].customer_telegram_id : errand.rows[0].customer_telegram_id;
    bot.telegram.sendMessage(customerId, `New offer for #${id}: $${price}, Rating: ${user.rows[0].rating}, Vehicle: ${offerData.vehicle_type || 'N/A'}. Use /accept_offer ${offerId}`);
    await pool.query(`UPDATE ${order.rows.length > 0 ? 'orders' : 'errands'} SET status = $1 WHERE id = $2`, ['offered', id]);
});

// Accept offer
bot.command('accept_offer', async (ctx) => {
    const [_, offerId] = ctx.message.text.split(' ');
    const offer = await pool.query('SELECT * FROM offers WHERE id = $1 AND status = $2', [offerId, 'pending']);
    if (offer.rows.length === 0) return ctx.reply('Invalid or already accepted offer.');

    const order = offer.rows[0].order_id ? await pool.query('SELECT * FROM orders WHERE id = $1', [offer.rows[0].order_id]) : null;
    const errand = offer.rows[0].errand_id ? await pool.query('SELECT * FROM errands WHERE id = $1', [offer.rows[0].errand_id]) : null;
    const customerId = order?.rows[0]?.customer_telegram_id || errand.rows[0].customer_telegram_id;
    if (customerId !== ctx.from.id.toString()) return ctx.reply('You cannot accept this offer.');

    // Create private group
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [offer.rows[0].user_id]);
    const group = await bot.telegram.createChatInviteLink({ creator_id: ctx.from.id }, { name: `Transaction #${offerId}` });
    const chatId = group.chat.id;

    await bot.telegram.sendMessage(chatId, 'Rules of Engagement: Be respectful, share updates, report issues to admin.');
    await pool.query('UPDATE offers SET status = $1 WHERE id = $2', ['accepted', offerId]);
    await pool.query(`UPDATE ${order ? 'orders' : 'errands'} SET status = $1 WHERE id = $2`, ['accepted', order?.rows[0].id || errand.rows[0].id]);
    await pool.query('INSERT INTO transactions (offer_id, group_chat_id) VALUES ($1, $2)', [offerId, chatId]);

    bot.telegram.sendMessage(user.rows[0].telegram_id, 'Your offer was accepted! Please share your live location in the group.');
    ctx.reply('Offer accepted. Join the group to communicate and track: ' + group.invite_link);
});

// Live tracking
bot.command('start_tracking', async (ctx) => {
    const transaction = await pool.query('SELECT * FROM transactions WHERE group_chat_id = $1 AND status = $2', [ctx.chat.id, 'in_progress']);
    if (transaction.rows.length === 0) return ctx.reply('No active transaction in this group.');

    ctx.reply('Please share your live location using Telegram’s live location feature.');
});

bot.on('location', async (ctx) => {
    if (ctx.message.live_period) {
        const transaction = await pool.query('SELECT * FROM transactions WHERE group_chat_id = $1 AND status = $2', [ctx.chat.id, 'in_progress']);
        if (transaction.rows.length > 0) {
            ctx.reply('Live tracking started.');
        }
    }
});

// Transaction completion
bot.command('payment_received', async (ctx) => {
    const transaction = await pool.query('SELECT * FROM transactions WHERE group_chat_id = $1 AND status = $2', [ctx.chat.id, 'in_progress']);
    if (transaction.rows.length === 0) return ctx.reply('No active transaction.');

    await pool.query('UPDATE transactions SET payment_confirmed = TRUE WHERE id = $1', [transaction.rows[0].id]);
    checkTransactionCompletion(transaction.rows[0].id, ctx);
});

bot.command('delivery_successful', async (ctx) => {
    const transaction = await pool.query('SELECT * FROM transactions WHERE group_chat_id = $1 AND status = $2', [ctx.chat.id, 'in_progress']);
    if (transaction.rows.length === 0) return ctx.reply('No active transaction.');

    await pool.query('UPDATE transactions SET delivery_confirmed = TRUE WHERE id = $1', [transaction.rows[0].id]);
    checkTransactionCompletion(transaction.rows[0].id, ctx);
});

async function checkTransactionCompletion(transactionId, ctx) {
    const transaction = await pool.query('SELECT * FROM transactions WHERE id = $1', [transactionId]);
    if (transaction.rows[0].payment_confirmed && transaction.rows[0].delivery_confirmed) {
        await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['completed', transactionId]);
        const offer = await pool.query('SELECT * FROM offers WHERE id = $1', [transaction.rows[0].offer_id]);
        const user = await pool.query('SELECT * FROM users WHERE id = $1', [offer.rows[0].user_id]);
        await bot.telegram.deleteChat(transaction.rows[0].group_chat_id);
        ctx.reply(`Transaction completed. Please rate the ${user.rows[0].role}: /rate ${user.rows[0].telegram_id} [1-5] [review]`);
    }
}

// Rating
bot.command('rate', async (ctx) => {
    const [_, userId, rating, ...review] = ctx.message.text.split(' ');
    const transaction = await pool.query('SELECT * FROM transactions WHERE group_chat_id = $1 AND status = $2', [ctx.chat.id, 'completed']);
    if (!transaction.rows.length) return ctx.reply('No completed transaction to rate.');

    await pool.query('INSERT INTO reviews (user_id, transaction_id, rating, review_text) VALUES ($1, $2, $3, $4)', [userId, transaction.rows[0].id, parseInt(rating), review.join(' ')]);
    ctx.reply('Thank you for your review!');
});

// Webhook setup
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

app.listen(process.env.PORT, async () => {
    console.log(`Server running on port ${process.env.PORT}`);
    await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook`, { secret_token: webhookSecret });
    console.log('Webhook set');
});