const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  telegramId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('rider', 'errander'),
    allowNull: false,
  },
  bankAccountDetails: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  photograph: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nin: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  feedback: {
    type: DataTypes.JSONB,
    defaultValue: {
      rating: 0,
      totalRatings: 0,
      reviews: []
    },
    allowNull: false,
  },
  vehicleType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  currentLocation: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
  },
  lastLocationUpdate: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true,
  },
});

module.exports = User; 