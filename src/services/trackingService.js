const { pool } = require('../models/database');

class TrackingService {
    async updateLocation(telegramId, location) {
        const session = await this.getActiveSession(telegramId);
        if (session) {
            await pool.query(
                'UPDATE tracking_sessions SET location = $1, updated_at = $2 WHERE id = $3',
                [location, new Date(), session.id]
            );
        } else {
            const order = await pool.query('SELECT * FROM orders WHERE status = $1 LIMIT 1', ['accepted']);
            if (order.rows[0]) {
                await pool.query(
                    'INSERT INTO tracking_sessions (order_id, rider_id, location, status) VALUES ($1, $2, $3, $4)',
                    [order.rows[0].id, telegramId, location, 'active']
                );
            }
        }
    }

    async stopTracking(telegramId) {
        const session = await this.getActiveSession(telegramId);
        if (session) {
            await pool.query('UPDATE tracking_sessions SET status = $1 WHERE id = $2', ['stopped', session.id]);
        }
    }

    async getActiveSession(telegramId) {
        const res = await pool.query(
            'SELECT * FROM tracking_sessions WHERE rider_id = $1 AND status = $2',
            [telegramId, 'active']
        );
        return res.rows[0];
    }
}

module.exports = new TrackingService();