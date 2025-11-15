-- Migration: Add comprehensive business features
-- This migration adds payment tracking, financial accounts, buying/selling prices, and goods returns

-- Add financial accounts table
CREATE TABLE IF NOT EXISTS financial_accounts (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('cash', 'bank', 'mobile_money')),
    account_number VARCHAR(100),
    bank_name VARCHAR(255),
    opening_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add buying_price and selling_price to items table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'buying_price'
    ) THEN
        ALTER TABLE items ADD COLUMN buying_price DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added buying_price column to items table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'selling_price'
    ) THEN
        ALTER TABLE items ADD COLUMN selling_price DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added selling_price column to items table';
    END IF;
END $$;

-- Add payment tracking columns to invoices table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'amount_paid'
    ) THEN
        ALTER TABLE invoices ADD COLUMN amount_paid DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added amount_paid column to invoices table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'balance_due'
    ) THEN
        ALTER TABLE invoices ADD COLUMN balance_due DECIMAL(12,2) DEFAULT 0;
        RAISE NOTICE 'Added balance_due column to invoices table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE invoices ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid' 
        CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overpaid'));
        RAISE NOTICE 'Added payment_status column to invoices table';
    END IF;
END $$;

-- Create invoice payments table for tracking multiple payments
CREATE TABLE IF NOT EXISTS invoice_payments (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    financial_account_id INTEGER NOT NULL REFERENCES financial_accounts(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank', 'mobile_money', 'cheque', 'card')),
    payment_reference VARCHAR(255),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create goods returns table
CREATE TABLE IF NOT EXISTS goods_returns (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    refund_amount DECIMAL(12,2) DEFAULT 0,
    refund_method VARCHAR(50) CHECK (refund_method IN ('cash', 'bank', 'mobile_money', 'credit_note')),
    financial_account_id INTEGER REFERENCES financial_accounts(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
    reason TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create goods return lines table
CREATE TABLE IF NOT EXISTS goods_return_lines (
    id SERIAL PRIMARY KEY,
    return_id INTEGER NOT NULL REFERENCES goods_returns(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    code VARCHAR(100) NOT NULL,
    uom VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_financial_accounts_business_id ON financial_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON financial_accounts(account_type);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_financial_account_id ON invoice_payments(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_business_id ON invoice_payments(business_id);

CREATE INDEX IF NOT EXISTS idx_goods_returns_business_id ON goods_returns(business_id);
CREATE INDEX IF NOT EXISTS idx_goods_returns_invoice_id ON goods_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_goods_returns_return_number ON goods_returns(return_number);

CREATE INDEX IF NOT EXISTS idx_goods_return_lines_return_id ON goods_return_lines(return_id);
CREATE INDEX IF NOT EXISTS idx_goods_return_lines_item_id ON goods_return_lines(item_id);

-- Create function to generate return numbers
CREATE OR REPLACE FUNCTION generate_return_number(business_prefix VARCHAR(10))
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(gr.return_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM goods_returns gr
    WHERE gr.return_number LIKE 'RT-' || business_prefix || '%'
    AND LENGTH(gr.return_number) = LENGTH('RT-' || business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := 'RT-' || business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update invoice payment status and balance
    UPDATE invoices SET 
        amount_paid = COALESCE((
            SELECT SUM(amount) 
            FROM invoice_payments 
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ), 0),
        balance_due = total_amount - COALESCE((
            SELECT SUM(amount) 
            FROM invoice_payments 
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ), 0),
        payment_status = CASE 
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM invoice_payments 
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            ), 0) = 0 THEN 'unpaid'
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM invoice_payments 
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            ), 0) < total_amount THEN 'partial'
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM invoice_payments 
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            ), 0) = total_amount THEN 'paid'
            ELSE 'overpaid'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic payment status updates
DROP TRIGGER IF EXISTS trigger_update_invoice_payment_status_insert ON invoice_payments;
CREATE TRIGGER trigger_update_invoice_payment_status_insert
    AFTER INSERT ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_status();

DROP TRIGGER IF EXISTS trigger_update_invoice_payment_status_update ON invoice_payments;
CREATE TRIGGER trigger_update_invoice_payment_status_update
    AFTER UPDATE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_status();

DROP TRIGGER IF EXISTS trigger_update_invoice_payment_status_delete ON invoice_payments;
CREATE TRIGGER trigger_update_invoice_payment_status_delete
    AFTER DELETE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_status();

-- Add triggers for all tables
CREATE TRIGGER update_financial_accounts_updated_at
    BEFORE UPDATE ON financial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_payments_updated_at
    BEFORE UPDATE ON invoice_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goods_returns_updated_at
    BEFORE UPDATE ON goods_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goods_return_lines_updated_at
    BEFORE UPDATE ON goods_return_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initialize existing invoices with proper balance calculations
UPDATE invoices 
SET balance_due = total_amount - amount_paid,
    payment_status = CASE 
        WHEN amount_paid = 0 THEN 'unpaid'
        WHEN amount_paid < total_amount THEN 'partial'
        WHEN amount_paid = total_amount THEN 'paid'
        ELSE 'overpaid'
    END
WHERE balance_due IS NULL OR payment_status IS NULL;