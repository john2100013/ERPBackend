-- Migration: Make username nullable in users table
-- This matches the Neon database structure where username is optional
-- Safe for Neon database - only modifies constraint if needed

DO $$
BEGIN
    -- Check if username column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'username' 
        AND is_nullable = 'NO'
    ) THEN
        -- Make username nullable
        ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
        RAISE NOTICE 'Made username column nullable in users table';
    END IF;
END $$;

