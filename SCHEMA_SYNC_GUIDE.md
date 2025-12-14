# Complete Schema Synchronization Guide

This guide explains how to ensure your local PostgreSQL database structure matches 100% exactly with your Neon database.

## Quick Start

```bash
# 1. Dump Neon schema to schema.sql
npm run dump-neon-schema

# 2. Compare and generate migration
npm run sync-from-schema

# 3. Apply the migration
npm run migrate
```

## Detailed Workflow

### Step 1: Dump Neon Database Schema

This connects to your Neon database (using `DATABASE_URL` from `.env`) and generates a complete `schema.sql` file:

```bash
npm run dump-neon-schema
```

**Output**: `backend/schema.sql` (contains all table structures from Neon)

**What it does**:
- Connects to Neon database
- Fetches all 42 tables
- Extracts column definitions, primary keys, foreign keys, and indexes
- Generates CREATE TABLE statements

### Step 2: Compare with Local Database

This compares the Neon schema (from `schema.sql`) with your local database:

```bash
npm run sync-from-schema
```

**Output**: 
- Shows differences (columns to add/drop)
- Generates migration file: `migrations/026_sync_from_neon_schema.sql`

**What it does**:
- Parses `schema.sql` to extract table/column structures
- Compares with local database structure
- Identifies missing columns, extra columns, and mismatches
- Generates SQL to sync them

### Step 3: Apply Migration

Apply the generated migration:

```bash
npm run migrate
```

This will:
- Execute the migration SQL
- Drop columns that don't exist in Neon
- Add columns that exist in Neon but not locally
- Update the `schema_migrations` table

## Alternative: Direct Schema Sync (Advanced)

If you want to compare databases directly without using schema.sql:

```bash
# Dry run - shows differences
npm run sync-schema

# Apply changes directly
npm run sync-schema:apply
```

⚠️ **Note**: This requires both databases to be accessible simultaneously.

## What Was Fixed

Based on the schema dump from Neon, we've identified and fixed:

### Removed Columns (Not in Neon):
- ✅ `users.username` - Removed (migration 025)
- ✅ `businesses.owner_id` - Removed (migration 025)
- ✅ `businesses.phone` - Removed (migration 026)
- ✅ `businesses.address` - Removed (migration 026)
- ✅ `invoice_lines.created_at` - Removed (migration 025)
- ✅ `invoice_lines.updated_at` - Removed (migration 026)

### Added Columns (Required by Neon):
- ✅ `users.business_id` - Added (migration 023)
- ✅ `users.first_name` - Added (migration 023)
- ✅ `users.last_name` - Added (migration 023)
- ✅ `users.role` - Added (migration 023)
- ✅ `users.status` - Added (migration 023)
- ✅ `businesses.email` - Added (migration 022)
- ✅ `businesses.status` - Added (migration 022)

## Neon Database Structure

From the schema dump, Neon has **42 tables**:

### Core Tables:
- `users`, `businesses`, `business_settings`
- `customers`, `items`, `item_categories`
- `invoices`, `invoice_lines`, `invoice_payments`
- `quotations`, `quotation_lines`
- `financial_accounts`

### Service Billing:
- `services`, `service_customers`, `service_invoices`, `service_invoice_lines`
- `bookings`, `booking_services`, `customer_assignments`
- `employees`, `employee_commissions`, `commission_settings`

### Salon Module:
- `salon_users`, `salon_services`, `salon_products`
- `salon_shifts`, `salon_transactions`, `salon_employee_performance`
- `salon_product_usage`

### Hospital Module:
- `patients`, `consultations`, `doctor_visits`
- `lab_tests`, `prescriptions`, `prescription_items`

### Other:
- `goods_returns`, `goods_return_lines`
- `damage_records`, `damage_record_lines`
- `mpesa_confirmations`
- `business_custom_category_names`
- `schema_migrations`

## Troubleshooting

### Error: DATABASE_URL not found
- Ensure `.env` file has `DATABASE_URL` set to your Neon connection string
- Format: `postgresql://user:password@host:port/database`

### Error: Connection refused
- Check your Neon database is accessible
- Verify network connectivity
- Check firewall settings

### Migration fails
- Check if columns have data that would violate constraints
- Some columns might need to be dropped manually if they have dependencies
- Review the generated SQL before applying

### Schema.sql parsing errors
- The script uses regex to parse CREATE TABLE statements
- If schema.sql format is unusual, the parser might miss some columns
- You can manually edit `026_sync_from_neon_schema.sql` if needed

## Best Practices

1. **Always run dry-run first**: `npm run sync-from-schema` before applying
2. **Backup before applying**: Make sure you have a backup of your local database
3. **Review generated SQL**: Check the migration file before running `npm run migrate`
4. **Test sync after changes**: Run sync again to verify everything matches
5. **Keep schema.sql updated**: Re-run `dump-neon-schema` when Neon structure changes

## Files Created

- `schema.sql` - Complete Neon database schema (generated)
- `scripts/dump-neon-schema.ts` - Script to dump Neon schema
- `scripts/sync-from-schema.ts` - Script to compare and sync
- `src/database/schemaSync.ts` - Direct database comparison tool
- `migrations/026_sync_from_neon_schema.sql` - Generated migration (auto-created)

## Next Steps

1. ✅ Schema has been dumped from Neon
2. ✅ Differences have been identified
3. ✅ Migration has been generated and applied
4. 🔄 **Test data sync**: Try syncing data from local to Neon
5. 🔄 **Verify**: Run `npm run sync-from-schema` again to confirm 100% match

Your local database should now match Neon's structure exactly! 🎉

