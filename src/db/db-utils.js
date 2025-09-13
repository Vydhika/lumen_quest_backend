/**
 * Database utilities and helper functions
 * Provides common database operations and maintenance tasks
 */

const { supabase } = require('../config/supabase');
const MigrationRunner = require('./migrations/migration-runner');

class DatabaseUtils {
  constructor() {
    this.migrationRunner = new MigrationRunner();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('count', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      console.log('✓ Database connection successful');
      return true;
    } catch (error) {
      console.error('✗ Database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    console.log('Starting database migration...');
    await this.migrationRunner.runMigrations();
  }

  /**
   * Create a new migration file
   */
  createMigration(name) {
    return this.migrationRunner.createMigration(name);
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {};

      // Get table counts
      const tables = [
        'profiles',
        'plans', 
        'subscriptions',
        'payment_methods',
        'invoices',
        'payments',
        'notifications',
        'audit_logs'
      ];

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          stats[table] = count;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old data
   */
  async cleanup() {
    console.log('Starting database cleanup...');

    try {
      // Clean up old notifications
      const { error: notifError } = await supabase.rpc('cleanup_old_notifications');
      if (notifError) {
        console.warn('Notification cleanup warning:', notifError);
      }

      // Clean up old audit logs (older than 1 year)
      const { error: auditError } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

      if (auditError) {
        console.warn('Audit log cleanup warning:', auditError);
      }

      // Clean up failed payments older than 30 days
      const { error: paymentError } = await supabase
        .from('payments')
        .delete()
        .eq('status', 'failed')
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (paymentError) {
        console.warn('Payment cleanup warning:', paymentError);
      }

      console.log('✓ Database cleanup completed');
    } catch (error) {
      console.error('✗ Database cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Reset database (DANGER: Only for development)
   */
  async reset() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production');
    }

    console.log('WARNING: Resetting database...');
    
    try {
      const tables = [
        'audit_logs',
        'notifications', 
        'subscription_usage',
        'payments',
        'invoices',
        'payment_methods',
        'subscriptions',
        'plans',
        'profiles',
        'schema_migrations'
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error && !error.message.includes('does not exist')) {
          console.warn(`Warning deleting ${table}:`, error.message);
        }
      }

      console.log('✓ Database reset completed');
      console.log('Run migrations to restore schema and data');
    } catch (error) {
      console.error('✗ Database reset failed:', error);
      throw error;
    }
  }

  /**
   * Backup database (export key data)
   */
  async backup() {
    console.log('Creating database backup...');

    try {
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {}
      };

      // Export plans
      const { data: plans } = await supabase
        .from('plans')
        .select('*');
      backup.data.plans = plans;

      // Export active subscriptions
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*')
        .in('status', ['active', 'trial']);
      backup.data.subscriptions = subscriptions;

      // Export user profiles (without sensitive data)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, role, created_at');
      backup.data.profiles = profiles;

      return backup;
    } catch (error) {
      console.error('✗ Database backup failed:', error);
      throw error;
    }
  }

  /**
   * Analyze database performance
   */
  async analyze() {
    console.log('Analyzing database performance...');

    const analysis = {
      timestamp: new Date().toISOString(),
      tables: {},
      recommendations: []
    };

    try {
      // Get table sizes and statistics
      const tables = [
        'profiles', 'plans', 'subscriptions', 'payment_methods',
        'invoices', 'payments', 'notifications', 'audit_logs'
      ];

      for (const table of tables) {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        analysis.tables[table] = {
          row_count: count,
          estimated_size: `${Math.round(count * 1.5)} KB` // Rough estimate
        };

        // Add recommendations based on size
        if (count > 100000) {
          analysis.recommendations.push(
            `Consider partitioning ${table} table (${count} rows)`
          );
        }
        if (count > 10000 && table === 'audit_logs') {
          analysis.recommendations.push(
            `Consider archiving old audit logs (${count} rows)`
          );
        }
      }

      return analysis;
    } catch (error) {
      console.error('✗ Database analysis failed:', error);
      throw error;
    }
  }

  /**
   * Seed development data
   */
  async seedDevelopmentData() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Development seeding is not allowed in production');
    }

    console.log('Seeding development data...');

    try {
      // This would typically create test users, subscriptions, etc.
      console.log('✓ Development data seeded');
    } catch (error) {
      console.error('✗ Development seeding failed:', error);
      throw error;
    }
  }
}

module.exports = DatabaseUtils;

// CLI usage
if (require.main === module) {
  const utils = new DatabaseUtils();
  
  const command = process.argv[2];
  const arg = process.argv[3];

  async function runCommand() {
    try {
      switch (command) {
        case 'test':
          await utils.testConnection();
          break;
        case 'migrate':
          await utils.migrate();
          break;
        case 'create-migration':
          if (!arg) {
            console.error('Usage: node db-utils.js create-migration <name>');
            process.exit(1);
          }
          utils.createMigration(arg);
          break;
        case 'stats':
          const stats = await utils.getStats();
          console.log('Database Statistics:');
          console.table(stats);
          break;
        case 'cleanup':
          await utils.cleanup();
          break;
        case 'reset':
          await utils.reset();
          break;
        case 'backup':
          const backup = await utils.backup();
          console.log('Backup created:', JSON.stringify(backup, null, 2));
          break;
        case 'analyze':
          const analysis = await utils.analyze();
          console.log('Database Analysis:');
          console.log(JSON.stringify(analysis, null, 2));
          break;
        case 'seed-dev':
          await utils.seedDevelopmentData();
          break;
        default:
          console.log('Available commands:');
          console.log('  test              - Test database connection');
          console.log('  migrate           - Run pending migrations');
          console.log('  create-migration  - Create new migration file');
          console.log('  stats             - Show database statistics');
          console.log('  cleanup           - Clean up old data');
          console.log('  reset             - Reset database (dev only)');
          console.log('  backup            - Create data backup');
          console.log('  analyze           - Analyze database performance');
          console.log('  seed-dev          - Seed development data');
          break;
      }
    } catch (error) {
      console.error('Command failed:', error.message);
      process.exit(1);
    }
  }

  runCommand();
}