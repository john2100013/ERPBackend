-- Quick Fix: Drop the problematic index on lab_tests.attachment_url
-- Run this SQL script to fix the "index row requires 70288 bytes" error

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_lab_tests_attachment_url;

-- Verify the index is gone (should return 0 rows)
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'lab_tests' 
AND indexname = 'idx_lab_tests_attachment_url';

-- Ensure columns exist
ALTER TABLE lab_tests 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Index dropped successfully. You can now save lab test results with attachments.';
END $$;

