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
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalRatings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  vehicleType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  currentLocation: {
    type: DataTypes.GEOMETRY,
    allowNull: true,
  },
  lastLocationUpdate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = User; 