-- Migration: Fix invoices table - add missing columns
-- This migration ensures all required columns exist in the invoices table

-- Add missing columns one by one with IF NOT EXISTS checks
DO $$ 
BEGIN
    -- Add quotation_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'quotation_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN quotation_id INTEGER;
        RAISE NOTICE 'Added quotation_id column to invoices table';
    END IF;

    -- Add notes column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'notes'
    ) THEN
        ALTER TABLE invoices ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to invoices table';
    END IF;

    -- Add due_date column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE invoices ADD COLUMN due_date DATE;
        RAISE NOTICE 'Added due_date column to invoices table';
    END IF;

    -- Add payment_terms column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'payment_terms'
    ) THEN
        ALTER TABLE invoices ADD COLUMN payment_terms VARCHAR(255) DEFAULT 'Net 30 Days';
        RAISE NOTICE 'Added payment_terms column to invoices table';
    END IF;

    -- Add customer_address column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'customer_address'
    ) THEN
        ALTER TABLE invoices ADD COLUMN customer_address TEXT;
        RAISE NOTICE 'Added customer_address column to invoices table';
    END IF;

    -- Add customer_pin column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'customer_pin'
    ) THEN
        ALTER TABLE invoices ADD COLUMN customer_pin VARCHAR(50);
        RAISE NOTICE 'Added customer_pin column to invoices table';
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'status'
    ) THEN
        ALTER TABLE invoices ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue'));
        RAISE NOTICE 'Added status column to invoices table';
    END IF;

    -- Add timestamps if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE invoices ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added created_at column to invoices table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to invoices table';
    END IF;

    -- Add foreign key constraints if they don't exist
    -- Check if quotation_id foreign key exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_quotation_id_fkey' AND table_name = 'invoices'
    ) THEN
        -- First ensure quotations table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotations') THEN
            ALTER TABLE invoices ADD CONSTRAINT invoices_quotation_id_fkey 
            FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added foreign key constraint for quotation_id';
        END IF;
    END IF;

END $$;

-- Show the current structure of invoices table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;