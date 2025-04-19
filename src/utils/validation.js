const { ValidationError } = require('./errors');

// Validate required fields
const validateRequired = (data, fields) => {
  const errors = [];
  
  fields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push({
        field,
        message: `${field} is required`
      });
    }
  });
  
  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
  
  return true;
};

// Validate string length
const validateLength = (value, field, min, max) => {
  if (typeof value !== 'string') {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be a string`
    }]);
  }
  
  if (value.length < min) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be at least ${min} characters`
    }]);
  }
  
  if (value.length > max) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be at most ${max} characters`
    }]);
  }
  
  return true;
};

// Validate numeric range
const validateRange = (value, field, min, max) => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be a number`
    }]);
  }
  
  if (value < min) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be at least ${min}`
    }]);
  }
  
  if (value > max) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be at most ${max}`
    }]);
  }
  
  return true;
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new ValidationError('Validation failed', [{
      field: 'email',
      message: 'Invalid email format'
    }]);
  }
  
  return true;
};

// Validate phone number format
const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  
  if (!phoneRegex.test(phoneNumber)) {
    throw new ValidationError('Validation failed', [{
      field: 'phoneNumber',
      message: 'Invalid phone number format'
    }]);
  }
  
  return true;
};

// Validate UUID format
const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(uuid)) {
    throw new ValidationError('Validation failed', [{
      field: 'uuid',
      message: 'Invalid UUID format'
    }]);
  }
  
  return true;
};

// Validate enum value
const validateEnum = (value, field, allowedValues) => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be one of: ${allowedValues.join(', ')}`
    }]);
  }
  
  return true;
};

// Validate JSON object
const validateJSON = (value, field) => {
  try {
    if (typeof value === 'string') {
      JSON.parse(value);
    } else if (typeof value !== 'object' || value === null) {
      throw new Error();
    }
  } catch (error) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be a valid JSON object`
    }]);
  }
  
  return true;
};

// Validate date format
const validateDate = (date, field) => {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be a valid date`
    }]);
  }
  
  return true;
};

// Validate location object
const validateLocation = (location, field) => {
  if (!location || typeof location !== 'object') {
    throw new ValidationError('Validation failed', [{
      field,
      message: `${field} must be a valid location object`
    }]);
  }
  
  if (typeof location.lat !== 'number' || isNaN(location.lat)) {
    throw new ValidationError('Validation failed', [{
      field: `${field}.lat`,
      message: 'Latitude must be a number'
    }]);
  }
  
  if (typeof location.lng !== 'number' || isNaN(location.lng)) {
    throw new ValidationError('Validation failed', [{
      field: `${field}.lng`,
      message: 'Longitude must be a number'
    }]);
  }
  
  if (location.lat < -90 || location.lat > 90) {
    throw new ValidationError('Validation failed', [{
      field: `${field}.lat`,
      message: 'Latitude must be between -90 and 90'
    }]);
  }
  
  if (location.lng < -180 || location.lng > 180) {
    throw new ValidationError('Validation failed', [{
      field: `${field}.lng`,
      message: 'Longitude must be between -180 and 180'
    }]);
  }
  
  return true;
};

module.exports = {
  validateRequired,
  validateLength,
  validateRange,
  validateEmail,
  validatePhoneNumber,
  validateUUID,
  validateEnum,
  validateJSON,
  validateDate,
  validateLocation
}; 