# Recreate Database from Neon Schema

## Quick Start

To drop all tables and recreate from Neon schema:

```bash
npm run recreate-db -- --confirm
```

⚠️ **WARNING**: This will delete ALL data in your local database!

## What It Does

1. **Drops all existing tables** in your local database
2. **Fetches fresh schema** from Neon using `pg_dump`
3. **Creates all tables** exactly as they exist in Neon
4. **Verifies** the structure matches

## Improved Sync Logging

The sync service now includes detailed logging:

- ✅ Shows which columns are being synced
- ✅ Lists columns that exist only in local or Neon
- ✅ Displays parameter counts and column names on errors
- ✅ Logs each table being processed

## After Recreation

Once you recreate the database:

1. **Run migrations** to ensure schema_migrations table exists:
   ```bash
   npm run migrate
   ```

2. **Test sync** to verify it works:
   - Go to Database Settings in your app
   - Click "Sync All Data"
   - Check the detailed logs in backend console

## Troubleshooting

### pg_dump not found
- Install PostgreSQL client tools
- Ensure `pg_dump` is in your PATH
- Or use the alternative script: `fix-and-recreate-db.ts`

### Connection errors
- Check `.env` file has correct `DATABASE_URL` for Neon
- Verify local database credentials in `.env`

### Sync still shows errors
- Check backend console for detailed column information
- Verify both databases are accessible
- Run `npm run validate-schema` to check structure

## Alternative: Use Existing Migrations

If you prefer not to drop everything, you can:

1. Run all migrations fresh:
   ```bash
   # Drop schema_migrations to rerun all
   psql -U postgres -d awesomeinvoice -c "DROP TABLE schema_migrations;"
   npm run migrate
   ```

2. This will recreate tables using migration files (which match Neon)

