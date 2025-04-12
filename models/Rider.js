const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    isAvailable: { type: Boolean, default: true },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    bankDetails: {
        accountNumber: { type: String, required: true },
        bankName: { type: String, required: true }
    },
    currentOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    createdAt: { type: Date, default: Date.now }
});

riderSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Rider', riderSchema);