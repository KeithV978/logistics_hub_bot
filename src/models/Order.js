const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider' },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'pickup', 'delivered', 'cancelled'],
        default: 'pending'
    },
    pickup: {
        location: {
            type: { type: String, default: 'Point' },
            coordinates: [Number]
        },
        address: String
    },
    delivery: {
        location: {
            type: { type: String, default: 'Point' },
            coordinates: [Number]
        },
        address: String
    },
    price: { type: Number },
    distance: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

orderSchema.index({ 'pickup.location': '2dsphere' });
orderSchema.index({ 'delivery.location': '2dsphere' });
module.exports = mongoose.model('Order', orderSchema);