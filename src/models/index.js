const sequelize = require('../config/database');
const User = require('./User');
const Order = require('./Order');
const Offer = require('./Offer');
const Review = require('./Review');

// Initialize models in correct order
const models = {
  User,
  Order,
  Offer,
  Review
};

// User - Order relationships
User.hasMany(Order, {
  foreignKey: 'customerTelegramId',
  sourceKey: 'telegramId',
  as: 'orders',
  onDelete: 'CASCADE'
});

Order.belongsTo(User, {
  foreignKey: 'customerTelegramId',
  targetKey: 'telegramId',
  as: 'customer'
});

// Assigned user relationship
Order.belongsTo(User, {
  foreignKey: 'assignedUserId',
  as: 'assignedUser'
});

User.hasMany(Order, {
  foreignKey: 'assignedUserId',
  as: 'assignedOrders'
});

// User - Offer relationships
User.hasMany(Offer, {
  foreignKey: 'userId',
  as: 'offers',
  onDelete: 'CASCADE'
});

Offer.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Order - Offer relationships
Order.hasMany(Offer, {
  foreignKey: 'orderId',
  as: 'offers',
  onDelete: 'CASCADE'
});

Offer.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order'
});

// Review relationships
Order.hasMany(Review, {
  foreignKey: 'orderId',
  as: 'reviews',
  onDelete: 'CASCADE'
});

Review.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order'
});

User.hasMany(Review, {
  foreignKey: 'reviewedUserId',
  as: 'receivedReviews',
  onDelete: 'CASCADE'
});

Review.belongsTo(User, {
  foreignKey: 'reviewedUserId',
  as: 'reviewedUser'
});

User.hasMany(Review, {
  foreignKey: 'reviewerId',
  sourceKey: 'telegramId',
  as: 'givenReviews',
  onDelete: 'CASCADE'
});

Review.belongsTo(User, {
  foreignKey: 'reviewerId',
  targetKey: 'telegramId',
  as: 'reviewer'
});

// Test the connection
sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Sync all mothenticate()dels
// Note: In production, you should use migrations instead of sync
sequelize.sync({ alter: true }).then(() => {
  console.log('Database & tables created!');
});

module.exports = {
  sequelize,
  ...models
}; 