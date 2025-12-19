-- Migration: Add category_name column to business_custom_category_names table
-- This allows businesses to customize the label for the main category field

-- Add category_name column if it doesn't exist
ALTER TABLE business_custom_category_names
ADD COLUMN IF NOT EXISTS category_name VARCHAR(50) DEFAULT 'Category';

-- Update existing rows to have default value if category_name is NULL
UPDATE business_custom_category_names
SET category_name = 'Category'
WHERE category_name IS NULL;

-- Add comment to the column
COMMENT ON COLUMN business_custom_category_names.category_name IS 'Custom label for the main category field in items';

