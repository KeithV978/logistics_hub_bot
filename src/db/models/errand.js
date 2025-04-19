const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config');
const { v4: uuidv4 } = require('uuid');

class Errand extends Model {}

Errand.init({
  errandId: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  customerTelegramId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      hasRequiredFields(value) {
        const { lat, lng, address } = value;
        if (!lat || !lng || !address) {
          throw new Error('Location must include lat, lng, and address');
        }
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'offered', 'accepted', 'in_progress', 'completed', 'canceled'),
    defaultValue: 'pending',
    allowNull: false
  },
  erranderId: {
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
  modelName: 'Errand',
  tableName: 'errands',
  timestamps: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['customerTelegramId']
    },
    {
      fields: ['erranderId']
    }
  ]
});

module.exports = Errand; 