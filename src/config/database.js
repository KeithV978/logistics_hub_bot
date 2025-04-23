const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop existing tables in correct order (respecting foreign key constraints)
    await client.query(`
      DROP TABLE IF EXISTS tracking_sessions CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS offers CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
    `);

    // Create PostGIS extension if it doesn't exist
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        full_name VARCHAR(100),
        email VARCHAR(255),
        phone_number VARCHAR(20),
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        account_name VARCHAR(100),
        default_address JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create users table for riders and erranders
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        role VARCHAR(10) NOT NULL CHECK (role IN ('rider', 'errander')),
        full_name VARCHAR(100),
        phone_number VARCHAR(20),
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        account_name VARCHAR(100),
        vehicle_type VARCHAR(50),
        nin VARCHAR(50),
        eligibility_slip_file_id TEXT,
        verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
        rating DECIMAL(3,2) DEFAULT 0,
        total_ratings INTEGER DEFAULT 0,
        location GEOGRAPHY(POINT),
        last_location_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`);

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        type VARCHAR(10) NOT NULL CHECK (type IN ('delivery', 'errand')),
        customer_telegram_id BIGINT NOT NULL,
        pickup_location JSONB,
        dropoff_location JSONB,
        errand_location JSONB,
        instructions TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        group_chat_id BIGINT
      );
    `);

    // Create offers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        user_id INTEGER REFERENCES users(id),
        price DECIMAL(10,2) NOT NULL,
        vehicle_type VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
    `);

    // Create reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        user_id INTEGER REFERENCES users(id),
        customer_telegram_id BIGINT NOT NULL,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create tracking_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_sessions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        user_id INTEGER REFERENCES users(id),
        current_location JSONB,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('Database tables dropped and recreated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recreating database tables:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Export database functions
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb
};