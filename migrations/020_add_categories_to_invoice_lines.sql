-- Migration 020: Add category fields to invoice_lines and quotation_lines tables

-- Add category columns to invoice_lines table
ALTER TABLE invoice_lines 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_1_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_2_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS category_1_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS category_2_name VARCHAR(255);

-- Add category columns to quotation_lines table
ALTER TABLE quotation_lines 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_1_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_2_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS category_1_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS category_2_name VARCHAR(255);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_lines_category_id ON invoice_lines(category_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_category_1_id ON invoice_lines(category_1_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_category_2_id ON invoice_lines(category_2_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_category_id ON quotation_lines(category_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_category_1_id ON quotation_lines(category_1_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_category_2_id ON quotation_lines(category_2_id);

