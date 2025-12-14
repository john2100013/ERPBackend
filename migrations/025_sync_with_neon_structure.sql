-- Migration: Sync local database structure with Neon database
-- This migration removes columns that don't exist in Neon DB
-- Based on schema comparison and sample data from Neon

-- Remove username column from users table if it exists (Neon doesn't have it)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'username'
    ) THEN
        ALTER TABLE users DROP COLUMN username;
        RAISE NOTICE 'Dropped username column from users table';
    END IF;
END $$;

-- Remove owner_id column from businesses table if it exists (Neon doesn't have it)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' 
        AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE businesses DROP COLUMN owner_id;
        RAISE NOTICE 'Dropped owner_id column from businesses table';
    END IF;
END $$;

-- Remove created_at column from invoice_lines if it exists (Neon doesn't have it based on sample data)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_lines' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE invoice_lines DROP COLUMN created_at;
        RAISE NOTICE 'Dropped created_at column from invoice_lines table';
    END IF;
END $$;

-- Ensure users table has all required columns from Neon structure
-- Based on sample data: id, business_id, email, first_name, last_name, password_hash, role, status, created_at, updated_at
DO $$
BEGIN
    -- Add business_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'business_id'
    ) THEN
        ALTER TABLE users ADD COLUMN business_id INTEGER REFERENCES businesses(id);
        RAISE NOTICE 'Added business_id column to users table';
    END IF;
    
    -- Ensure first_name exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
        RAISE NOTICE 'Added first_name column to users table';
    END IF;
    
    -- Ensure last_name exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(255);
        RAISE NOTICE 'Added last_name column to users table';
    END IF;
    
    -- Ensure role exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'owner';
        RAISE NOTICE 'Added role column to users table';
    END IF;
    
    -- Ensure status exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
        RAISE NOTICE 'Added status column to users table';
    END IF;
END $$;

-- Ensure businesses table has all required columns from Neon structure
-- Based on sample data and previous migrations, businesses should have: id, name, email, phone, address, website, logo_url, tax_number, status, created_at, updated_at
-- Note: owner_id is NOT in Neon, so we don't add it

-- Ensure invoice_lines table structure matches Neon
-- Based on sample data, invoice_lines should have: id, invoice_id, service_id, employee_id, service_name, duration, price, amount, created_at
-- But wait, the error said created_at doesn't exist in invoice_lines in Neon
-- Let's check the sample data provided - it shows created_at in service_invoice_items, not invoice_lines
-- So invoice_lines should NOT have created_at

