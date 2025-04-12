const express = require('express');
const mongoose = require('mongoose');
const { bot } = require('./config');
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
bot.on('polling_error', (error) => {
    console.error('Bot polling error:', error);
});

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Bot is running...');
});

