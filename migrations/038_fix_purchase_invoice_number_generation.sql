-- Migration 038: Fix purchase invoice number generation function
-- This fixes the issue where the function was trying to cast "YYYYMMDD-NNNN" as INTEGER
-- Now it correctly extracts only the sequence number (last 4 digits)

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

