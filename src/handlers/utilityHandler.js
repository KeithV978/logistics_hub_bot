const { Composer } = require('telegraf');
const { ValidationError } = require('../middlewares/errorHandler');
const { query } = require('../database/connection');

const utilities = new Composer();

// View order/errand history
utilities.command('history', async (ctx) => {
    try {
        // Get orders where user is customer or rider
        const orders = await query(
            `SELECT o.*, u.full_name as rider_name
             FROM orders o
             LEFT JOIN users u ON o.rider_id = u.id
             WHERE o.customer_telegram_id = $1 
             OR o.rider_id IN (SELECT id FROM users WHERE telegram_id = $1)
             ORDER BY o.created_at DESC
             LIMIT 5`,
            [ctx.from.id]
        );

        // Get errands where user is customer or errander
        const errands = await query(
            `SELECT e.*, u.full_name as errander_name
             FROM errands e
             LEFT JOIN users u ON e.errander_id = u.id
             WHERE e.customer_telegram_id = $1 
             OR e.errander_id IN (SELECT id FROM users WHERE telegram_id = $1)
             ORDER BY e.created_at DESC
             LIMIT 5`,
            [ctx.from.id]
        );

        let message = '📋 Recent Activity:\n\n';

        if (orders.rows.length > 0) {
            message += '🚚 Orders:\n';
            for (const order of orders.rows) {
                message += `ID: ${order.id}\n`;
                message += `Status: ${order.status}\n`;
                message += `Item: ${order.item_description}\n`;
                if (order.rider_name) message += `Rider: ${order.rider_name}\n`;
                message += `Created: ${order.created_at.toLocaleString()}\n\n`;
            }
        }

        if (errands.rows.length > 0) {
            message += '🏃 Errands:\n';
            for (const errand of errands.rows) {
                message += `ID: ${errand.id}\n`;
                message += `Status: ${errand.status}\n`;
                message += `Task: ${errand.task_description}\n`;
                if (errand.errander_name) message += `Errander: ${errand.errander_name}\n`;
                message += `Created: ${errand.created_at.toLocaleString()}\n\n`;
            }
        }

        if (orders.rows.length === 0 && errands.rows.length === 0) {
            message += 'No recent activity found.';
        }

        await ctx.reply(message);
    } catch (error) {
        throw error;
    }
});

// View ratings
utilities.command('ratings', async (ctx) => {
    try {
        // Get user's ID
        const user = await query(
            'SELECT id FROM users WHERE telegram_id = $1',
            [ctx.from.id]
        );

        if (user.rows.length === 0) {
            throw new ValidationError('You need to be registered to view ratings');
        }

        // Get average rating and total reviews
        const ratings = await query(
            `SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
             FROM ratings
             WHERE user_id = $1`,
            [user.rows[0].id]
        );

        // Get recent reviews with text
        const reviews = await query(
            `SELECT r.rating, r.review, r.created_at,
                    CASE 
                        WHEN o.id IS NOT NULL THEN 'Order'
                        ELSE 'Errand'
                    END as type
             FROM ratings r
             LEFT JOIN orders o ON r.order_id = o.id
             LEFT JOIN errands e ON r.errand_id = e.id
             WHERE r.user_id = $1 AND r.review IS NOT NULL
             ORDER BY r.created_at DESC
             LIMIT 3`,
            [user.rows[0].id]
        );

        const stats = ratings.rows[0];
        const avgRating = parseFloat(stats.average_rating || 0).toFixed(1);

        let message = '⭐ Your Rating Summary\n\n';
        message += `Overall Rating: ${avgRating} ⭐\n`;
        message += `Total Reviews: ${stats.total_reviews}\n\n`;

        // Rating distribution
        message += 'Rating Distribution:\n';
        message += `5⭐: ${stats.five_star}\n`;
        message += `4⭐: ${stats.four_star}\n`;
        message += `3⭐: ${stats.three_star}\n`;
        message += `2⭐: ${stats.two_star}\n`;
        message += `1⭐: ${stats.one_star}\n\n`;

        // Recent reviews
        if (reviews.rows.length > 0) {
            message += 'Recent Reviews:\n';
            for (const review of reviews.rows) {
                message += `${review.type} - ${review.rating}⭐\n`;
                message += `"${review.review}"\n`;
                message += `${review.created_at.toLocaleString()}\n\n`;
            }
        }

        await ctx.reply(message);
    } catch (error) {
        throw error;
    }
});

// View active orders/errands
utilities.command('active', async (ctx) => {
    try {
        // Get active orders
        const orders = await query(
            `SELECT o.*, u.full_name as rider_name
             FROM orders o
             LEFT JOIN users u ON o.rider_id = u.id
             WHERE (o.customer_telegram_id = $1 
                   OR o.rider_id IN (SELECT id FROM users WHERE telegram_id = $1))
             AND o.status IN ('pending', 'in_progress')
             ORDER BY o.created_at DESC`,
            [ctx.from.id]
        );

        // Get active errands
        const errands = await query(
            `SELECT e.*, u.full_name as errander_name
             FROM errands e
             LEFT JOIN users u ON e.errander_id = u.id
             WHERE (e.customer_telegram_id = $1 
                   OR e.errander_id IN (SELECT id FROM users WHERE telegram_id = $1))
             AND e.status IN ('pending', 'in_progress')
             ORDER BY e.created_at DESC`,
            [ctx.from.id]
        );

        let message = '🔄 Active Tasks:\n\n';

        if (orders.rows.length > 0) {
            message += '📦 Orders:\n';
            for (const order of orders.rows) {
                message += `ID: ${order.id}\n`;
                message += `Status: ${order.status}\n`;
                message += `Item: ${order.item_description}\n`;
                if (order.rider_name) message += `Rider: ${order.rider_name}\n`;
                if (order.status === 'in_progress') {
                    message += `Complete with: /complete_order ${order.id}\n`;
                }
                message += '\n';
            }
        }

        if (errands.rows.length > 0) {
            message += '🏃 Errands:\n';
            for (const errand of errands.rows) {
                message += `ID: ${errand.id}\n`;
                message += `Status: ${errand.status}\n`;
                message += `Task: ${errand.task_description}\n`;
                if (errand.errander_name) message += `Errander: ${errand.errander_name}\n`;
                if (errand.status === 'in_progress') {
                    message += `Complete with: /complete_errand ${errand.id}\n`;
                }
                message += '\n';
            }
        }

        if (orders.rows.length === 0 && errands.rows.length === 0) {
            message += 'No active tasks found.';
        }

        await ctx.reply(message);
    } catch (error) {
        throw error;
    }
});

// Help command with all available commands
utilities.command('help', async (ctx) => {
    const helpMessage = `
🤖 Available Commands:

Registration:
/register - Register as a rider or errander

Orders & Errands:
/order - Create a new delivery order
/errand - Create a new errand request
/offer <order_id> <price> - Make an offer for an order
/offer_errand <errand_id> <price> - Make an offer for an errand
/accept_offer <order_id> <rider_id> - Accept a rider's offer
/accept_errand <errand_id> <errander_id> - Accept an errander's offer

Task Management:
/active - View your active orders and errands
/history - View your recent orders and errands
/complete_order <order_id> - Mark an order as completed
/complete_errand <errand_id> - Mark an errand as completed

Ratings & Reviews:
/ratings - View your ratings and reviews
/rate_order <order_id> <1-5> [review] - Rate an order
/rate_errand <errand_id> <1-5> [review] - Rate an errand

Issues & Support:
/dispute_order <order_id> <description> - Open a dispute for an order
/dispute_errand <errand_id> <description> - Open a dispute for an errand
/support - Contact support for help

For more details about any command, use it without parameters and you'll receive instructions.
    `;

    await ctx.reply(helpMessage);
});

module.exports = utilities;