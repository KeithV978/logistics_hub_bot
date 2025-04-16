const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Group = sequelize.define('Group', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    groupId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
    customerTelegramId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: 'groups',
    timestamps: true,
    validate: {
      exactlyOneReference() {
        if ((this.orderId && this.errandId) || (!this.orderId && !this.errandId)) {
          throw new Error('A group must be associated with exactly one order or one errand');
        }
      }
    }
  });

  return Group;
};