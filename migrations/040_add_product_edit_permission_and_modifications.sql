-- Migration 040: Add product edit/delete permission and product modifications table
-- This migration adds:
-- 1. can_edit_delete_products column to users table
-- 2. product_modifications table to track product changes

-- Add can_edit_delete_products permission column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS can_edit_delete_products BOOLEAN DEFAULT false;

-- Set default permission for admin/owner roles (they should have permission)
UPDATE users 
SET can_edit_delete_products = true
WHERE role IN ('admin', 'owner');

-- Create product_modifications table to track product changes
CREATE TABLE IF NOT EXISTS product_modifications (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    modification_number VARCHAR(50) UNIQUE NOT NULL,
    modified_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Old values (before modification)
    old_item_name VARCHAR(255),
    old_description TEXT,
    old_quantity DECIMAL(10,3),
    old_unit_price DECIMAL(10,2),
    old_unit VARCHAR(50),
    old_category_id INTEGER,
    old_category_1_id INTEGER,
    old_category_2_id INTEGER,
    
    -- New values (after modification)
    new_item_name VARCHAR(255),
    new_description TEXT,
    new_quantity DECIMAL(10,3),
    new_unit_price DECIMAL(10,2),
    new_unit VARCHAR(50),
    new_category_id INTEGER,
    new_category_1_id INTEGER,
    new_category_2_id INTEGER,
    
    -- Modification details
    modification_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_product_modifications_item_id ON product_modifications(item_id);
CREATE INDEX IF NOT EXISTS idx_product_modifications_business_id ON product_modifications(business_id);
CREATE INDEX IF NOT EXISTS idx_product_modifications_modified_by ON product_modifications(modified_by);
CREATE INDEX IF NOT EXISTS idx_product_modifications_created_at ON product_modifications(created_at);

-- Create function to generate modification number
CREATE OR REPLACE FUNCTION generate_product_modification_number(prefix VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    next_num INTEGER;
    mod_number VARCHAR;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(modification_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM product_modifications
    WHERE modification_number LIKE prefix || '%';
    
    -- Format: PM-BUS-0001, PM-BUS-0002, etc.
    mod_number := prefix || LPAD(next_num::TEXT, 4, '0');
    
    RETURN mod_number;
END;
$$ LANGUAGE plpgsql;

