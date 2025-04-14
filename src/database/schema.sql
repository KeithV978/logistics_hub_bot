-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_type AS ENUM ('rider', 'errander');
CREATE TYPE verification_status AS ENUM ('pending', 'active', 'rejected');
CREATE TYPE transaction_status AS ENUM ('pending', 'in_progress', 'completed', 'disputed', 'cancelled');

-- Users table (both riders and erranders)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    user_type user_type NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    bank_account_number VARCHAR(255),
    bank_name VARCHAR(255),
    verification_status verification_status DEFAULT 'pending',
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User locations table (for real-time tracking)
CREATE TABLE user_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table (for delivery requests)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_telegram_id BIGINT NOT NULL,
    rider_id UUID REFERENCES users(id),
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    dropoff_latitude DECIMAL(10, 8) NOT NULL,
    dropoff_longitude DECIMAL(11, 8) NOT NULL,
    item_description TEXT,
    delivery_instructions TEXT,
    status transaction_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Errands table
CREATE TABLE errands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_telegram_id BIGINT NOT NULL,
    errander_id UUID REFERENCES users(id),
    location_latitude DECIMAL(10, 8) NOT NULL,
    location_longitude DECIMAL(11, 8) NOT NULL,
    task_description TEXT NOT NULL,
    budget DECIMAL(10, 2),
    deadline TIMESTAMP WITH TIME ZONE,
    additional_instructions TEXT,
    status transaction_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Offers table (for both orders and errands)
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id),
    errand_id UUID REFERENCES errands(id),
    price DECIMAL(10, 2) NOT NULL,
    estimated_time_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_or_errand_check CHECK (
        (order_id IS NOT NULL AND errand_id IS NULL) OR
        (order_id IS NULL AND errand_id IS NOT NULL)
    )
);

-- Ratings table
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id),
    errand_id UUID REFERENCES errands(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_or_errand_rating_check CHECK (
        (order_id IS NOT NULL AND errand_id IS NULL) OR
        (order_id IS NULL AND errand_id IS NOT NULL)
    )
);

-- Disputes table
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    errand_id UUID REFERENCES errands(id),
    created_by_telegram_id BIGINT NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_or_errand_dispute_check CHECK (
        (order_id IS NOT NULL AND errand_id IS NULL) OR
        (order_id IS NULL AND errand_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX idx_orders_customer_telegram_id ON orders(customer_telegram_id);
CREATE INDEX idx_orders_rider_id ON orders(rider_id);
CREATE INDEX idx_errands_customer_telegram_id ON errands(customer_telegram_id);
CREATE INDEX idx_errands_errander_id ON errands(errander_id);
CREATE INDEX idx_offers_user_id ON offers(user_id);
CREATE INDEX idx_offers_order_id ON offers(order_id);
CREATE INDEX idx_offers_errand_id ON offers(errand_id);
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
CREATE INDEX idx_disputes_order_id ON disputes(order_id);
CREATE INDEX idx_disputes_errand_id ON disputes(errand_id);

-- Trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
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