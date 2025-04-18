const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../../config/database');

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: "postgres",
  logging: true,
  pool: true,
});

const db = {};

// Import all models
const models = [
  'user.model.js',
  'order.model.js',
  'errand.model.js', 
  'group.model.js',
  'session.model.js',
  'tracking.model.js', 
];

models.forEach(model => {
  const modelPath = path.join(__dirname, model);
  const modelDefinition = require(modelPath)(sequelize);
  db[modelDefinition.name] = modelDefinition;
});

// Define associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Set up specific model associations

// User associations
db.User.hasMany(db.Order, { foreignKey: 'riderId', as: 'orders' });
db.User.hasMany(db.Errand, { foreignKey: 'erranderId', as: 'errands' });
db.User.hasMany(db.Offer, { foreignKey: 'userId', as: 'offers' });
db.User.hasMany(db.Tracking, { foreignKey: 'userId', as: 'trackings' });
db.User.hasMany(db.Rating, { foreignKey: 'userId', as: 'ratings' });
db.User.hasMany(db.Group, { foreignKey: 'userId', as: 'groups' });

// Order associations
db.Order.belongsTo(db.User, { foreignKey: 'riderId', as: 'rider' });
db.Order.hasMany(db.Offer, { foreignKey: 'orderId', as: 'offers' });
db.Order.hasOne(db.Group, { foreignKey: 'orderId', as: 'group' });
db.Order.hasMany(db.Tracking, { foreignKey: 'orderId', as: 'trackings' });
db.Order.hasOne(db.Rating, { foreignKey: 'orderId', as: 'rating' });

// Errand associations
db.Errand.belongsTo(db.User, { foreignKey: 'erranderId', as: 'errander' });
db.Errand.hasMany(db.Offer, { foreignKey: 'errandId', as: 'offers' });
db.Errand.hasOne(db.Group, { foreignKey: 'errandId', as: 'group' });
db.Errand.hasMany(db.Tracking, { foreignKey: 'errandId', as: 'trackings' });
db.Errand.hasOne(db.Rating, { foreignKey: 'errandId', as: 'rating' });

// Offer associations
// db.Offer.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
// db.Offer.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
// db.Offer.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });

// Group associations
db.Group.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
db.Group.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });
db.Group.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

// // Tracking associations
db.Tracking.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
db.Tracking.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
db.Tracking.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });

// Rating associations
// db.Rating.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
// db.Rating.belongsTo(db.Order, { foreignKey: 'orderId', as: 'order' });
// db.Rating.belongsTo(db.Errand, { foreignKey: 'errandId', as: 'errand' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;