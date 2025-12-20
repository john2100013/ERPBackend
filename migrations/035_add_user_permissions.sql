-- Migration: Add user permissions columns
-- This adds permission columns to the users table to control access to different modules
-- Supports both local PostgreSQL and Neon databases

-- Add permission columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS can_access_analytics BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_business_settings BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_financial_accounts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_pos BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_advanced_package BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_salon BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_service_billing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_hospital BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_invoices BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_quotations BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_items BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_customers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_goods_returns BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_damage_tracking BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_signatures BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_database_settings BOOLEAN DEFAULT false;

-- Set default permissions for admin/owner roles (they should have all permissions)
UPDATE users 
SET 
  can_access_analytics = true,
  can_access_business_settings = true,
  can_access_financial_accounts = true,
  can_access_pos = true,
  can_access_advanced_package = true,
  can_access_salon = true,
  can_access_service_billing = true,
  can_access_hospital = true,
  can_access_invoices = true,
  can_access_quotations = true,
  can_access_items = true,
  can_access_customers = true,
  can_access_goods_returns = true,
  can_access_damage_tracking = true,
  can_access_signatures = true,
  can_access_database_settings = true
WHERE role IN ('admin', 'owner');

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_permissions ON users(
  can_access_analytics, 
  can_access_business_settings, 
  can_access_financial_accounts
);

