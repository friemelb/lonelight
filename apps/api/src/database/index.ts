import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '@/config';
import { initializeSchema, migrateToReviewWorkflow } from './schema';

let db: Database.Database | null = null;

/**
 * Get the singleton database connection
 * Initializes the database and schema on first call
 */
export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = config.databasePath;

    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath, {
      verbose: config.databaseVerbose ? console.log : undefined
    });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Initialize schema
    initializeSchema(db);

    // Run migrations
    migrateToReviewWorkflow(db);

    console.log(`✅ Database connected: ${dbPath}`);
  }

  return db;
}

/**
 * Close the database connection
 * Should be called during graceful shutdown
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Get an in-memory database for testing
 * Creates a fresh database with schema initialized
 */
export function getTestDatabase(): Database.Database {
  const testDb = new Database(':memory:');

  testDb.pragma('foreign_keys = ON');
  initializeSchema(testDb);
  migrateToReviewWorkflow(testDb);

  return testDb;
}
