import Database from 'better-sqlite3';
import { IErrorRepository, ProcessingError } from './interfaces/IErrorRepository';

export class ErrorRepository implements IErrorRepository {
  constructor(private db: Database.Database) {}

  async create(error: Omit<ProcessingError, 'id'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO processing_errors (
        document_id, borrower_id, error_type, error_message,
        error_stack, context, occurred_at, resolved, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      error.documentId || null,
      error.borrowerId || null,
      error.errorType,
      error.errorMessage,
      error.errorStack || null,
      error.context ? JSON.stringify(error.context) : null,
      error.occurredAt.toISOString(),
      error.resolved ? 1 : 0,
      error.resolvedAt ? error.resolvedAt.toISOString() : null
    );
  }

  async findById(id: number): Promise<ProcessingError | null> {
    const stmt = this.db.prepare('SELECT * FROM processing_errors WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.rowToError(row) : null;
  }

  async findByDocumentId(documentId: string): Promise<ProcessingError[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM processing_errors
      WHERE document_id = ?
      ORDER BY occurred_at DESC
    `);
    const rows = stmt.all(documentId) as any[];

    return rows.map(row => this.rowToError(row));
  }

  async findByBorrowerId(borrowerId: string): Promise<ProcessingError[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM processing_errors
      WHERE borrower_id = ?
      ORDER BY occurred_at DESC
    `);
    const rows = stmt.all(borrowerId) as any[];

    return rows.map(row => this.rowToError(row));
  }

  async findUnresolved(): Promise<ProcessingError[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM processing_errors
      WHERE resolved = 0
      ORDER BY occurred_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map(row => this.rowToError(row));
  }

  async markResolved(id: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE processing_errors
      SET resolved = 1, resolved_at = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), id);
  }

  async delete(id: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM processing_errors WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Convert a database row to a ProcessingError
   */
  private rowToError(row: any): ProcessingError {
    return {
      id: row.id,
      documentId: row.document_id || undefined,
      borrowerId: row.borrower_id || undefined,
      errorType: row.error_type,
      errorMessage: row.error_message,
      errorStack: row.error_stack || undefined,
      context: row.context ? JSON.parse(row.context) : undefined,
      occurredAt: new Date(row.occurred_at),
      resolved: row.resolved === 1,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined
    };
  }
}
