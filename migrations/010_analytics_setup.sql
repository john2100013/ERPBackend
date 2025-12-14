-- Migration: Add analytics-related tables and missing columns
-- File: 010_analytics_setup.sql

BEGIN;

-- Check if quotations table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quotations') THEN
        CREATE TABLE quotations (
            id SERIAL PRIMARY KEY,
            business_id INTEGER REFERENCES businesses(id),
            quotation_number VARCHAR(50) NOT NULL UNIQUE,
            customer_id INTEGER,
            customer_name VARCHAR(255) NOT NULL,
            customer_address TEXT,
            customer_pin VARCHAR(20),
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
            vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending',
            valid_until DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
            notes TEXT,
            created_by INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add quotation lines table
        CREATE TABLE quotation_lines (
            id SERIAL PRIMARY KEY,
            quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
            item_id INTEGER,
            item_name VARCHAR(255) NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            vat_rate DECIMAL(5,2) DEFAULT 0,
            total_price DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE 'Created quotations and quotation_lines tables';
    END IF;
END
$$;

-- Check if stock_transactions table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transactions') THEN
        CREATE TABLE stock_transactions (
            id SERIAL PRIMARY KEY,
            item_id INTEGER REFERENCES items(id),
            transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('in', 'out')),
            quantity INTEGER NOT NULL,
            reference_type VARCHAR(50), -- 'invoice', 'purchase', 'return', 'damage', 'adjustment'
            reference_id INTEGER,
            notes TEXT,
            created_by INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_stock_transactions_item_id ON stock_transactions(item_id);
        CREATE INDEX idx_stock_transactions_type ON stock_transactions(transaction_type);
        CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at);
        
        RAISE NOTICE 'Created stock_transactions table';
    END IF;
END
$$;

-- Add missing columns to items table if they don't exist
DO $$
BEGIN
    -- Add cost_price column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'cost_price') THEN
        ALTER TABLE items ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added cost_price column to items table';
    END IF;
    
    -- Add reorder_level column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'reorder_level') THEN
        ALTER TABLE items ADD COLUMN reorder_level INTEGER DEFAULT 0;
        RAISE NOTICE 'Added reorder_level column to items table';
    END IF;
END
$$;

-- Add missing columns to invoices table if they don't exist
DO $$
BEGIN
    -- Add customer_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_id') THEN
        ALTER TABLE invoices ADD COLUMN customer_id INTEGER;
        RAISE NOTICE 'Added customer_id column to invoices table';
    END IF;
END
$$;

-- Check if customers table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers') THEN
        CREATE TABLE customers (
            id SERIAL PRIMARY KEY,
            business_id INTEGER REFERENCES businesses(id),
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(20),
            address TEXT,
            pin_number VARCHAR(20),
            created_by INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_customers_business_id ON customers(business_id);
        CREATE INDEX idx_customers_email ON customers(email);
        
        RAISE NOTICE 'Created customers table';
    END IF;
END
$$;

-- Sample data insertion skipped for production deployment
-- Users will create their own data through the application

-- Update items with sample cost prices and reorder levels if they're zero
UPDATE items 
SET 
    cost_price = CASE 
        WHEN cost_price = 0 OR cost_price IS NULL THEN 
            COALESCE(buying_price, selling_price * 0.6, price * 0.6) 
        ELSE cost_price 
    END,
    reorder_level = CASE 
        WHEN reorder_level = 0 OR reorder_level IS NULL THEN 
            GREATEST(5, COALESCE(quantity, 10) / 4) 
        ELSE reorder_level 
    END
WHERE cost_price = 0 OR cost_price IS NULL OR reorder_level = 0 OR reorder_level IS NULL;

-- Insert some sample stock transactions if table is empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM stock_transactions LIMIT 1) THEN
        -- Insert inward transactions (stock in)
        INSERT INTO stock_transactions (item_id, transaction_type, quantity, reference_type, created_at)
        SELECT 
            i.id,
            'in',
            (50 + (random() * 100)::int),
            'purchase',
            CURRENT_TIMESTAMP - (random() * 90 || ' days')::interval
        FROM items i
        ORDER BY random()
        LIMIT 30;
        
        -- Insert outward transactions (stock out)
        INSERT INTO stock_transactions (item_id, transaction_type, quantity, reference_type, created_at)
        SELECT 
            i.id,
            'out',
            (10 + (random() * 30)::int),
            'invoice',
            CURRENT_TIMESTAMP - (random() * 60 || ' days')::interval
        FROM items i
        ORDER BY random()
        LIMIT 50;
        
        RAISE NOTICE 'Inserted sample stock transactions';
    END IF;
END
$$;

COMMIT;

-- Final notification
SELECT 'Analytics setup migration completed successfully!' as status;