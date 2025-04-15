const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const initDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                telegram_id BIGINT PRIMARY KEY,
                role VARCHAR(20) CHECK (role IN ('customer', 'rider', 'errander')),
                full_name VARCHAR(100),
                phone VARCHAR(20),
                bank_details JSONB,
                photo_url VARCHAR(255),
                nin VARCHAR(20),
                verification_status VARCHAR(20) DEFAULT 'pending',
                rating FLOAT DEFAULT 0,
                review_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_id BIGINT,
                pickup_location JSONB,
                dropoff_location JSONB,
                instructions TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS errands (
                id SERIAL PRIMARY KEY,
                customer_id BIGINT,
                location JSONB,
                details TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS offers (
                id SERIAL PRIMARY KEY,
                order_id INTEGER,
                errand_id INTEGER,
                rider_id BIGINT,
                price FLOAT,
                vehicle_type VARCHAR(50),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tracking_sessions (
                id SERIAL PRIMARY KEY,
                order_id INTEGER,
                errand_id INTEGER,
                rider_id BIGINT,
                location JSONB,
                status VARCHAR(20) DEFAULT 'active',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id BIGINT,
                reviewer_id BIGINT,
                rating INTEGER CHECK (rating BETWEEN 1 AND 5),
                review_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
};

module.exports = { pool, initDatabase };