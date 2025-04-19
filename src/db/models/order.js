const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config');
const { v4: uuidv4 } = require('uuid');

class Order extends Model {}

Order.init({
  orderId: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  customerTelegramId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pickupLocation: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      hasRequiredFields(value) {
        const { lat, lng, address } = value;
        if (!lat || !lng || !address) {
          throw new Error('Pickup location must include lat, lng, and address');
        }
      }
    }
  },
  dropoffLocation: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      hasRequiredFields(value) {
        const { lat, lng, address } = value;
        if (!lat || !lng || !address) {
          throw new Error('Dropoff location must include lat, lng, and address');
        }
      }
    }
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'offered', 'accepted', 'in_progress', 'completed', 'canceled'),
    defaultValue: 'pending',
    allowNull: false
  },
  riderId: {
    type: DataTypes.STRING,
    allowNull: true,
    references: {
      model: 'users',
      key: 'telegramId'
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Order',
  tableName: 'orders',
  timestamps: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['customerTelegramId']
    },
    {
      fields: ['riderId']
    }
  ]
});

module.exports = Order; 