-- Users table (for riders and erranders)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    bank_details TEXT NOT NULL,
    photograph_url TEXT,
    nin VARCHAR(20) NOT NULL,
    role VARCHAR(10) CHECK (role IN ('rider', 'errander')),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    rating DECIMAL(2,1) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table (logistics)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_telegram_id VARCHAR(50) NOT NULL,
    pickup_location TEXT NOT NULL,
    drop_off_location TEXT NOT NULL,
    instructions TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'offered', 'accepted', 'in_progress', 'completed', 'expired')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Errands table
CREATE TABLE errands (
    id SERIAL PRIMARY KEY,
    customer_telegram_id VARCHAR(50) NOT NULL,
    location TEXT NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'offered', 'accepted', 'in_progress', 'completed', 'expired')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Offers table
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    errand_id INT REFERENCES errands(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    vehicle_type VARCHAR(20), -- For riders only
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT check_order_or_errand CHECK ((order_id IS NOT NULL AND errand_id IS NULL) OR (order_id IS NULL AND errand_id IS NOT NULL))
);

-- Transactions table (for tracking and live sessions)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    offer_id INT REFERENCES offers(id) NOT NULL,
    group_chat_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    payment_confirmed BOOLEAN DEFAULT FALSE,
    delivery_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    transaction_id INT REFERENCES transactions(id) NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);