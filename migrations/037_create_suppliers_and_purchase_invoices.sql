-- Migration 037: Create suppliers and purchase invoices tables

-- Create suppliers table (similar to customers)
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    pin VARCHAR(50),
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_pin ON suppliers(pin);

-- Create purchase_invoices table (similar to invoices but for purchases)
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_address TEXT,
    supplier_pin VARCHAR(50),
    purchase_invoice_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    actual_amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    change_received DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overpaid')),
    payment_method VARCHAR(50) DEFAULT 'Cash',
    mpesa_code VARCHAR(100),
    payment_terms VARCHAR(100) DEFAULT 'Net 30 Days',
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, purchase_invoice_number)
);

-- Create indexes for purchase_invoices
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_business_id ON purchase_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_id ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_purchase_invoice_number ON purchase_invoices(purchase_invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_issue_date ON purchase_invoices(issue_date);

-- Create purchase_invoice_lines table (similar to invoice_lines)
CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
    id SERIAL PRIMARY KEY,
    purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    code VARCHAR(100),
    uom VARCHAR(20),
    category_id INTEGER,
    category_1_id INTEGER,
    category_2_id INTEGER,
    category_name VARCHAR(255),
    category_1_name VARCHAR(255),
    category_2_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for purchase_invoice_lines
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_purchase_invoice_id ON purchase_invoice_lines(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_item_id ON purchase_invoice_lines(item_id);

-- Create purchase_invoice_payments table (similar to invoice_payments)
CREATE TABLE IF NOT EXISTS purchase_invoice_payments (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
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

-- Create indexes for purchase_invoice_payments
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_purchase_invoice_id ON purchase_invoice_payments(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_financial_account_id ON purchase_invoice_payments(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_business_id ON purchase_invoice_payments(business_id);

-- Create function to generate purchase invoice number (similar to invoice number generation)
CREATE OR REPLACE FUNCTION generate_purchase_invoice_number(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    invoice_num TEXT;
    date_prefix TEXT;
BEGIN
    -- Create date prefix: YYYYMMDD
    date_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get the next number for this prefix and date
    -- Extract the sequence number (last 4 digits after the last dash)
    SELECT COALESCE(MAX(CAST(RIGHT(purchase_invoice_number, 4) AS INTEGER)), 0) + 1
    INTO next_num
    FROM purchase_invoices
    WHERE purchase_invoice_number LIKE prefix || date_prefix || '-%'
    AND LENGTH(purchase_invoice_number) = LENGTH(prefix || date_prefix || '-') + 4;
    
    -- Format: PREFIX-YYYYMMDD-NNNN
    invoice_num := prefix || date_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
    
    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

