-- Migration 030: Add discount column to invoices table

-- Add discount column to invoices table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'discount') THEN
        ALTER TABLE invoices ADD COLUMN discount DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added discount column to invoices table';
    END IF;
END $$;

-- Update existing records to set discount to 0 (if the column was just added)
UPDATE invoices SET discount = 0 WHERE discount IS NULL;

-- Create index for faster lookups on discount (optional, but can be useful for analytics)
CREATE INDEX IF NOT EXISTS idx_invoices_discount ON invoices(discount) WHERE discount > 0;

