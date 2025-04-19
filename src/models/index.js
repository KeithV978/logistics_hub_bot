const User = require('./User');
const Order = require('./Order');
const Offer = require('./Offer');
const Review = require('./Review');

// User - Order relationships
User.hasMany(Order, {
  foreignKey: 'customerTelegramId',
  sourceKey: 'telegramId',
  as: 'orders',
});
Order.belongsTo(User, {
  foreignKey: 'customerTelegramId',
  targetKey: 'telegramId',
  as: 'customer',
});

// User - Offer relationships
User.hasMany(Offer, {
  foreignKey: 'userId',
  as: 'offers',
});
Offer.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// Order - Offer relationships
Order.hasMany(Offer, {
  foreignKey: 'orderId',
  as: 'offers',
});
Offer.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order',
});

// Review relationships
Order.hasMany(Review, {
  foreignKey: 'orderId',
  as: 'reviews',
});
Review.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order',
});

User.hasMany(Review, {
  foreignKey: 'reviewedUserId',
  as: 'receivedReviews',
});
Review.belongsTo(User, {
  foreignKey: 'reviewedUserId',
  as: 'reviewedUser',
});

module.exports = {
  User,
  Order,
  Offer,
  Review,
}; 