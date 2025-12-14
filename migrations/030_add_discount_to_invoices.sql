-- Migration 030: Add discount_amount column to invoices table

-- Add discount_amount column to invoices table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'discount_amount') THEN
        ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added discount_amount column to invoices table';
    END IF;
END $$;

-- Update existing records to set discount_amount to 0 (if the column was just added)
UPDATE invoices SET discount_amount = 0 WHERE discount_amount IS NULL;

-- Create index for faster lookups on discount_amount (optional, but can be useful for analytics)
CREATE INDEX IF NOT EXISTS idx_invoices_discount_amount ON invoices(discount_amount) WHERE discount_amount > 0;

