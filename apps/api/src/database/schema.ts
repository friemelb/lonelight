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
    return;
  }

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
        updated_at TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(review_status IN ('pending_review', 'approved', 'rejected', 'corrected')),
        reviewed_at TEXT,
        reviewer_notes TEXT
      );

      CREATE INDEX idx_borrowers_updated_at ON borrowers(updated_at);
      CREATE INDEX idx_borrowers_review_status ON borrowers(review_status);
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

    // 6. Processing metrics table (observability)
    db.exec(`
      CREATE TABLE processing_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        duration_ms INTEGER,
        success INTEGER NOT NULL,
        error_message TEXT,
        metadata TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_metrics_document_id ON processing_metrics(document_id);
      CREATE INDEX idx_metrics_type ON processing_metrics(metric_type);
      CREATE INDEX idx_metrics_started_at ON processing_metrics(started_at);
      CREATE INDEX idx_metrics_success ON processing_metrics(success);
    `);

    // 7. Extraction attempts table (retry tracking)
    db.exec(`
      CREATE TABLE extraction_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        error_type TEXT,
        error_message TEXT,
        chunks_processed INTEGER,
        fields_extracted INTEGER,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_attempts_document_id ON extraction_attempts(document_id);
      CREATE INDEX idx_attempts_status ON extraction_attempts(status);
      CREATE INDEX idx_attempts_started_at ON extraction_attempts(started_at);
    `);

    // 8. Field corrections table (audit trail for human corrections)
    db.exec(`
      CREATE TABLE field_corrections (
        id TEXT PRIMARY KEY,
        borrower_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        original_value TEXT NOT NULL,
        corrected_value TEXT NOT NULL,
        original_confidence REAL NOT NULL,
        source_document_id TEXT NOT NULL,
        source_page INTEGER NOT NULL,
        original_evidence TEXT NOT NULL,
        correction_note TEXT,
        corrected_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE,
        FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_corrections_borrower_id ON field_corrections(borrower_id);
      CREATE INDEX idx_corrections_field_name ON field_corrections(borrower_id, field_name);
      CREATE INDEX idx_corrections_corrected_at ON field_corrections(corrected_at);
    `);

    // 9. Borrower review audit table (action log)
    db.exec(`
      CREATE TABLE borrower_review_audit (
        id TEXT PRIMARY KEY,
        borrower_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('approved', 'rejected', 'corrected', 'submitted_for_review')),
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        notes TEXT,
        action_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_review_audit_borrower_id ON borrower_review_audit(borrower_id);
      CREATE INDEX idx_review_audit_action_at ON borrower_review_audit(action_at);
      CREATE INDEX idx_review_audit_action ON borrower_review_audit(action);
    `);
  })();
}

/**
 * Migrate existing database to add review workflow support
 * Adds review columns to borrowers table and creates new audit tables
 */
export function migrateToReviewWorkflow(db: Database.Database): void {
  // Check if review_status column already exists
  const tableInfo = db
    .prepare("PRAGMA table_info(borrowers)")
    .all() as Array<{ name: string }>;

  const hasReviewStatus = tableInfo.some((col) => col.name === 'review_status');

  if (hasReviewStatus) {
    return;
  }

  db.transaction(() => {
    // Add review columns to borrowers table
    db.exec(`
      ALTER TABLE borrowers ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending_review';
      ALTER TABLE borrowers ADD COLUMN reviewed_at TEXT;
      ALTER TABLE borrowers ADD COLUMN reviewer_notes TEXT;
    `);

    // Create index for review_status
    db.exec(`
      CREATE INDEX idx_borrowers_review_status ON borrowers(review_status);
    `);

    // Create field_corrections table
    db.exec(`
      CREATE TABLE field_corrections (
        id TEXT PRIMARY KEY,
        borrower_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        original_value TEXT NOT NULL,
        corrected_value TEXT NOT NULL,
        original_confidence REAL NOT NULL,
        source_document_id TEXT NOT NULL,
        source_page INTEGER NOT NULL,
        original_evidence TEXT NOT NULL,
        correction_note TEXT,
        corrected_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE,
        FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_corrections_borrower_id ON field_corrections(borrower_id);
      CREATE INDEX idx_corrections_field_name ON field_corrections(borrower_id, field_name);
      CREATE INDEX idx_corrections_corrected_at ON field_corrections(corrected_at);
    `);

    // Create borrower_review_audit table
    db.exec(`
      CREATE TABLE borrower_review_audit (
        id TEXT PRIMARY KEY,
        borrower_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('approved', 'rejected', 'corrected', 'submitted_for_review')),
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        notes TEXT,
        action_at TEXT NOT NULL,
        FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_review_audit_borrower_id ON borrower_review_audit(borrower_id);
      CREATE INDEX idx_review_audit_action_at ON borrower_review_audit(action_at);
      CREATE INDEX idx_review_audit_action ON borrower_review_audit(action);
    `);
  })();
}
