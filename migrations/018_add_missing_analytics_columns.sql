-- Migration 018: Add missing columns for analytics
-- This migration adds columns that analytics queries need but might not exist

-- Add reorder_level to items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'reorder_level'
    ) THEN
        ALTER TABLE items ADD COLUMN reorder_level INTEGER DEFAULT 10;
        RAISE NOTICE 'Added reorder_level column to items table';
    END IF;
END $$;

-- Add cost_price to items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE items ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0;
        -- Copy from buying_price if it exists
        UPDATE items SET cost_price = buying_price WHERE cost_price = 0 AND buying_price > 0;
        RAISE NOTICE 'Added cost_price column to items table';
    END IF;
END $$;

-- Ensure invoice_lines table exists (might be named invoice_items)
DO $$
BEGIN
    -- Check if invoice_items exists but invoice_lines doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'invoice_items'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'invoice_lines'
    ) THEN
        ALTER TABLE invoice_items RENAME TO invoice_lines;
        RAISE NOTICE 'Renamed invoice_items to invoice_lines';
    END IF;
    
    -- If neither exists, create invoice_lines
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'invoice_lines'
    ) THEN
        CREATE TABLE invoice_lines (
            id SERIAL PRIMARY KEY,
            invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            item_id INTEGER REFERENCES items(id),
            quantity DECIMAL(10,3) NOT NULL,
            unit_price DECIMAL(12,2) NOT NULL,
            total DECIMAL(12,2) NOT NULL,
            description TEXT NOT NULL,
            code VARCHAR(100),
            uom VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Created invoice_lines table';
    END IF;
END $$;

-- Ensure invoice_lines has all required columns
DO $$
BEGIN
    -- Add code column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_lines' AND column_name = 'code'
    ) THEN
        ALTER TABLE invoice_lines ADD COLUMN code VARCHAR(100);
        RAISE NOTICE 'Added code column to invoice_lines';
    END IF;
    
    -- Add uom column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_lines' AND column_name = 'uom'
    ) THEN
        ALTER TABLE invoice_lines ADD COLUMN uom VARCHAR(20);
        RAISE NOTICE 'Added uom column to invoice_lines';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_id ON invoice_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_created_at ON invoice_lines(created_at);

-- Update existing items with default reorder_level if they don't have one
UPDATE items 
SET reorder_level = 10 
WHERE reorder_level IS NULL OR reorder_level = 0;

-- Update existing items with cost_price from buying_price if cost_price is 0
UPDATE items 
SET cost_price = buying_price 
WHERE (cost_price IS NULL OR cost_price = 0) AND buying_price > 0;

