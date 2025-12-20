# Running Migration 036: Add Actual Amount Received and Change Given Columns

This guide explains how to run the `036_add_actual_amount_and_change_to_invoices.sql` migration on both your local PostgreSQL and Neon databases.

## What This Migration Does

1. ✅ Adds `actual_amount_received` column to `invoices` table
2. ✅ Adds `change_given` column to `invoices` table
3. ✅ Calculates and updates existing records:
   - `actual_amount_received = LEAST(total_amount, amount_paid)` - The actual amount received from customer
   - `change_given = GREATEST(0, amount_paid - total_amount)` - Change given to customer if they overpaid

## Prerequisites

1. Make sure your `.env` file has the correct database credentials:

### For Local PostgreSQL (lines 14-20 in .env):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=awesome_invoice_db
DB_USER=postgres
DB_PASSWORD=your_local_password
```

### For Neon Database (line 28 in .env):
```env
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
```

Or alternatively:
```env
NEON_DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
```

## Method 1: Run on Both Databases (Recommended)

This will run the migration on both Neon and Local PostgreSQL databases:

```bash
cd backend
npm run migrate:all
```

Or directly:
```bash
cd backend
node run_all_migrations.js
```

## Method 2: Run on Individual Databases

### Run on Neon Database Only:
```bash
cd backend
npm run migrate:neon
```

Or:
```bash
cd backend
node run_neon_migration.js
```

### Run on Local PostgreSQL Only:
```bash
cd backend
npm run migrate:local
```

Or:
```bash
cd backend
node run_local_migration.js
```

## Method 3: Manual SQL Execution

If you prefer to run the migration manually:

### For Neon Database:
1. Go to your Neon dashboard
2. Open the SQL Editor
3. Copy the contents of `migrations/036_add_actual_amount_and_change_to_invoices.sql`
4. Paste and execute in the SQL Editor

### For Local PostgreSQL:
1. Connect to your PostgreSQL database using psql or pgAdmin
2. Copy the contents of `migrations/036_add_actual_amount_and_change_to_invoices.sql`
3. Execute the SQL commands

## Verification

After running the migration, verify the columns were added:

```sql
-- Check if columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND column_name IN ('actual_amount_received', 'change_given');

-- Check sample data
SELECT id, invoice_number, total_amount, amount_paid, actual_amount_received, change_given 
FROM invoices 
LIMIT 5;
```

## Troubleshooting

### Connection Errors

**For Neon:**
- Ensure `DATABASE_URL` or `NEON_DATABASE_URL` is set in `.env`
- Verify the URL includes `?sslmode=require`
- Check that your Neon database is accessible

**For Local PostgreSQL:**
- Verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` are correct
- Ensure PostgreSQL is running locally
- Check firewall settings if connection fails

### Migration Already Executed

If the migration says it's already executed:
- Check: `SELECT * FROM schema_migrations WHERE version = '036_add_actual_amount_and_change_to_invoices';`
- The migration tracks execution in `schema_migrations` table
- If needed, you can manually run the SQL if the tracking entry is missing

### Column Already Exists

If you get "column already exists" errors:
- The migration uses `IF NOT EXISTS` checks, so it should be safe to re-run
- If columns already exist, the migration will update existing data

## Expected Output

When running successfully, you should see:

```
🚀 Running migrations on both Neon and Local PostgreSQL databases...

📦 Step 1/2: Running migration on Neon database...
──────────────────────────────────────────────────
🔗 Connecting to Neon database...
   Using: DATABASE_URL
✅ Connected to Neon database successfully
📝 Running migration: 036_add_actual_amount_and_change_to_invoices.sql
✅ Migration 036_add_actual_amount_and_change_to_invoices.sql completed successfully on Neon database!
🎉 Neon migration process completed!

📦 Step 2/2: Running migration on Local PostgreSQL database...
──────────────────────────────────────────────────
🔗 Connecting to local PostgreSQL database...
   Host: localhost
   Database: awesome_invoice_db
✅ Connected to local database successfully
📝 Running migration on local database: 036_add_actual_amount_and_change_to_invoices.sql
✅ Migration 036_add_actual_amount_and_change_to_invoices.sql completed successfully on local database!
🎉 Local migration process completed!

🎉 All migrations completed successfully on both databases!
```

