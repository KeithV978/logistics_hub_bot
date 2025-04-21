const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  customerTelegramId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('logistics', 'errand'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'searching',
      'accepted',
      'in_progress',
      'completed',
      'cancelled',
      'expired'
    ),
    defaultValue: 'pending',
  },
  pickupLocation: {
    type: DataTypes.JSONB,
    allowNull: true, // Null for errands
    comment: 'Stores location as {latitude: number, longitude: number} or {address: string}'
  },
  dropoffLocation: {
    type: DataTypes.JSONB,
    allowNull: true, // Null for errands
    comment: 'Stores location as {latitude: number, longitude: number} or {address: string}'
  },
  errandLocation: {
    type: DataTypes.JSONB,
    allowNull: true, // Only for errands
    comment: 'Stores location as {latitude: number, longitude: number} or {address: string}'
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  assignedUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  groupChatId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  review: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = Order; 