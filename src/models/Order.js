const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerTelegramId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('logistics', 'errand'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'pending',
  },
  pickupLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: false,
  },
  dropoffLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true,
  },
  errandLocation: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true,
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  errandDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  acceptedOfferId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  groupChatId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = Order; 