const { pool } = require('../models/database');
const { calculateDistance } = require('../utils/helpers');
const userService = require('./userService');

class OrderService {
    async startOrderCreation(telegramId) {
        await pool.query(
            'INSERT INTO orders (customer_id, status) VALUES ($1, $2)',
            [telegramId, 'pending']
        );
    }

    async updateOrder(telegramId, data) {
        const order = await this.getPendingOrder(telegramId);
        const fields = Object.keys(data);
        const values = Object.values(data);
        const query = `UPDATE orders SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1}`;
        await pool.query(query, [...values, order.id]);
    }

    async getPendingOrder(telegramId) {
        const res = await pool.query(
            'SELECT * FROM orders WHERE customer_id = $1 AND status = $2',
            [telegramId, 'pending']
        );
        return res.rows[0];
    }

    async notifyRiders(order) {
        let radius = 3;
        let riders = [];
        while (riders.length === 0 && radius <= 12) {
            const res = await pool.query(
                'SELECT * FROM users WHERE role = $1 AND verification_status = $2',
                ['rider', 'verified']
            );
            riders = res.rows.filter((rider) =>
                calculateDistance(order.pickup_location, rider.last_location || { latitude: 0, longitude: 0 }) <= radius
            );
            radius += 3;
        }
        return riders;
    }

    async makeOffer(riderId, orderId, price) {
        const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND status = $2', [orderId, 'pending']);
        if (!order.rows[0]) throw new Error('Order not available');
        const res = await pool.query(
            'INSERT INTO offers (order_id, rider_id, price, vehicle_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [orderId, riderId, price, 'bike']
        );
        return { offer: res.rows[0], order: order.rows[0] };
    }

    async acceptOffer(offerId) {
        const offer = await pool.query(
            'SELECT o.*, u.* FROM offers o JOIN users u ON o.rider_id = u.telegram_id WHERE o.id = $1 AND o.status = $2',
            [offerId, 'pending']
        );
        if (!offer.rows[0]) throw new Error('Offer not available');
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['accepted', offer.rows[0].order_id]);
        await pool.query('UPDATE offers SET status = $1 WHERE id = $2', ['accepted', offerId]);
        return { order: offer.rows[0], rider: offer.rows[0] };
    }

    async completeOrder(orderId) {
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['completed', orderId]);
    }
}

module.exports = new OrderService();