-- Migration: Alter quantity column from INTEGER to DECIMAL(10,3) to support fractional quantities
-- This allows quantities like 0.25, 0.5, 0.75, 1.25, 1.5, 1.75, etc.

-- Alter invoice_lines quantity column
DO $$
BEGIN
    -- Check if quantity column exists and is INTEGER
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_lines' 
        AND column_name = 'quantity'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE invoice_lines 
        ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
        RAISE NOTICE 'Altered invoice_lines.quantity from INTEGER to DECIMAL(10,3)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_lines' 
        AND column_name = 'quantity'
        AND data_type = 'numeric'
    ) THEN
        -- Column already exists as numeric/decimal, just ensure it's DECIMAL(10,3)
        ALTER TABLE invoice_lines 
        ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
        RAISE NOTICE 'Updated invoice_lines.quantity to DECIMAL(10,3)';
    ELSE
        RAISE NOTICE 'invoice_lines.quantity column does not exist or is already correct type';
    END IF;
END $$;

-- Alter quotation_lines quantity column
DO $$
BEGIN
    -- Check if quantity column exists and is INTEGER
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'quotation_lines' 
        AND column_name = 'quantity'
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE quotation_lines 
        ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
        RAISE NOTICE 'Altered quotation_lines.quantity from INTEGER to DECIMAL(10,3)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'quotation_lines' 
        AND column_name = 'quantity'
        AND data_type = 'numeric'
    ) THEN
        -- Column already exists as numeric/decimal, just ensure it's DECIMAL(10,3)
        ALTER TABLE quotation_lines 
        ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
        RAISE NOTICE 'Updated quotation_lines.quantity to DECIMAL(10,3)';
    ELSE
        RAISE NOTICE 'quotation_lines.quantity column does not exist or is already correct type';
    END IF;
END $$;

