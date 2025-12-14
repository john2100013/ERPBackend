-- Migration 029: Add is_manual column to mpesa_confirmations table and fix business_id constraint
-- This column indicates whether the M-Pesa confirmation was manually entered by a user
-- Also makes business_id nullable since C2B callbacks may not have business_id initially

-- Make business_id nullable (C2B callbacks may not have business_id initially)
DO $$ 
BEGIN
  -- Check if business_id is currently NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mpesa_confirmations' 
    AND column_name = 'business_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE mpesa_confirmations 
    ALTER COLUMN business_id DROP NOT NULL;
    
    RAISE NOTICE 'Made business_id nullable in mpesa_confirmations table';
  ELSE
    RAISE NOTICE 'business_id is already nullable in mpesa_confirmations table';
  END IF;
END $$;

-- Add is_manual column to mpesa_confirmations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mpesa_confirmations' AND column_name = 'is_manual'
  ) THEN
    ALTER TABLE mpesa_confirmations 
    ADD COLUMN is_manual BOOLEAN DEFAULT FALSE;
    
    -- Update existing records to mark them as not manual (they were from Safaricom callbacks)
    UPDATE mpesa_confirmations SET is_manual = FALSE WHERE is_manual IS NULL;
    
    RAISE NOTICE 'Added is_manual column to mpesa_confirmations table';
  ELSE
    RAISE NOTICE 'Column is_manual already exists in mpesa_confirmations table';
  END IF;
END $$;

-- Create index for faster lookups on manual confirmations
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_is_manual ON mpesa_confirmations(is_manual);

