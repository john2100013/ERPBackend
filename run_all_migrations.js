const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Running migrations on both Neon and Local PostgreSQL databases...\n');

try {
  // Run Neon migration first
  console.log('📦 Step 1/2: Running migration on Neon database...');
  console.log('─'.repeat(50));
  execSync('node run_neon_migration.js', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log('\n✅ Neon migration completed!\n');

  // Run Local migration
  console.log('📦 Step 2/2: Running migration on Local PostgreSQL database...');
  console.log('─'.repeat(50));
  execSync('node run_local_migration.js', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log('\n✅ Local migration completed!\n');

  console.log('🎉 All migrations completed successfully on both databases!');
} catch (error) {
  console.error('\n❌ Migration process failed. Please check the errors above.');
  process.exit(1);
}

