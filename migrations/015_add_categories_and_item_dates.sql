-- Migration 015: Add item categories, manufacturing/expiry dates, and verify mpesa_code column

-- Create item_categories table
CREATE TABLE IF NOT EXISTS item_categories (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, name)
);

-- Add category_id to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manufacturing_date DATE,
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Verify mpesa_code column exists in invoices (added in migration 014, but ensuring it's there)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'mpesa_code'
  ) THEN
    ALTER TABLE invoices ADD COLUMN mpesa_code VARCHAR(100);
  END IF;
END $$;

-- Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_item_categories_business_id ON item_categories(business_id);
