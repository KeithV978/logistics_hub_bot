const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    customerTelegramId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pickupLocation: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        hasRequiredFields(value) {
          if (!value.lat || !value.lng || !value.address) {
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
          if (!value.lat || !value.lng || !value.address) {
            throw new Error('Dropoff location must include lat, lng, and address');
          }
        }
      }
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'offered', 'accepted', 'in_progress', 'completed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    riderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
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
    tableName: 'orders',
    timestamps: true,
  });

  return Order;
};