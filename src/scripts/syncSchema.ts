#!/usr/bin/env ts-node

/**
 * Schema Sync Script
 * 
 * This script compares the Neon database schema with the local database schema
 * and generates/applies migrations to make them match exactly.
 * 
 * Usage:
 *   npm run sync-schema          # Dry run (shows differences only)
 *   npm run sync-schema:apply    # Apply changes
 */

import { applySchemaSync } from '../database/schemaSync';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  
  try {
    console.log('🔍 Comparing Neon and Local database schemas...\n');
    await applySchemaSync(dryRun);
  } catch (error: any) {
    console.error('❌ Schema sync failed:', error.message);
    process.exit(1);
  }
}

main();

