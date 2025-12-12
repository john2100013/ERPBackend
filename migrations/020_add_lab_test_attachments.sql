-- Migration 020: Add file attachment support to lab tests
-- Add attachment_url column to lab_tests table

ALTER TABLE lab_tests 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255);

-- Note: No index on attachment_url as it can contain large base64 data
-- If you need to query by attachment existence, use: WHERE attachment_url IS NOT NULL
-- For production, consider storing files externally (S3, Cloudinary) and storing URLs only

