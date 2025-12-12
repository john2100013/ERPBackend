# Fix: Lab Test Attachment Index Error

## Problem
Error: `index row requires 70288 bytes, maximum size is 8191`

This happens because PostgreSQL tried to create an index on `attachment_url` column which contains large base64-encoded image data. PostgreSQL has a limit of 8191 bytes for index keys.

## Solution

### Step 1: Drop the Problematic Index

Connect to your PostgreSQL database and run:

```sql
-- Drop the index if it exists
DROP INDEX IF EXISTS idx_lab_tests_attachment_url;
```

### Step 2: Ensure Columns Exist

```sql
-- Make sure the columns exist (they should already exist)
ALTER TABLE lab_tests 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255);
```

### Step 3: Verify Fix

```sql
-- Check that the index is gone
SELECT indexname FROM pg_indexes WHERE tablename = 'lab_tests' AND indexname = 'idx_lab_tests_attachment_url';
-- Should return no rows

-- Check that columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lab_tests' 
AND column_name IN ('attachment_url', 'attachment_filename');
-- Should return 2 rows
```

## Why This Happened

The migration `020_add_lab_test_attachments.sql` tried to create an index on `attachment_url`:
```sql
CREATE INDEX IF NOT EXISTS idx_lab_tests_attachment_url ON lab_tests(attachment_url) WHERE attachment_url IS NOT NULL;
```

However, when base64-encoded images are stored in this column, they can be very large (70KB+), which exceeds PostgreSQL's index size limit.

## Updated Migration

The migration has been updated to **NOT** create an index on `attachment_url`. A new migration `021_fix_lab_test_attachment_index.sql` has been created to drop the index if it exists.

## Alternative Solutions (For Production)

For production environments, consider:

1. **Store files externally** (recommended):
   - Upload files to AWS S3, Cloudinary, or similar service
   - Store only the file URL in the database
   - This allows indexing the URL if needed

2. **Use a hash index** (if you need to query by file):
   - Store a hash of the file content
   - Index the hash instead of the full data

3. **Use PostgreSQL's Large Object feature**:
   - Store files as BLOBs using `lo_import()` and `lo_export()`
   - Store the OID reference in the table

## Current Implementation

The current implementation stores base64-encoded files directly in the database. This works but:
- ✅ Simple to implement
- ✅ No external dependencies
- ❌ Can't index the column
- ❌ Database size grows quickly
- ❌ Not ideal for large files (>1MB)

For now, the fix is to simply remove the index. The functionality will work fine without it.

