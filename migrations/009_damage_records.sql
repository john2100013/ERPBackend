-- Migration: Add damage records table
-- This migration adds damage/loss tracking functionality

-- Create damage records table
CREATE TABLE IF NOT EXISTS damage_records (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    damage_number VARCHAR(50) UNIQUE NOT NULL,
    damage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    damage_type VARCHAR(20) NOT NULL CHECK (damage_type IN ('damaged', 'expired', 'lost', 'stolen', 'other')),
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create damage record lines table
CREATE TABLE IF NOT EXISTS damage_record_lines (
    id SERIAL PRIMARY KEY,
    damage_record_id INTEGER NOT NULL REFERENCES damage_records(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    code VARCHAR(100) NOT NULL,
    uom VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_damage_records_business_id ON damage_records(business_id);
CREATE INDEX IF NOT EXISTS idx_damage_records_damage_type ON damage_records(damage_type);
CREATE INDEX IF NOT EXISTS idx_damage_records_status ON damage_records(status);
CREATE INDEX IF NOT EXISTS idx_damage_records_damage_number ON damage_records(damage_number);

CREATE INDEX IF NOT EXISTS idx_damage_record_lines_damage_record_id ON damage_record_lines(damage_record_id);
CREATE INDEX IF NOT EXISTS idx_damage_record_lines_item_id ON damage_record_lines(item_id);

-- Create function to generate damage numbers
CREATE OR REPLACE FUNCTION generate_damage_number(business_prefix VARCHAR(10))
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(dr.damage_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM damage_records dr
    WHERE dr.damage_number LIKE 'DMG-' || business_prefix || '%'
    AND LENGTH(dr.damage_number) = LENGTH('DMG-' || business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := 'DMG-' || business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
CREATE TRIGGER update_damage_records_updated_at
    BEFORE UPDATE ON damage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_damage_record_lines_updated_at
    BEFORE UPDATE ON damage_record_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();