-- Add quotation_id column to invoices table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'quotation_id'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added quotation_id column to invoices table';
    ELSE
        RAISE NOTICE 'quotation_id column already exists in invoices table';
    END IF;
END $$;

-- Check the current structure of the invoices table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;