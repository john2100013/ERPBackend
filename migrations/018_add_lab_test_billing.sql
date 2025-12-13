-- Migration to add billing fields to lab_tests table
-- This allows lab tests to be billed through pharmacy similar to prescriptions

ALTER TABLE lab_tests 
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS others TEXT,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partially_paid')),
ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pharmacy_served BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS served_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS served_at TIMESTAMP;

-- Create index for payment status
CREATE INDEX IF NOT EXISTS idx_lab_tests_payment_status ON lab_tests(payment_status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_pharmacy_served ON lab_tests(pharmacy_served);

