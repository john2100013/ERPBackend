# Running Migration on Neon Database

This guide explains how to run the `029_add_is_manual_to_mpesa_confirmations.sql` migration on your Neon database.

## Prerequisites

1. Make sure you have your Neon database connection string in your `.env` file
2. The connection string should be in one of these formats:
   - `NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require`
   - `DATABASE_URL=postgresql://user:password@host/database?sslmode=require`
   - Or individual variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

## Method 1: Using npm script (Recommended)

```bash
cd backend
npm run migrate:neon
```

## Method 2: Direct Node.js execution

```bash
cd backend
node run_neon_migration.js
```

## Method 3: Manual SQL execution in Neon Console

1. Go to your Neon dashboard
2. Open the SQL Editor
3. Copy the contents of `migrations/029_add_is_manual_to_mpesa_confirmations.sql`
4. Paste and execute in the SQL Editor

## What the migration does:

1. ✅ Makes `business_id` nullable in `mpesa_confirmations` table
2. ✅ Adds `is_manual` column (BOOLEAN, default FALSE)
3. ✅ Creates index on `is_manual` for faster lookups
4. ✅ Updates existing records to mark them as not manual

## Troubleshooting

If you get connection errors:
- Check that your `.env` file has the correct database URL
- Ensure the URL includes `?sslmode=require` for Neon
- Verify your Neon database is accessible

If the migration says it's already executed:
- The migration tracks execution in `schema_migrations` table
- You can check: `SELECT * FROM schema_migrations WHERE version = '029_add_is_manual_to_mpesa_confirmations';`

