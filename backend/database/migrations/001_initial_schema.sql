-- Migration: 001_initial_schema
-- Description: Initial database schema for SeaScope Alaska
-- Date: 2026-02-18

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    api_calls_remaining INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Fishery data table
CREATE TABLE fishery_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    city VARCHAR(100) NOT NULL,
    species VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    hatchery VARCHAR(255),
    release_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Weather cache table
CREATE TABLE weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    temperature INTEGER,
    conditions VARCHAR(50),
    wind_speed INTEGER,
    pressure DECIMAL(6, 2),
    cached_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(city, date)
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_fishery_date ON fishery_data(date);
CREATE INDEX idx_fishery_city ON fishery_data(city);
CREATE INDEX idx_weather_city_date ON weather_cache(city, date);

COMMIT;
