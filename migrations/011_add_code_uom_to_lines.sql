-- Add code and uom columns to quotation_lines table
ALTER TABLE quotation_lines
ADD COLUMN IF NOT EXISTS code VARCHAR(100),
ADD COLUMN IF NOT EXISTS uom VARCHAR(50);

-- Add code and uom columns to invoice_lines table
ALTER TABLE invoice_lines
ADD COLUMN IF NOT EXISTS code VARCHAR(100),
ADD COLUMN IF NOT EXISTS uom VARCHAR(50);