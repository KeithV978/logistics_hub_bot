const { pool } = require('../models/database');
const { calculateDistance } = require('../utils/helpers');
const userService = require('./userService');

class ErrandService {
    async startErrandCreation(telegramId) {
        await pool.query(
            'INSERT INTO errands (customer_id, status) VALUES ($1, $2)',
            [telegramId, 'pending']
        );
    }

    async updateErrand(telegramId, data) {
        const errand = await this.getPendingErrand(telegramId);
        const fields = Object.keys(data);
        const values = Object.values(data);
        const query = `UPDATE errands SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE id = $${fields.length + 1}`;
        await pool.query(query, [...values, errand.id]);
    }

    async getPendingErrand(telegramId) {
        const res = await pool.query(
            'SELECT * FROM errands WHERE customer_id = $1 AND status = $2',
            [telegramId, 'pending']
        );
        return res.rows[0];
    }

    async notifyErranders(errand) {
        let radius = 2;
        let erranders = [];
        while (erranders.length === 0 && radius <= 6) {
            const res = await pool.query(
                'SELECT * FROM users WHERE role = $1 AND verification_status = $2',
                ['errander', 'verified']
            );
            erranders = res.rows.filter((errander) =>
                calculateDistance(errand.location, errander.last_location || { latitude: 0, longitude: 0 }) <= radius
            );
            radius += 1;
        }
        return erranders;
    }
}

module.exports = new ErrandService();