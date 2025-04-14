const { Telegraf, session, Composer } = require('telegraf');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./src/config/config');
const { errorHandler } = require('./src/middlewares/errorHandler');
const { pool } = require('./src/database/connection');
const registration = require('./src/handlers/registrationHandler');
const orders = require('./src/handlers/orderHandler');
const errands = require('./src/handlers/errandHandler');
const utilities = require('./src/handlers/utilityHandler');

// Initialize bot with token
const bot = new Telegraf(config.telegram.token);

// Express app setup
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Session middleware
bot.use(session({
    defaultSession: () => ({
        registration: {},
        orderCreation: {},
        errandCreation: {}
    })
}));

// Error handling middleware
bot.use(errorHandler);

// Create a composer for all handlers
const composer = new Composer();
composer.use(registration);
composer.use(orders);
composer.use(errands);
composer.use(utilities);

// Register all handlers with the bot
bot.use(composer);

// Basic commands
bot.command('start', async (ctx) => {
    const welcomeMessage = `
Welcome to Logistics Hub! 🚀

I can help you with:
- Register as a rider or errander 🏃‍♂️
- Create delivery orders 📦
- Create errand requests 📝
- Manage your offers 💼
- Track active tasks 📋
- View order history 📊
- Handle ratings and reviews ⭐

To get started:
/register - Register as a rider or errander
/order - Create a new delivery order
/errand - Create a new errand request
/active - View your active tasks
/history - View your task history
/help - Show all available commands

Need support? Use /support to create a ticket.
`;
    
    await ctx.reply(welcomeMessage);
});

// Support command
bot.command('support', async (ctx) => {
    if (config.telegram.adminChatId) {
        await ctx.reply(
            'To contact support, please describe your issue in detail. An admin will get back to you shortly.\n\n' +
            'For common issues, you can use these commands:\n' +
            '/dispute_order <order_id> - Report an issue with an order\n' +
            '/dispute_errand <errand_id> - Report an issue with an errand\n' +
            '/help - View all available commands'
        );
    } else {
        await ctx.reply('Support is currently unavailable. Please try again later.');
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Logistics Hub Bot is running!');
});

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'OK', db: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', db: 'disconnected' });
    }
});

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Test bot connection
const testBotConnection = async () => {
    try {
        const me = await bot.telegram.getMe();
        console.log('Successfully connected to Telegram bot:', me.username);
        return true;
    } catch (error) {
        console.error('Failed to connect to Telegram:', error);
        return false;
    }
};

// Initialize webhook and start server
const startServer = async () => {
    try {
        // Test bot connection first
        const me = await bot.telegram.getMe();
        console.log('Successfully connected to Telegram bot:', me.username);

        if (process.env.NODE_ENV === 'production') {
            // Set up webhook for production
            const webhookUrl = `${config.telegram.webhookDomain}${config.telegram.webhookPath}`;
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`Webhook set to ${webhookUrl}`);
            
            // Set up Express endpoint for webhook
            app.use(bot.webhookCallback(config.telegram.webhookPath));
        } else {
            // Use polling for development
            await bot.launch();
            console.log('Bot started in polling mode');
        }
        
        // Start express server for webhook and health checks
        const PORT = process.env.PORT || config.server.port;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down gracefully...');
    try {
        await pool.end();
        console.log('Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the application
startServer();