-- Migration: Add PIN column to business_settings table
-- This adds a PIN field for business tax identification

ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS pin VARCHAR(50);

COMMENT ON COLUMN business_settings.pin IS 'Business tax identification PIN number';

