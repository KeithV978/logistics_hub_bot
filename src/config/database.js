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

    // Create customers table with indexes
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
      CREATE INDEX IF NOT EXISTS idx_customers_telegram_id ON customers(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    `);

    // Create users table with indexes
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
        verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'pending_manual', 'verified', 'rejected')),
        rating DECIMAL(3,2) DEFAULT 0,
        total_ratings INTEGER DEFAULT 0,
        location GEOGRAPHY(POINT),
        last_location_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_role_verification ON users(role, verification_status);
      CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
      CREATE INDEX IF NOT EXISTS idx_users_last_location_update ON users(last_location_update);
    `);

    // Create orders table with indexes
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
        group_chat_id BIGINT,
        FOREIGN KEY (customer_telegram_id) REFERENCES customers(telegram_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_telegram_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);
    `);

    // Create offers table with indexes
    await client.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        price DECIMAL(10,2) NOT NULL,
        vehicle_type VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_offers_order ON offers(order_id);
      CREATE INDEX IF NOT EXISTS idx_offers_user ON offers(user_id);
      CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
      CREATE INDEX IF NOT EXISTS idx_offers_expires_at ON offers(expires_at);
    `);

    // Create reviews table with indexes
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        customer_telegram_id BIGINT NOT NULL REFERENCES customers(telegram_id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_telegram_id);
    `);

    // Create tracking_sessions table with indexes
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_sessions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        current_location JSONB,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
        last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tracking_order ON tracking_sessions(order_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_user ON tracking_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_status ON tracking_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_tracking_last_update ON tracking_sessions(last_update);
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database tables:', err);
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