# Database Migrations Guide

This project uses SQL migration files to manage database schema changes. Migrations can be run on both **Neon** (cloud PostgreSQL) and **Local PostgreSQL** databases.

## Migration Files

All migration files are located in the `migrations/` directory and follow the naming pattern:
- `XXX_description.sql` (e.g., `030_add_discount_to_invoices.sql`)

## Running Migrations

### Option 1: Run on Neon Database Only
```bash
npm run migrate:neon
```
This will:
- Connect to Neon database using `NEON_DATABASE_URL` or `DATABASE_URL` from `.env`
- Run the latest migration file
- Track executed migrations in `schema_migrations` table

### Option 2: Run on Local PostgreSQL Database Only
```bash
npm run migrate:local
```
This will:
- Connect to local PostgreSQL using `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` from `.env`
- Run the latest migration file
- Track executed migrations in `schema_migrations` table

### Option 3: Run on Both Databases
```bash
npm run migrate:all
```
This will:
- First run migration on Neon database
- Then run migration on Local PostgreSQL database
- Useful when you want to keep both databases in sync

## Environment Variables

### For Neon Database
Add to your `.env` file:
```env
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
# OR
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

### For Local PostgreSQL Database
Add to your `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=awesome_invoice_db
DB_USER=postgres
DB_PASSWORD=your_password
```

## Migration Tracking

Both scripts automatically:
- Create a `schema_migrations` table if it doesn't exist
- Track which migrations have been executed
- Skip migrations that have already been run
- Run migrations in a transaction (rolls back on error)

## Notes

- Each migration script runs only the **latest** migration file
- Migrations are tracked separately for Neon and Local databases
- Always test migrations on a development database first
- Make sure your `.env` file has the correct database credentials

