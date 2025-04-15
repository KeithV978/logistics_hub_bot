const { pool } = require('../models/database');
const axios = require('axios');

class UserService {
    async startRegistration(telegramId) {
        await pool.query(
            'INSERT INTO users (telegram_id, role, verification_status) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING',
            [telegramId, 'pending', 'pending']
        );
    }

    async updateRegistration(telegramId, data) {
        const fields = Object.keys(data);
        const values = Object.values(data);
        const query = `UPDATE users SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE telegram_id = $${fields.length + 1}`;
        await pool.query(query, [...values, telegramId]);
    }

    async verifyUser(telegramId) {
        const user = await this.getUser(telegramId);
        try {
            // Mock NIN verification
            const response = await axios.post('https://mock-nin-api.com/verify', { nin: user.nin });
            if (response.data.valid) {
                await pool.query(
                    'UPDATE users SET verification_status = $1, role = $2 WHERE telegram_id = $3',
                    ['verified', user.role === 'pending' ? 'rider' : user.role, telegramId]
                );
            } else {
                throw new Error('NIN verification failed');
            }
        } catch (error) {
            await pool.query('UPDATE users SET verification_status = $1 WHERE telegram_id = $2', ['failed', telegramId]);
            throw error;
        }
    }

    async getUser(telegramId) {
        const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
        return res.rows[0];
    }

    async rateUser(reviewerId, rating, reviewText) {
        const session = await pool.query('SELECT * FROM tracking_sessions WHERE status = $1 LIMIT 1', ['active']);
        if (!session.rows[0]) throw new Error('No active transaction');
        const userId = session.rows[0].rider_id;
        await pool.query(
            'INSERT INTO reviews (user_id, reviewer_id, rating, review_text) VALUES ($1, $2, $3, $4)',
            [userId, reviewerId, rating, reviewText]
        );
        const res = await pool.query(
            'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE user_id = $1',
            [userId]
        );
        await pool.query(
            'UPDATE users SET rating = $1, review_count = $2 WHERE telegram_id = $3',
            [res.rows[0].avg_rating, res.rows[0].review_count, userId]
        );
    }
}

module.exports = new UserService();