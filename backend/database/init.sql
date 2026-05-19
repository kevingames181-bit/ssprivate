-- SeaScope Alaska Production Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table with 2-key authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'professional', 'enterprise')),
    api_calls_remaining INTEGER DEFAULT 1000,
    api_calls_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 month',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Fishery data table
CREATE TABLE IF NOT EXISTS fishery_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    city VARCHAR(100) NOT NULL,
    species VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    hatchery VARCHAR(255),
    release_type VARCHAR(50),
    water_temperature DECIMAL(5, 2),
    salinity DECIMAL(5, 2),
    notes TEXT,
    source VARCHAR(100) DEFAULT 'ADFG',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Weather cache table
CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    temperature INTEGER,
    feels_like INTEGER,
    conditions VARCHAR(50),
    description TEXT,
    wind_speed INTEGER,
    wind_direction VARCHAR(10),
    pressure DECIMAL(6, 2),
    humidity INTEGER,
    visibility INTEGER,
    cloud_cover INTEGER,
    moon_phase VARCHAR(50),
    moon_illumination INTEGER,
    sunrise VARCHAR(20),
    sunset VARCHAR(20),
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
    UNIQUE(city, date)
);

-- Tide cache table
CREATE TABLE IF NOT EXISTS tide_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    station_id VARCHAR(50),
    high_tide_1 VARCHAR(100),
    high_tide_2 VARCHAR(100),
    low_tide_1 VARCHAR(100),
    low_tide_2 VARCHAR(100),
    tide_range DECIMAL(5, 2),
    current_tide_height DECIMAL(5, 2),
    sunrise VARCHAR(20),
    sunset VARCHAR(20),
    cached_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
    UNIQUE(city, date)
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    event_data JSONB,
    page_url TEXT,
    referrer TEXT,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(50),
    os VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    plan_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_fishery_date ON fishery_data(date);
CREATE INDEX IF NOT EXISTS idx_fishery_city ON fishery_data(city);
CREATE INDEX IF NOT EXISTS idx_fishery_species ON fishery_data(species);
CREATE INDEX IF NOT EXISTS idx_fishery_date_city ON fishery_data(date, city);
CREATE INDEX IF NOT EXISTS idx_fishery_location ON fishery_data(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_weather_city_date ON weather_cache(city, date);
CREATE INDEX IF NOT EXISTS idx_weather_expires ON weather_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_tide_city_date ON tide_cache(city, date);
CREATE INDEX IF NOT EXISTS idx_tide_expires ON tide_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_usage_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fishery_updated_at BEFORE UPDATE ON fishery_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default Alaska cities data
INSERT INTO fishery_data (date, city, species, quantity, latitude, longitude, hatchery, release_type)
VALUES
    (CURRENT_DATE, 'Juneau', 'Chinook Salmon', 50000, 58.3019, -134.4197, 'Douglas Island Pink and Chum', 'Hatchery'),
    (CURRENT_DATE, 'Sitka', 'Coho Salmon', 75000, 57.0531, -135.3300, 'Medvejie Hatchery', 'Hatchery'),
    (CURRENT_DATE, 'Ketchikan', 'Pink Salmon', 120000, 55.3422, -131.6461, 'Whitman Lake Hatchery', 'Hatchery'),
    (CURRENT_DATE, 'Anchorage', 'Sockeye Salmon', 60000, 61.2181, -149.9003, 'Ship Creek Hatchery', 'Hatchery'),
    (CURRENT_DATE, 'Naknek', 'Chinook Salmon', 45000, 58.7333, -157.0000, 'Naknek River', 'Wild'),
    (CURRENT_DATE, 'Dutch Harbor', 'Halibut', 30000, 53.8833, -166.5333, 'Commercial Fishery', 'Wild'),
    (CURRENT_DATE, 'Whittier', 'Pink Salmon', 85000, 60.7744, -148.6850, 'Prince William Sound', 'Hatchery'),
    (CURRENT_DATE, 'Homer', 'Coho Salmon', 55000, 59.6425, -151.5483, 'Kachemak Bay', 'Wild')
ON CONFLICT DO NOTHING;

-- Create view for active subscriptions
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
    u.id as user_id,
    u.email,
    u.subscription_tier,
    s.stripe_subscription_id,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE s.status IN ('active', 'trialing') OR u.subscription_tier = 'free';

-- Create view for daily fishery statistics
CREATE OR REPLACE VIEW daily_fishery_stats AS
SELECT 
    date,
    city,
    species,
    SUM(quantity) as total_quantity,
    COUNT(*) as release_count,
    AVG(water_temperature) as avg_water_temp
FROM fishery_data
GROUP BY date, city, species
ORDER BY date DESC, city, species;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO seascope_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO seascope_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO seascope_user;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts with 2-key authentication system';
COMMENT ON TABLE fishery_data IS 'Fish release and catch data from Alaska hatcheries and fisheries';
COMMENT ON TABLE weather_cache IS 'Cached weather data from OpenWeatherMap API';
COMMENT ON TABLE tide_cache IS 'Cached tide data from NOAA API';
COMMENT ON TABLE analytics_events IS 'User behavior and application analytics events';
COMMENT ON TABLE api_usage_logs IS 'API endpoint usage tracking for rate limiting and billing';
COMMENT ON TABLE subscriptions IS 'Stripe subscription management';
