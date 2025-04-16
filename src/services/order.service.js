const db = require('../database');
const geolocationService = require('./geolocation.service');
const { v4: uuidv4 } = require('uuid');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const createOrder = async (data) => {
  try {
    const order = {
      orderId: uuidv4(),
      customerTelegramId: data.customerTelegramId,
      pickupLocation: data.pickupLocation,
      dropoffLocation: data.dropoffLocation,
      instructions: data.instructions || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.orders.insert(order);
    return order;
  } catch (error) {
    logger.error(`Error creating order: ${error.message}`, { data });
    throw new CustomError('Failed to create order', 'DatabaseError');
  }
};

const getOrder = async (orderId) => {
  try {
    const order = await db.orders.findOne({ orderId });
    if (!order) {
      throw new CustomError('Order not found', 'NotFoundError');
    }
    return order;
  } catch (error) {
    logger.error(`Error getting order: ${error.message}`, { orderId });
    throw error;
  }
};

const updateOrder = async (orderId, updates) => {
  try {
    const order = await db.orders.findOne({ orderId });
    if (!order) {
      throw new CustomError('Order not found', 'NotFoundError');
    }
    await db.orders.update(orderId, updates);
    return true;
  } catch (error) {
    logger.error(`Error updating order: ${error.message}`, { orderId, updates });
    throw new CustomError('Failed to update order', 'DatabaseError');
  }
};

const findNearbyRiders = async (location, radius) => {
  try {
    return await geolocationService.findUsersWithinRadius(location, radius, 'rider');
  } catch (error) {
    logger.error(`Error finding nearby riders: ${error.message}`, { location, radius });
    throw new CustomError('Failed to find nearby riders', 'GeolocationError');
  }
};

const assignRider = async (orderId, riderId) => {
  try {
    await updateOrder(orderId, { riderId, status: 'accepted' });
    return true;
  } catch (error) {
    logger.error(`Error assigning rider: ${error.message}`, { orderId, riderId });
    throw error;
  }
};

const updateOrderStatus = async (orderId, status) => {
  try {
    await updateOrder(orderId, { status });
    return true;
  } catch (error) {
    logger.error(`Error updating order status: ${error.message}`, { orderId, status });
    throw error;
  }
};

module.exports = {
  createOrder,
  getOrder,
  updateOrder,
  findNearbyRiders,
  assignRider,
  updateOrderStatus
};