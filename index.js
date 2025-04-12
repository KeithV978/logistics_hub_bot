const express = require('express');
const mongoose = require('mongoose');
const { initBot } = require('./config');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
})
.then(() => console.log('Connected to MongoDB :)'))
.catch(err => console.error('MongoDB connection error:', err));

// Initialize bot
const bot = initBot();

// Start polling only after server is ready
bot.on('polling_error', (error) => {
    console.error('Bot polling error:', error.message);
});

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        try {
            await bot.startPolling();
            console.log('Bot polling started successfully');
        } catch (error) {
            console.error('Failed to start bot polling:', error.message);
        }
    }
});

