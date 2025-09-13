/**
 * Database Migration Runner
 * Handles running database migrations for Supabase
 */

const { supabase } = require('../../config/supabase');
const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor() {
    this.migrationsPath = __dirname;
    this.migrationTable = 'schema_migrations';
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable() {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(255)
        );
      `
    });

    if (error) {
      console.error('Error creating migration table:', error);
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations() {
    const { data, error } = await supabase
      .from(this.migrationTable)
      .select('version')
      .order('version');

    if (error) {
      console.error('Error fetching executed migrations:', error);
      throw error;
    }

    return data.map(row => row.version);
  }

  /**
   * Get list of available migration files
   */
  getAvailableMigrations() {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.match(/^\d{14}_.*\.sql$/))
      .sort();

    return files.map(file => ({
      version: file.substring(0, 14),
      name: file.substring(15, file.length - 4),
      filename: file,
      path: path.join(this.migrationsPath, file)
    }));
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration) {
    console.log(`Executing migration: ${migration.filename}`);

    const sql = fs.readFileSync(migration.path, 'utf8');
    
    // Calculate checksum
    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update(sql).digest('hex');

    try {
      // Execute the migration SQL
      const { error: sqlError } = await supabase.rpc('exec_sql', { sql });
      
      if (sqlError) {
        throw sqlError;
      }

      // Record the migration as executed
      const { error: recordError } = await supabase
        .from(this.migrationTable)
        .insert({
          version: migration.version,
          name: migration.name,
          checksum: checksum
        });

      if (recordError) {
        throw recordError;
      }

      console.log(`✓ Migration ${migration.filename} executed successfully`);
    } catch (error) {
      console.error(`✗ Migration ${migration.filename} failed:`, error);
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations() {
    try {
      console.log('Initializing migration system...');
      await this.initializeMigrationTable();

      console.log('Checking for pending migrations...');
      const executed = await this.getExecutedMigrations();
      const available = this.getAvailableMigrations();

      const pending = available.filter(
        migration => !executed.includes(migration.version)
      );

      if (pending.length === 0) {
        console.log('No pending migrations found.');
        return;
      }

      console.log(`Found ${pending.length} pending migrations:`);
      pending.forEach(migration => {
        console.log(`  - ${migration.filename}`);
      });

      // Execute migrations in order
      for (const migration of pending) {
        await this.executeMigration(migration);
      }

      console.log('All migrations completed successfully!');
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  }

  /**
   * Create a new migration file
   */
  createMigration(name) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .substring(0, 14);
    
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add description here

-- Up migration
BEGIN;

-- Add your SQL here

COMMIT;

-- Down migration (for rollback reference)
/*
BEGIN;

-- Add rollback SQL here

COMMIT;
*/
`;

    fs.writeFileSync(filepath, template);
    console.log(`Created migration file: ${filename}`);
    return filename;
  }
}

module.exports = MigrationRunner;

// CLI usage
if (require.main === module) {
  const runner = new MigrationRunner();
  
  const command = process.argv[2];
  const name = process.argv[3];

  switch (command) {
    case 'run':
      runner.runMigrations();
      break;
    case 'create':
      if (!name) {
        console.error('Usage: node migration-runner.js create <migration_name>');
        process.exit(1);
      }
      runner.createMigration(name);
      break;
    default:
      console.log('Usage:');
      console.log('  node migration-runner.js run           - Run pending migrations');
      console.log('  node migration-runner.js create <name> - Create new migration');
      break;
  }
}