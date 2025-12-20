-- Migration 036: Add actual_amount_received and change_given columns to invoices table

-- Add actual_amount_received column to invoices table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'actual_amount_received') THEN
        ALTER TABLE invoices ADD COLUMN actual_amount_received DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added actual_amount_received column to invoices table';
    END IF;
END $$;

-- Add change_given column to invoices table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'change_given') THEN
        ALTER TABLE invoices ADD COLUMN change_given DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added change_given column to invoices table';
    END IF;
END $$;

-- Calculate and update existing records
-- actual_amount_received = LEAST(total_amount, amount_paid)
-- change_given = GREATEST(0, amount_paid - total_amount)
UPDATE invoices 
SET 
    actual_amount_received = LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0)),
    change_given = GREATEST(0, COALESCE(amount_paid, 0) - COALESCE(total_amount, 0))
WHERE actual_amount_received IS NULL OR change_given IS NULL;

-- Set default values for NULL records
UPDATE invoices SET actual_amount_received = 0 WHERE actual_amount_received IS NULL;
UPDATE invoices SET change_given = 0 WHERE change_given IS NULL;

