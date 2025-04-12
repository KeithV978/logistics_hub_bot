const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
    },
    createdAt: { type: Date, default: Date.now }
});

customerSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Customer', customerSchema);