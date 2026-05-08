import Database from 'better-sqlite3';
import { DocumentRecord, ProcessingStatus } from '@loanlens/domain';
import {
  IDocumentRepository,
  FindOptions,
  DocumentFilters
} from './interfaces/IDocumentRepository';

export class DocumentRepository implements IDocumentRepository {
  constructor(private db: Database.Database) {}

  async create(document: DocumentRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO documents (
        id, filename, mime_type, file_size, storage_path, status,
        uploaded_at, updated_at, page_count, borrower_id, error_message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      document.id,
      document.filename,
      document.mimeType,
      document.fileSize,
      document.storagePath,
      document.status,
      document.uploadedAt.toISOString(),
      document.updatedAt.toISOString(),
      document.pageCount || null,
      document.borrowerId || null,
      document.errorMessage || null,
      document.metadata ? JSON.stringify(document.metadata) : null
    );
  }

  async createMany(documents: DocumentRecord[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO documents (
        id, filename, mime_type, file_size, storage_path, status,
        uploaded_at, updated_at, page_count, borrower_id, error_message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((docs: DocumentRecord[]) => {
      for (const doc of docs) {
        stmt.run(
          doc.id,
          doc.filename,
          doc.mimeType,
          doc.fileSize,
          doc.storagePath,
          doc.status,
          doc.uploadedAt.toISOString(),
          doc.updatedAt.toISOString(),
          doc.pageCount || null,
          doc.borrowerId || null,
          doc.errorMessage || null,
          doc.metadata ? JSON.stringify(doc.metadata) : null
        );
      }
    });

    transaction(documents);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.rowToDocument(row) : null;
  }

  async findAll(
    options: FindOptions = {},
    filters: DocumentFilters = {}
  ): Promise<DocumentRecord[]> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    } = options;

    let query = 'SELECT * FROM documents WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.borrowerId) {
      query += ' AND borrower_id = ?';
      params.push(filters.borrowerId);
    }

    if (filters.uploadedAfter) {
      query += ' AND uploaded_at >= ?';
      params.push(filters.uploadedAfter.toISOString());
    }

    if (filters.uploadedBefore) {
      query += ' AND uploaded_at <= ?';
      params.push(filters.uploadedBefore.toISOString());
    }

    // Map sortBy to column name
    const columnMap: Record<string, string> = {
      uploadedAt: 'uploaded_at',
      updatedAt: 'updated_at',
      filename: 'filename'
    };

    query += ` ORDER BY ${columnMap[sortBy]} ${sortOrder.toUpperCase()}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.rowToDocument(row));
  }

  async findByBorrowerId(borrowerId: string): Promise<DocumentRecord[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM documents WHERE borrower_id = ? ORDER BY uploaded_at DESC'
    );
    const rows = stmt.all(borrowerId) as any[];

    return rows.map(row => this.rowToDocument(row));
  }

  async findByStatus(status: ProcessingStatus): Promise<DocumentRecord[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM documents WHERE status = ? ORDER BY uploaded_at DESC'
    );
    const rows = stmt.all(status) as any[];

    return rows.map(row => this.rowToDocument(row));
  }

  async count(filters: DocumentFilters = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM documents WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.borrowerId) {
      query += ' AND borrower_id = ?';
      params.push(filters.borrowerId);
    }

    if (filters.uploadedAfter) {
      query += ' AND uploaded_at >= ?';
      params.push(filters.uploadedAfter.toISOString());
    }

    if (filters.uploadedBefore) {
      query += ' AND uploaded_at <= ?';
      params.push(filters.uploadedBefore.toISOString());
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };

    return result.count;
  }

  async update(id: string, updates: Partial<DocumentRecord>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.filename !== undefined) {
      fields.push('filename = ?');
      values.push(updates.filename);
    }

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.borrowerId !== undefined) {
      fields.push('borrower_id = ?');
      values.push(updates.borrowerId);
    }

    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }

    if (updates.pageCount !== undefined) {
      fields.push('page_count = ?');
      values.push(updates.pageCount);
    }

    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
    }

    // Always update updated_at
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (fields.length === 1) {
      // Only updated_at changed, nothing to do
      return;
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE documents SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  async updateStatus(
    id: string,
    status: ProcessingStatus,
    errorMessage?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE documents
      SET status = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(status, errorMessage || null, new Date().toISOString(), id);
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?');
    stmt.run(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(
      `DELETE FROM documents WHERE id IN (${placeholders})`
    );

    stmt.run(...ids);
  }

  /**
   * Convert a database row to a DocumentRecord domain model
   */
  private rowToDocument(row: any): DocumentRecord {
    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      storagePath: row.storage_path,
      status: row.status as ProcessingStatus,
      uploadedAt: new Date(row.uploaded_at),
      updatedAt: new Date(row.updated_at),
      pageCount: row.page_count || undefined,
      borrowerId: row.borrower_id || undefined,
      errorMessage: row.error_message || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
}
