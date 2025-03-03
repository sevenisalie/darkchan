const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
  process.exit(1);
}

// Create a single supabase client for interacting with the database
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;