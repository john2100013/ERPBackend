-- Migration: Add missing columns to businesses table
-- This ensures businesses table has all columns needed by the application
-- Safe for Neon database - uses IF NOT EXISTS

-- Add email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'email'
    ) THEN
        ALTER TABLE businesses ADD COLUMN email VARCHAR(255);
        RAISE NOTICE 'Added email column to businesses table';
    END IF;
END $$;

-- Add phone column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'phone'
    ) THEN
        ALTER TABLE businesses ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'Added phone column to businesses table';
    END IF;
END $$;

-- Add address column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'address'
    ) THEN
        ALTER TABLE businesses ADD COLUMN address TEXT;
        RAISE NOTICE 'Added address column to businesses table';
    END IF;
END $$;

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'status'
    ) THEN
        ALTER TABLE businesses ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'suspended'));
        RAISE NOTICE 'Added status column to businesses table';
    END IF;
END $$;

-- Update existing businesses to have 'active' status if status is NULL
UPDATE businesses 
SET status = 'active' 
WHERE status IS NULL;

