const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
    riderId: {
        type: String,
        required: true,
        unique: true
    },
    legalName: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true }
    },
    bankDetails: {
        accountNumber: { type: String, required: true },
        bankName: { type: String, required: true },
        accountName: { type: String, required: true }
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    vehicleType: {
        type: String,
        enum: ['motorcycle', 'bicycle', 'car', 'van', 'truck'],
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Add a pre-save hook to generate riderId if not provided
riderSchema.pre('save', function(next) {
    if (!this.riderId) {
        // Generate a unique riderId using timestamp and random string
        this.riderId = 'RID' + Date.now() + Math.random().toString(36).substr(2, 5);
    }
    next();
});

module.exports = mongoose.model('Rider', riderSchema);
