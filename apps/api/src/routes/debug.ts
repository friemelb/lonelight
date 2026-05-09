import { Router, Request, Response } from 'express';
import { getDatabase } from '@/database';
import { initializeSchema } from '@/database/schema';

export const debugRouter = Router();

/**
 * POST /api/debug/reset-database
 * Reset the database - DROP all tables and recreate schema
 * WARNING: This will delete all data!
 *
 * This is a debugging endpoint that provides a clean slate for testing
 * document ingestion and parsing workflows.
 */
debugRouter.post('/reset-database', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    console.log('🔄 Starting database reset...');

    // Drop all tables in correct order (reverse of foreign key dependencies)
    // Must respect foreign key constraints: child tables before parent tables
    db.transaction(() => {
      console.log('  → Dropping extraction_attempts table');
      db.exec('DROP TABLE IF EXISTS extraction_attempts');

      console.log('  → Dropping processing_metrics table');
      db.exec('DROP TABLE IF EXISTS processing_metrics');

      console.log('  → Dropping processing_errors table');
      db.exec('DROP TABLE IF EXISTS processing_errors');

      console.log('  → Dropping borrower_fields table');
      db.exec('DROP TABLE IF EXISTS borrower_fields');

      console.log('  → Dropping document_chunks table');
      db.exec('DROP TABLE IF EXISTS document_chunks');

      console.log('  → Dropping documents table');
      db.exec('DROP TABLE IF EXISTS documents');

      console.log('  → Dropping borrowers table');
      db.exec('DROP TABLE IF EXISTS borrowers');
    })();

    console.log('✅ All tables dropped successfully');

    // Reinitialize schema with clean tables
    initializeSchema(db);

    console.log('✅ Database schema recreated successfully');
    console.log('✅ Database reset complete - ready for fresh ingestion');

    res.status(200).json({
      success: true,
      message: 'Database has been reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reset database',
        details: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});
