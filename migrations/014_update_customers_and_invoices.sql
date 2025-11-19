-- Migration: Update customers table and add payment fields to invoices/quotations

-- Add PIN and location to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS pin VARCHAR(50),
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add payment method and M-Pesa code to invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash',
ADD COLUMN IF NOT EXISTS mpesa_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;

-- Add payment method and M-Pesa code to quotations
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash',
ADD COLUMN IF NOT EXISTS mpesa_code VARCHAR(100);

-- Create index for customer PIN
CREATE INDEX IF NOT EXISTS idx_customers_pin ON customers(pin);
