const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider' },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'completed', 'cancelled'],
        default: 'pending'
    },
    pickupLocation: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
    },
    deliveryLocation: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
    },
    createdAt: { type: Date, default: Date.now }
});

orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ deliveryLocation: '2dsphere' });
module.exports = mongoose.model('Order', orderSchema);