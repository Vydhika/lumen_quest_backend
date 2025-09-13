/**
 * Supabase client configuration and initialization
 * Provides database connection and authentication services
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/helpers');

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Create Supabase client with anon key (for client operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side doesn't need session persistence
    },
  }
);

// Create Supabase admin client with service role key (for admin operations)
let supabaseAdmin = null;
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
} else {
  logger.warn('SUPABASE_SERVICE_ROLE_KEY not provided. Admin operations will be limited.');
}

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist"
      throw error;
    }
    
    logger.info('✅ Supabase connection established successfully');
    return true;
  } catch (error) {
    logger.warn('⚠️  Supabase connection test failed:', error.message);
    logger.info('This is normal if tables haven\'t been created yet.');
    return false;
  }
};

// Initialize connection test
if (process.env.NODE_ENV !== 'test') {
  testConnection();
}

module.exports = {
  supabase,
  supabaseAdmin,
  testConnection
};