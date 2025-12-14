-- Migration: Fix schema mismatches with Neon database
-- Generated: 2025-12-14
-- Based on comprehensive schema validation

-- Fix bookings.booking_time: should be TIME WITHOUT TIME ZONE and nullable
DO $$
BEGIN
    -- Check current type and modify if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'booking_time'
        AND data_type != 'time without time zone'
    ) THEN
        ALTER TABLE bookings ALTER COLUMN booking_time TYPE TIME WITHOUT TIME ZONE;
        RAISE NOTICE 'Fixed bookings.booking_time type';
    END IF;
    
    -- Make nullable if it's NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'booking_time'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE bookings ALTER COLUMN booking_time DROP NOT NULL;
        RAISE NOTICE 'Made bookings.booking_time nullable';
    END IF;
END $$;

-- Fix businesses.status: should be VARCHAR(50) not VARCHAR(20)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' 
        AND column_name = 'status'
        AND character_maximum_length < 50
    ) THEN
        ALTER TABLE businesses ALTER COLUMN status TYPE VARCHAR(50);
        RAISE NOTICE 'Fixed businesses.status to VARCHAR(50)';
    END IF;
END $$;

-- Fix users.status: should be VARCHAR(50) not VARCHAR(20)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'status'
        AND character_maximum_length < 50
    ) THEN
        ALTER TABLE users ALTER COLUMN status TYPE VARCHAR(50);
        RAISE NOTICE 'Fixed users.status to VARCHAR(50)';
    END IF;
END $$;

-- Fix users.first_name: should be NOT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'first_name'
        AND is_nullable = 'YES'
    ) THEN
        -- First update any NULL values
        UPDATE users SET first_name = '' WHERE first_name IS NULL;
        ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
        RAISE NOTICE 'Made users.first_name NOT NULL';
    END IF;
END $$;

-- Fix users.last_name: should be NOT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_name'
        AND is_nullable = 'YES'
    ) THEN
        -- First update any NULL values
        UPDATE users SET last_name = '' WHERE last_name IS NULL;
        ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;
        RAISE NOTICE 'Made users.last_name NOT NULL';
    END IF;
END $$;

-- Fix damage_record_lines: created_at and updated_at should be TIMESTAMP not TIMESTAMP WITH TIME ZONE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'damage_record_lines' 
        AND column_name = 'created_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE damage_record_lines ALTER COLUMN created_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed damage_record_lines.created_at to TIMESTAMP';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'damage_record_lines' 
        AND column_name = 'updated_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE damage_record_lines ALTER COLUMN updated_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed damage_record_lines.updated_at to TIMESTAMP';
    END IF;
END $$;

-- Fix damage_records: created_at and updated_at should be TIMESTAMP not TIMESTAMP WITH TIME ZONE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'damage_records' 
        AND column_name = 'created_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE damage_records ALTER COLUMN created_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed damage_records.created_at to TIMESTAMP';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'damage_records' 
        AND column_name = 'updated_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE damage_records ALTER COLUMN updated_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed damage_records.updated_at to TIMESTAMP';
    END IF;
END $$;

-- Fix financial_accounts: created_at and updated_at should be TIMESTAMP not TIMESTAMP WITH TIME ZONE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'financial_accounts' 
        AND column_name = 'created_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE financial_accounts ALTER COLUMN created_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed financial_accounts.created_at to TIMESTAMP';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'financial_accounts' 
        AND column_name = 'updated_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE financial_accounts ALTER COLUMN updated_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed financial_accounts.updated_at to TIMESTAMP';
    END IF;
END $$;

-- Fix goods_return_lines: created_at and updated_at should be TIMESTAMP not TIMESTAMP WITH TIME ZONE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'goods_return_lines' 
        AND column_name = 'created_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE goods_return_lines ALTER COLUMN created_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed goods_return_lines.created_at to TIMESTAMP';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'goods_return_lines' 
        AND column_name = 'updated_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE goods_return_lines ALTER COLUMN updated_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed goods_return_lines.updated_at to TIMESTAMP';
    END IF;
END $$;

-- Fix goods_returns: created_at and updated_at should be TIMESTAMP not TIMESTAMP WITH TIME ZONE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'goods_returns' 
        AND column_name = 'created_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE goods_returns ALTER COLUMN created_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed goods_returns.created_at to TIMESTAMP';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'goods_returns' 
        AND column_name = 'updated_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE goods_returns ALTER COLUMN updated_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed goods_returns.updated_at to TIMESTAMP';
    END IF;
END $$;

-- Fix invoice_payments: created_at and updated_at should be TIMESTAMP not TIMESTAMP WITH TIME ZONE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_payments' 
        AND column_name = 'created_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE invoice_payments ALTER COLUMN created_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed invoice_payments.created_at to TIMESTAMP';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_payments' 
        AND column_name = 'updated_at'
        AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE invoice_payments ALTER COLUMN updated_at TYPE TIMESTAMP;
        RAISE NOTICE 'Fixed invoice_payments.updated_at to TIMESTAMP';
    END IF;
END $$;

-- Fix schema_migrations: executed_at should be TIMESTAMP WITH TIME ZONE (keep as is, but ensure it matches)
-- Actually, looking at schema.sql, it shows TIMESTAMP WITH TIME ZONE, so local is correct
-- But validation shows mismatch - let me check the schema.sql again
-- The schema.sql shows: executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- So local should keep it as TIMESTAMP WITH TIME ZONE, but validation might be wrong
-- Let's leave this one as is for now

