-- Migration 031: Add 'partially_paid' status to invoices table

-- Drop the existing status constraint if it exists
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Find the constraint name
    SELECT constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints
    WHERE table_name = 'invoices'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%status%'
    LIMIT 1;
    
    -- Drop the constraint if found
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        RAISE NOTICE 'Dropped existing status constraint: %', constraint_name_var;
    END IF;
END $$;

-- Add new constraint with 'partially_paid' status
DO $$
BEGIN
    -- Check if constraint already exists with the new values
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%status%'
        AND check_clause LIKE '%partially_paid%'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_status_check 
        CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'cancelled', 'overdue'));
        RAISE NOTICE 'Added status constraint with partially_paid status';
    ELSE
        RAISE NOTICE 'Status constraint with partially_paid already exists';
    END IF;
END $$;

