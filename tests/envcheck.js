// scripts/checkEnv.js
require('dotenv').config();
const supabase = require('../config/supabase');

/**
 * Checks if the environment is properly configured for Supabase Storage
 */
async function checkEnvironment() {
  console.log('\n=== Environment Check ===\n');
  
  let allGood = true;
  
  // Check required environment variables
  console.log('Checking required environment variables...');
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.error(`❌ Missing environment variable: ${varName}`);
      allGood = false;
    } else {
      console.log(`✅ ${varName} is set`);
    }
  }
  
  console.log('\nChecking Supabase connection...');
  try {
    // Try to connect to Supabase
    const { data, error } = await supabase.from('threads').select('id').limit(1);
    
    if (error) {
      console.error('❌ Supabase database connection failed:', error.message);
      allGood = false;
    } else {
      console.log('✅ Supabase database connection successful');
    }
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    allGood = false;
  }
  
  console.log('\nChecking Supabase Storage...');
  try {
    // Check storage access
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Supabase Storage access failed:', bucketsError.message);
      allGood = false;
    } else {
      console.log('✅ Supabase Storage access successful');
      console.log(`   Found ${buckets.length} storage buckets`);
      
      // Check for required buckets
      const requiredBuckets = ['board-images', 'board-thumbnails'];
      for (const bucket of requiredBuckets) {
        if (buckets.some(b => b.name === bucket)) {
          console.log(`✅ Required bucket found: ${bucket}`);
        } else {
          console.log(`❓ Required bucket not found: ${bucket} (will be created at startup)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Supabase Storage error:', error.message);
    allGood = false;
  }
  
  // Final summary
  console.log('\n=== Summary ===');
  if (allGood) {
    console.log('✅ Environment is correctly configured!');
    return true;
  } else {
    console.log('❌ Environment has issues that need to be fixed.');
    return false;
  }
}

// Run check if called directly
if (require.main === module) {
  checkEnvironment()
    .then(status => {
      process.exit(status ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error during environment check:', error);
      process.exit(1);
    });
} else {
  module.exports = { checkEnvironment };
}