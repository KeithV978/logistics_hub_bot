const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Tracking = sequelize.define('Tracking', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    errandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'errands',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        hasRequiredFields(value) {
          if (!value.lat || !value.lng) {
            throw new Error('Location must include lat and lng');
          }
        }
      }
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    }
  }, {
    tableName: 'tracking',
    timestamps: true,
    validate: {
      exactlyOneReference() {
        if ((this.orderId && this.errandId) || (!this.orderId && !this.errandId)) {
          throw new Error('A tracking record must be associated with exactly one order or one errand');
        }
      }
    }
  });

  return Tracking;
};