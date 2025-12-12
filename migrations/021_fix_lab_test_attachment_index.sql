-- Migration 021: Fix lab test attachment index issue
-- Drop the index on attachment_url if it exists (it causes errors with large base64 data)

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_lab_tests_attachment_url;

-- Ensure columns exist (in case migration 020 wasn't run)
ALTER TABLE lab_tests 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255);

-- Note: We don't create an index on attachment_url because:
-- 1. Base64-encoded images can exceed PostgreSQL's index size limit (8191 bytes)
-- 2. TEXT columns with large data shouldn't be indexed directly
-- 3. If you need to query by attachment existence, use: WHERE attachment_url IS NOT NULL
-- 4. For production, consider storing files externally (S3, Cloudinary) and storing URLs only

