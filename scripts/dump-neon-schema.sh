#!/bin/bash

# Script to dump Neon database schema
# This will create a schema.sql file with the complete structure

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env file"
    echo "Please ensure DATABASE_URL is set in your .env file"
    exit 1
fi

echo "🔍 Dumping Neon database schema..."
echo "📋 Connection: ${DATABASE_URL:0:30}..." # Show first 30 chars for security

# Extract connection details from DATABASE_URL if needed
# Format: postgresql://user:password@host:port/database

# Dump schema only (no data, no owner, no privileges)
pg_dump \
  --dbname="$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=schema.sql \
  --verbose

if [ $? -eq 0 ]; then
    echo "✅ Schema dumped successfully to schema.sql"
    echo "📊 File size: $(du -h schema.sql | cut -f1)"
    echo "📝 Lines: $(wc -l < schema.sql)"
else
    echo "❌ Error dumping schema"
    exit 1
fi

