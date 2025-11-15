-- Extend existing invoices table with additional fields if they don't exist
DO $$ 
BEGIN
    -- Add customer_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_name') THEN
        ALTER TABLE invoices ADD COLUMN customer_name VARCHAR(255);
    END IF;
    
    -- Add customer_address column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_address') THEN
        ALTER TABLE invoices ADD COLUMN customer_address TEXT;
    END IF;
    
    -- Add customer_pin column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_pin') THEN
        ALTER TABLE invoices ADD COLUMN customer_pin VARCHAR(50);
    END IF;
    
    -- Add vat_amount column if it doesn't exist (rename tax_amount)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'vat_amount') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tax_amount') THEN
            ALTER TABLE invoices RENAME COLUMN tax_amount TO vat_amount;
        ELSE
            ALTER TABLE invoices ADD COLUMN vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
        END IF;
    END IF;
    
    -- Add quotation_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'quotation_id') THEN
        ALTER TABLE invoices ADD COLUMN quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL;
    END IF;
    
    -- Add payment_terms column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_terms') THEN
        ALTER TABLE invoices ADD COLUMN payment_terms VARCHAR(255) DEFAULT 'Net 30 Days';
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'created_by') THEN
        ALTER TABLE invoices ADD COLUMN created_by INTEGER REFERENCES users(id);
    END IF;
END $$;

-- Extend existing quotations table with additional fields if they don't exist
DO $$ 
BEGIN
    -- Add customer_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'customer_name') THEN
        ALTER TABLE quotations ADD COLUMN customer_name VARCHAR(255);
    END IF;
    
    -- Add customer_address column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'customer_address') THEN
        ALTER TABLE quotations ADD COLUMN customer_address TEXT;
    END IF;
    
    -- Add customer_pin column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'customer_pin') THEN
        ALTER TABLE quotations ADD COLUMN customer_pin VARCHAR(50);
    END IF;
    
    -- Add vat_amount column if it doesn't exist (rename tax_amount)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'vat_amount') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'tax_amount') THEN
            ALTER TABLE quotations RENAME COLUMN tax_amount TO vat_amount;
        ELSE
            ALTER TABLE quotations ADD COLUMN vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
        END IF;
    END IF;
    
    -- Rename expiry_date to valid_until if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'expiry_date') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'valid_until') THEN
            ALTER TABLE quotations RENAME COLUMN expiry_date TO valid_until;
        END IF;
    END IF;
    
    -- Add valid_until column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'valid_until') THEN
        ALTER TABLE quotations ADD COLUMN valid_until DATE;
    END IF;
    
    -- Add converted_to_invoice_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'converted_to_invoice_id') THEN
        ALTER TABLE quotations ADD COLUMN converted_to_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'created_by') THEN
        ALTER TABLE quotations ADD COLUMN created_by INTEGER REFERENCES users(id);
    END IF;
END $$;

-- Create invoice_lines table (rename from invoice_items if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_lines') THEN
            ALTER TABLE invoice_items RENAME TO invoice_lines;
            -- Rename columns to match expected schema
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_lines' AND column_name = 'line_total') THEN
                ALTER TABLE invoice_lines RENAME COLUMN line_total TO total;
            END IF;
        END IF;
    ELSE
        CREATE TABLE IF NOT EXISTS invoice_lines (
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
    END IF;
END $$;

-- Create quotation_lines table (rename from quotation_items if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotation_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotation_lines') THEN
            ALTER TABLE quotation_items RENAME TO quotation_lines;
            -- Rename columns to match expected schema
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_lines' AND column_name = 'line_total') THEN
                ALTER TABLE quotation_lines RENAME COLUMN line_total TO total;
            END IF;
        END IF;
    ELSE
        CREATE TABLE IF NOT EXISTS quotation_lines (
            id SERIAL PRIMARY KEY,
            quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
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
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

CREATE INDEX IF NOT EXISTS idx_quotations_business_id ON quotations(business_id);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_number ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_valid_until ON quotations(valid_until);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_id ON invoice_lines(item_id);

CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation_id ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_item_id ON quotation_lines(item_id);

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(business_prefix VARCHAR(10))
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(i.invoice_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM invoices i
    WHERE i.invoice_number LIKE business_prefix || '%'
    AND LENGTH(i.invoice_number) = LENGTH(business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate quotation numbers
CREATE OR REPLACE FUNCTION generate_quotation_number(business_prefix VARCHAR(10))
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(q.quotation_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM quotations q
    WHERE q.quotation_number LIKE 'QT-' || business_prefix || '%'
    AND LENGTH(q.quotation_number) = LENGTH('QT-' || business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := 'QT-' || business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for all tables
CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotations_updated_at 
    BEFORE UPDATE ON quotations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_lines_updated_at 
    BEFORE UPDATE ON invoice_lines 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_lines_updated_at 
    BEFORE UPDATE ON quotation_lines 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();