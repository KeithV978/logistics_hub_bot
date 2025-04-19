const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config');

class Group extends Model {}

Group.init({
  groupId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
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
  customerTelegramId: {
    type: DataTypes.STRING,
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
  }
}, {
  sequelize,
  modelName: 'Group',
  tableName: 'groups',
  timestamps: true,
  updatedAt: false,
  validate: {
    eitherOrderOrErrand() {
      if ((this.orderId && this.errandId) || (!this.orderId && !this.errandId)) {
        throw new Error('Group must be associated with either an order or an errand, but not both');
      }
    },
    eitherRiderOrErrander() {
      if ((this.riderId && this.erranderId) || (!this.riderId && !this.erranderId)) {
        throw new Error('Group must be associated with either a rider or an errander, but not both');
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
      fields: ['customerTelegramId']
    },
    {
      fields: ['riderId']
    },
    {
      fields: ['erranderId']
    }
  ]
});

module.exports = Group; 