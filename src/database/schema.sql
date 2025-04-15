-- Create tables for the logistics and errand service bot

-- Riders (delivery personnel)
CREATE TABLE riders (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  bank_account_details TEXT,
  photo_file_id VARCHAR(255),
  nin VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(50) DEFAULT 'PENDING',
  verification_notes TEXT,
  rating DECIMAL(3,2) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Rider vehicles
CREATE TABLE rider_vehicles (
  id SERIAL PRIMARY KEY,
  rider_id BIGINT NOT NULL REFERENCES riders(telegram_id),
  vehicle_type VARCHAR(50) NOT NULL,
  vehicle_details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Erranders (errand runners)
CREATE TABLE erranders (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  bank_account_details TEXT,
  photo_file_id VARCHAR(255),
  nin VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(50) DEFAULT 'PENDING',
  verification_notes TEXT,
  rating DECIMAL(3,2) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders (logistics requests)
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  pickup_location_text TEXT,
  pickup_latitude DECIMAL(10,7),
  pickup_longitude DECIMAL(10,7),
  dropoff_location_text TEXT,
  dropoff_latitude DECIMAL(10,7),
  dropoff_longitude DECIMAL(10,7),
  delivery_instructions TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  assigned_rider_id BIGINT,
  payment_received BOOLEAN DEFAULT FALSE,
  delivery_successful BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Errands (errand requests)
CREATE TABLE errands (
  id SERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  errand_location_text TEXT,
  errand_latitude DECIMAL(10,7),
  errand_longitude DECIMAL(10,7),
  errand_details TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  assigned_errander_id BIGINT,
  payment_received BOOLEAN DEFAULT FALSE,
  delivery_successful BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Offers (from riders and erranders)
CREATE TABLE offers (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  provider_id BIGINT NOT NULL,
  job_type VARCHAR(10) NOT NULL,  -- 'order' or 'errand'
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat groups
CREATE TABLE chat_groups (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  job_type VARCHAR(10) NOT NULL,
  group_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Location tracking
CREATE TABLE location_tracking (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  job_type VARCHAR(10) NOT NULL,
  provider_id BIGINT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  is_live BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ratings and reviews
CREATE TABLE ratings (
  id SERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  job_id INTEGER NOT NULL,
  job_type VARCHAR(10) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_riders_telegram_id ON riders(telegram_id);
CREATE INDEX idx_erranders_telegram_id ON erranders(telegram_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_errands_customer_id ON errands(customer_id);
CREATE INDEX idx_offers_job_id_type ON offers(job_id, job_type);
CREATE INDEX idx_chat_groups_group_id ON chat_groups(group_id);
CREATE INDEX idx_location_tracking_job_id_type ON location_tracking(job_id, job_type);
CREATE INDEX idx_ratings_provider_id ON ratings(provider_id);