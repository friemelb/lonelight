import Database from 'better-sqlite3';

/**
 * Initialize the database schema
 * Creates all tables and indexes if they don't exist
 */
export function initializeSchema(db: Database.Database): void {
  // Check if schema already exists
  const tableCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    .get() as { count: number };

  if (tableCount.count > 0) {
    console.log('Database schema already initialized');
    return;
  }

  console.log('Initializing database schema...');

  // Run all CREATE TABLE statements in a transaction
  db.transaction(() => {
    // 1. Documents table
    db.exec(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTED', 'ANALYZING', 'COMPLETED', 'FAILED', 'ERROR')),
        uploaded_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        page_count INTEGER,
        borrower_id TEXT,
        error_message TEXT,
        metadata TEXT,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_documents_borrower_id ON documents(borrower_id);
      CREATE INDEX idx_documents_status ON documents(status);
      CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at);
    `);

    // 2. Document chunks table
    db.exec(`
      CREATE TABLE document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        bounding_box TEXT,
        confidence REAL,
        extracted_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
      CREATE INDEX idx_chunks_page_number ON document_chunks(document_id, page_number);
    `);

    // 3. Borrowers table
    db.exec(`
      CREATE TABLE borrowers (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_borrowers_updated_at ON borrowers(updated_at);
    `);

    // 4. Borrower fields table (stores ExtractedField data)
    db.exec(`
      CREATE TABLE borrower_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        borrower_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        field_value TEXT NOT NULL,
        confidence REAL NOT NULL,
        source_document_id TEXT NOT NULL,
        source_page INTEGER NOT NULL,
        evidence_quote TEXT NOT NULL,
        bounding_box TEXT,
        extracted_at TEXT,
        notes TEXT,
        parent_field_id INTEGER,
        array_index INTEGER,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE,
        FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE RESTRICT,
        FOREIGN KEY (parent_field_id) REFERENCES borrower_fields(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_borrower_fields_borrower_id ON borrower_fields(borrower_id);
      CREATE INDEX idx_borrower_fields_field_name ON borrower_fields(borrower_id, field_name);
      CREATE INDEX idx_borrower_fields_source_doc ON borrower_fields(source_document_id);
    `);

    // 5. Processing errors table
    db.exec(`
      CREATE TABLE processing_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT,
        borrower_id TEXT,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        context TEXT,
        occurred_at TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_errors_document_id ON processing_errors(document_id);
      CREATE INDEX idx_errors_borrower_id ON processing_errors(borrower_id);
      CREATE INDEX idx_errors_occurred_at ON processing_errors(occurred_at);
      CREATE INDEX idx_errors_resolved ON processing_errors(resolved);
    `);

    console.log('✅ Database schema initialized successfully');
  })();
}
