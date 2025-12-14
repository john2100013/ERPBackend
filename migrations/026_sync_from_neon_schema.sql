-- Migration: Sync local database with Neon schema
-- Generated: 2025-12-14T09:20:45.496Z
-- Based on schema.sql from Neon database

ALTER TABLE businesses DROP COLUMN IF EXISTS phone;

ALTER TABLE businesses DROP COLUMN IF EXISTS address;

ALTER TABLE invoice_lines DROP COLUMN IF EXISTS updated_at;
