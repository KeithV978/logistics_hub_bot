const Joi = require('joi');

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  address: Joi.string().optional()
});

const phoneSchema = Joi.string().pattern(/^\+\d{10,15}$/).required();

const ninSchema = Joi.string().length(11).pattern(/^[0-9]+$/).required();

const priceSchema = Joi.number().positive().required();

module.exports = {
  validateLocation: (location) => locationSchema.validate(location),
  validatePhone: (phone) => phoneSchema.validate(phone),
  validateNIN: (nin) => ninSchema.validate(nin),
  validatePrice: (price) => priceSchema.validate(price)
};