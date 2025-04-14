const Joi = require('joi');
const { ValidationError } = require('../middlewares/errorHandler');

// Location validation schema
const locationSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
});

// Order validation schema
const orderSchema = Joi.object({
    pickup: locationSchema.required(),
    dropoff: locationSchema.required(),
    itemDescription: Joi.string().min(3).max(1000).required(),
    deliveryInstructions: Joi.string().allow('').max(1000).optional()
});

// Errand validation schema
const errandSchema = Joi.object({
    location: locationSchema.required(),
    taskDescription: Joi.string().min(3).max(1000).required(),
    budget: Joi.number().positive().optional(),
    deadline: Joi.date().greater('now').optional(),
    additionalInstructions: Joi.string().allow('').max(1000).optional()
});

// Offer validation schema
const offerSchema = Joi.object({
    price: Joi.number().positive().required(),
    estimatedTimeMinutes: Joi.number().integer().min(1).required()
});

// Rating validation schema
const ratingSchema = Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    review: Joi.string().min(3).max(1000).optional()
});

// Dispute validation schema
const disputeSchema = Joi.object({
    description: Joi.string().min(10).max(1000).required()
});

// Helper function to validate data with custom error messages
const validate = async (schema, data) => {
    try {
        return await schema.validateAsync(data, { abortEarly: false });
    } catch (error) {
        if (error instanceof Joi.ValidationError) {
            throw new ValidationError(error.details.map(d => d.message).join(', '));
        }
        throw error;
    }
};

// Helper function to check if coordinates are within valid range and calculate distance
const validateLocation = async (location) => {
    await validate(locationSchema, location);
};

// Helper function to validate phone number format
const validatePhoneNumber = (phoneNumber) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
        throw new ValidationError('Invalid phone number format. Please include country code (e.g., +1234567890)');
    }
    return true;
};

// Helper function to validate bank account number format
const validateBankAccount = (accountNumber) => {
    if (!/^[A-Za-z0-9]{8,}$/.test(accountNumber)) {
        throw new ValidationError('Invalid bank account number. Must be at least 8 alphanumeric characters.');
    }
    return true;
};

module.exports = {
    validate,
    validateLocation,
    validatePhoneNumber,
    validateBankAccount,
    orderSchema,
    errandSchema,
    offerSchema,
    ratingSchema,
    disputeSchema,
    locationSchema
};