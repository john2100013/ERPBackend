-- Migration: Create business_settings table
-- This table stores business information and signatures for each business

CREATE TABLE IF NOT EXISTS business_settings (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    street VARCHAR(255),
    city VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    telephone VARCHAR(50) NOT NULL,
    created_by VARCHAR(255),
    approved_by VARCHAR(255),
    created_by_signature TEXT, -- Base64 encoded image
    approved_by_signature TEXT, -- Base64 encoded image
    logo TEXT, -- Base64 encoded image
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one settings record per business
    UNIQUE(business_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_settings_business_id ON business_settings(business_id);

-- Add trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_business_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_settings_updated_at
    BEFORE UPDATE ON business_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_business_settings_updated_at();