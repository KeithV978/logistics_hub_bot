const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Errand = sequelize.define('Errand', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    errandId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    customerTelegramId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        hasRequiredFields(value) {
          if (!value.lat || !value.lng || !value.address) {
            throw new Error('Location must include lat, lng, and address');
          }
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'offered', 'accepted', 'in_progress', 'completed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    erranderId: {
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
    tableName: 'errands',
    timestamps: true,
  });

  return Errand;
};