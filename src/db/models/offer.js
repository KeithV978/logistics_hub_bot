const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config');
const { v4: uuidv4 } = require('uuid');

class Offer extends Model {}

Offer.init({
  offerId: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'orders',
      key: 'orderId'
    }
  },
  errandId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'errands',
      key: 'errandId'
    }
  },
  riderId: {
    type: DataTypes.STRING,
    allowNull: true,
    references: {
      model: 'users',
      key: 'telegramId'
    }
  },
  erranderId: {
    type: DataTypes.STRING,
    allowNull: true,
    references: {
      model: 'users',
      key: 'telegramId'
    }
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  vehicleType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Offer',
  tableName: 'offers',
  timestamps: true,
  updatedAt: false,
  validate: {
    eitherOrderOrErrand() {
      if ((this.orderId && this.errandId) || (!this.orderId && !this.errandId)) {
        throw new Error('Offer must be associated with either an order or an errand, but not both');
      }
    },
    eitherRiderOrErrander() {
      if ((this.riderId && this.erranderId) || (!this.riderId && !this.erranderId)) {
        throw new Error('Offer must be associated with either a rider or an errander, but not both');
      }
    }
  },
  indexes: [
    {
      fields: ['orderId']
    },
    {
      fields: ['errandId']
    },
    {
      fields: ['riderId']
    },
    {
      fields: ['erranderId']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Offer; 