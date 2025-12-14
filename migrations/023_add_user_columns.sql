-- Migration: Add missing columns to users table
-- This ensures users table has all columns needed by the application
-- Safe for Neon database - uses IF NOT EXISTS

-- Add first_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
        RAISE NOTICE 'Added first_name column to users table';
    END IF;
END $$;

-- Add last_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(255);
        RAISE NOTICE 'Added last_name column to users table';
    END IF;
END $$;

-- Add role column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
        RAISE NOTICE 'Added role column to users table';
    END IF;
END $$;

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'suspended'));
        RAISE NOTICE 'Added status column to users table';
    END IF;
END $$;

-- Handle password_hash column
DO $$
BEGIN
    -- Check if password_hash exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        -- If password column exists, rename it to password_hash
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password'
        ) THEN
            ALTER TABLE users RENAME COLUMN password TO password_hash;
            RAISE NOTICE 'Renamed password column to password_hash in users table';
        ELSE
            -- If neither exists, add password_hash
            ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
            RAISE NOTICE 'Added password_hash column to users table';
        END IF;
    END IF;
END $$;

-- Update existing users to have 'active' status if status is NULL
UPDATE users 
SET status = 'active' 
WHERE status IS NULL;

-- Update existing users to have 'owner' role if role is NULL and they have a business
UPDATE users 
SET role = 'owner' 
WHERE role IS NULL AND business_id IS NOT NULL;

