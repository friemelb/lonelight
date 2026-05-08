import Database from 'better-sqlite3';
import { DocumentChunk } from '@loanlens/domain';
import { IChunkRepository } from './interfaces/IChunkRepository';

export class ChunkRepository implements IChunkRepository {
  constructor(private db: Database.Database) {}

  async create(chunk: DocumentChunk): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO document_chunks (
        id, document_id, page_number, content, chunk_index,
        bounding_box, confidence, extracted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      chunk.id,
      chunk.documentId,
      chunk.pageNumber,
      chunk.content,
      chunk.chunkIndex,
      chunk.boundingBox ? JSON.stringify(chunk.boundingBox) : null,
      chunk.confidence ?? null,
      chunk.extractedAt.toISOString()
    );
  }

  async createMany(chunks: DocumentChunk[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO document_chunks (
        id, document_id, page_number, content, chunk_index,
        bounding_box, confidence, extracted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: DocumentChunk[]) => {
      for (const chunk of items) {
        stmt.run(
          chunk.id,
          chunk.documentId,
          chunk.pageNumber,
          chunk.content,
          chunk.chunkIndex,
          chunk.boundingBox ? JSON.stringify(chunk.boundingBox) : null,
          chunk.confidence ?? null,
          chunk.extractedAt.toISOString()
        );
      }
    });

    transaction(chunks);
  }

  async findById(id: string): Promise<DocumentChunk | null> {
    const stmt = this.db.prepare('SELECT * FROM document_chunks WHERE id = ?');
    const row = stmt.get(id) as any;

    return row ? this.rowToChunk(row) : null;
  }

  async findByDocumentId(documentId: string): Promise<DocumentChunk[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM document_chunks
      WHERE document_id = ?
      ORDER BY page_number, chunk_index
    `);
    const rows = stmt.all(documentId) as any[];

    return rows.map(row => this.rowToChunk(row));
  }

  async findByPage(documentId: string, pageNumber: number): Promise<DocumentChunk[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM document_chunks
      WHERE document_id = ? AND page_number = ?
      ORDER BY chunk_index
    `);
    const rows = stmt.all(documentId, pageNumber) as any[];

    return rows.map(row => this.rowToChunk(row));
  }

  async searchContent(query: string, documentId?: string): Promise<DocumentChunk[]> {
    let sql = `
      SELECT * FROM document_chunks
      WHERE content LIKE ?
    `;
    const params: any[] = [`%${query}%`];

    if (documentId) {
      sql += ' AND document_id = ?';
      params.push(documentId);
    }

    sql += ' ORDER BY page_number, chunk_index';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.rowToChunk(row));
  }

  async update(id: string, updates: Partial<DocumentChunk>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    if (updates.boundingBox !== undefined) {
      fields.push('bounding_box = ?');
      values.push(updates.boundingBox ? JSON.stringify(updates.boundingBox) : null);
    }

    if (fields.length === 0) {
      return; // Nothing to update
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE document_chunks SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM document_chunks WHERE id = ?');
    stmt.run(id);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM document_chunks WHERE document_id = ?');
    stmt.run(documentId);
  }

  /**
   * Convert a database row to a DocumentChunk domain model
   */
  private rowToChunk(row: any): DocumentChunk {
    return {
      id: row.id,
      documentId: row.document_id,
      pageNumber: row.page_number,
      content: row.content,
      chunkIndex: row.chunk_index,
      boundingBox: row.bounding_box ? JSON.parse(row.bounding_box) : undefined,
      confidence: row.confidence ?? undefined,
      extractedAt: new Date(row.extracted_at)
    };
  }
}
