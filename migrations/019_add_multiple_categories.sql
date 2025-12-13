-- Migration 019: Add multiple categories (category_1, category_2) to items and business custom category names

-- Add category_1_id and category_2_id to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS category_1_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category_2_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL;

-- Create business_custom_category_names table for custom category labels per business
CREATE TABLE IF NOT EXISTS business_custom_category_names (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_1_name VARCHAR(100) DEFAULT 'Category 1',
  category_2_name VARCHAR(100) DEFAULT 'Category 2',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_category_1_id ON items(category_1_id);
CREATE INDEX IF NOT EXISTS idx_items_category_2_id ON items(category_2_id);
CREATE INDEX IF NOT EXISTS idx_business_custom_category_names_business_id ON business_custom_category_names(business_id);

