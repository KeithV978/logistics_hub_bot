const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config');
const { v4: uuidv4 } = require('uuid');

class Session extends Model {}

Session.init({
  sessionId: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  telegramId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: () => {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 10); // 10 minutes expiry
      return date;
    }
  }
}, {
  sequelize,
  modelName: 'Session',
  tableName: 'sessions',
  timestamps: true,
  indexes: [
    {
      fields: ['telegramId']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

// Add a method to check if session is expired
Session.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Add a method to extend session expiry
Session.prototype.extend = async function(minutes = 10) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  this.expiresAt = date;
  await this.save();
};

module.exports = Session; 