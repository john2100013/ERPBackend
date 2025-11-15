-- Migration: Fix invoices table schema
-- Add quotation_id column to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS quotation_id INTEGER;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    -- Only add the foreign key if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_quotation_id_fkey'
        AND table_name = 'invoices'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_quotation_id_fkey 
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;
    END IF;
END $$;