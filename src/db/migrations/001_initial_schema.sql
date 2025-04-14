-- Create enum types
CREATE TYPE user_role AS ENUM ('user', 'rider', 'errander', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'active', 'rejected');
CREATE TYPE order_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled', 'disputed');

-- Create extension for geolocation queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (base table for all user types)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    role user_role NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Riders table
CREATE TABLE riders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    document_url TEXT,
    current_location GEOGRAPHY(POINT),
    average_rating DECIMAL(3,2) DEFAULT 0.0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Erranders table
CREATE TABLE erranders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    document_url TEXT,
    current_location GEOGRAPHY(POINT),
    average_rating DECIMAL(3,2) DEFAULT 0.0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rider_id INTEGER REFERENCES riders(id),
    pickup_location GEOGRAPHY(POINT) NOT NULL,
    dropoff_location GEOGRAPHY(POINT) NOT NULL,
    item_description TEXT,
    delivery_instructions TEXT,
    status order_status DEFAULT 'open',
    group_chat_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Errands table
CREATE TABLE errands (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    errander_id INTEGER REFERENCES erranders(id),
    location GEOGRAPHY(POINT) NOT NULL,
    task_description TEXT NOT NULL,
    budget DECIMAL(10,2),
    deadline TIMESTAMP WITH TIME ZONE,
    additional_instructions TEXT,
    status order_status DEFAULT 'open',
    group_chat_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Offers table
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    errand_id INTEGER REFERENCES errands(id),
    provider_id INTEGER REFERENCES users(id),
    price DECIMAL(10,2) NOT NULL,
    estimated_time INTEGER, -- in minutes
    status order_status DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (order_id IS NOT NULL OR errand_id IS NOT NULL)
);

-- Reviews table
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INTEGER REFERENCES users(id),
    reviewed_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    errand_id INTEGER REFERENCES errands(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (order_id IS NOT NULL OR errand_id IS NOT NULL)
);

-- Create indexes for better query performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_riders_location ON riders USING GIST(current_location);
CREATE INDEX idx_erranders_location ON erranders USING GIST(current_location);
CREATE INDEX idx_orders_locations ON orders USING GIST(pickup_location, dropoff_location);
CREATE INDEX idx_errands_location ON errands USING GIST(location);
CREATE INDEX idx_offers_order_id ON offers(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_offers_errand_id ON offers(errand_id) WHERE errand_id IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_riders_updated_at
    BEFORE UPDATE ON riders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_erranders_updated_at
    BEFORE UPDATE ON erranders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_errands_updated_at
    BEFORE UPDATE ON errands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();