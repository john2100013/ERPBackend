# Database Schema Synchronization

This tool ensures your local PostgreSQL database structure matches 100% exactly with your Neon database structure.

## Why This Is Needed

When syncing data from local to Neon, column mismatches cause errors like:
- `column "username" of relation "users" does not exist`
- `column "owner_id" of relation "businesses" does not exist`
- `bind message supplies X parameters, but prepared statement requires Y`

## How It Works

The schema sync tool:
1. Connects to both Neon and local databases
2. Compares table structures (columns, types, constraints)
3. Generates SQL to make local match Neon exactly
4. Optionally applies the changes

## Usage

### 1. Dry Run (Recommended First)

See what differences exist without making changes:

```bash
cd backend
npm run sync-schema
```

This will show:
- Columns that need to be added
- Columns that need to be removed
- Columns that need to be modified
- Generated SQL statements

### 2. Apply Changes

After reviewing the differences, apply them:

```bash
npm run sync-schema:apply
```

⚠️ **Warning**: This will modify your local database structure. Make sure you have a backup!

## Manual Migration

If you prefer to create a migration file instead:

1. Run the dry run to see the differences
2. Copy the generated SQL
3. Create a new migration file in `backend/migrations/`
4. Run `npm run migrate`

## Sample Data Analysis

Based on the sample data you provided, we know:

### Tables Structure from Neon:

1. **users** table:
   - `id`, `business_id`, `email`, `first_name`, `last_name`, `password_hash`, `role`, `status`, `created_at`, `updated_at`
   - ❌ Does NOT have: `username`, `owner_id`

2. **businesses** table:
   - `id`, `name`, `email`, `phone`, `address`, `website`, `logo_url`, `tax_number`, `status`, `created_at`, `updated_at`
   - ❌ Does NOT have: `owner_id`

3. **invoice_lines** table:
   - Based on errors, does NOT have `created_at` column

4. **service_billing** tables:
   - `customer_assignments`: `id`, `booking_id`, `service_id`, `employee_id`, `start_time`, `end_time`, `estimated_duration`, `status`, `created_at`, `updated_at`
   - `service_invoices`: `id`, `business_id`, `invoice_number`, `customer_id`, `booking_id`, `subtotal`, `vat_amount`, `total_amount`, `payment_status`, `payment_method`, `notes`, `created_at`, `updated_at`
   - `service_invoice_items`: `id`, `invoice_id`, `service_id`, `employee_id`, `service_name`, `duration`, `price`, `amount`, `created_at`
   - `service_billing_customers`: `id`, `business_id`, `name`, `phone`, `location`, `email`, `notes`, `created_at`, `updated_at`

5. **salon** tables:
   - `salon_employees`: `id`, `user_id`, `business_id`, `role`, `commission_rate`, `is_active`, `created_at`, `updated_at`
   - `salon_transactions`: `id`, `business_id`, `shift_id`, `employee_id`, `cashier_id`, `service_id`, `customer_name`, `customer_phone`, `service_price`, `employee_commission`, `payment_method`, `transaction_date`, `notes`, `created_at`, `updated_at`
   - `salon_shifts`: `id`, `business_id`, `user_id`, `clock_in`, `clock_out`, `starting_float`, `ending_cash`, `expected_cash`, `cash_difference`, `notes`, `status`, `created_at`, `updated_at`
   - `salon_services`: `id`, `business_id`, `name`, `description`, `base_price`, `duration_minutes`, `is_active`, `created_at`, `updated_at`
   - `salon_products`: `id`, `business_id`, `name`, `description`, `unit`, `current_stock`, `min_stock_level`, `unit_cost`, `is_active`, `created_at`, `updated_at`

## Next Steps

1. Run `npm run sync-schema` to see current differences
2. Review the output carefully
3. If you have more sample data, share it and we'll update the migrations
4. Run `npm run sync-schema:apply` when ready to sync

## Troubleshooting

### Connection Errors

Make sure your `.env` file has:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (for local)
- `NEON_DATABASE_URL` (for Neon)

### Permission Errors

Ensure your database user has ALTER TABLE permissions.

### Data Loss Warnings

When dropping columns, data in those columns will be lost. The tool will warn you before applying changes.

