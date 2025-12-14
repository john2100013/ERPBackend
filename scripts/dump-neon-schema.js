#!/usr/bin/env node

/**
 * Script to dump Neon database schema using Node.js
 * This is an alternative to the bash script for Windows users
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not found in .env file');
  console.error('Please ensure DATABASE_URL is set in your .env file');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
const outputFile = path.join(__dirname, '../schema.sql');

console.log('🔍 Dumping Neon database schema...');
console.log(`📋 Connection: ${dbUrl.substring(0, 30)}...`); // Show first 30 chars for security

try {
  // Execute pg_dump
  const command = `pg_dump --dbname="${dbUrl}" --schema-only --no-owner --no-privileges --file="${outputFile}" --verbose`;
  
  console.log('📤 Running pg_dump...');
  execSync(command, { stdio: 'inherit' });
  
  // Check if file was created
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    const content = fs.readFileSync(outputFile, 'utf8');
    const lineCount = content.split('\n').length;
    
    console.log('✅ Schema dumped successfully!');
    console.log(`📁 File: ${outputFile}`);
    console.log(`📊 Size: ${fileSizeInMB} MB`);
    console.log(`📝 Lines: ${lineCount}`);
  } else {
    console.error('❌ Error: schema.sql file was not created');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error dumping schema:', error.message);
  process.exit(1);
}

