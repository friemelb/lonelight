import Database from 'better-sqlite3';
import { BorrowerRecord, ExtractedField, ReviewStatus, FieldCorrection } from '@loanlens/domain';
import { IBorrowerRepository } from './interfaces/IBorrowerRepository';
import { FindOptions } from './interfaces/IDocumentRepository';

export class BorrowerRepository implements IBorrowerRepository {
  constructor(private db: Database.Database) {}

  async create(borrower: BorrowerRecord): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Insert borrower with review status
      const borrowerStmt = this.db.prepare(`
        INSERT INTO borrowers (id, created_at, updated_at, review_status, reviewed_at, reviewer_notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      borrowerStmt.run(
        borrower.id,
        borrower.createdAt.toISOString(),
        borrower.updatedAt.toISOString(),
        borrower.reviewStatus || ReviewStatus.PENDING_REVIEW,
        borrower.reviewedAt ? borrower.reviewedAt.toISOString() : null,
        borrower.reviewerNotes || null
      );

      // Insert all extracted fields
      const fieldStmt = this.db.prepare(`
        INSERT INTO borrower_fields (
          borrower_id, field_name, field_type, field_value,
          confidence, source_document_id, source_page, evidence_quote,
          bounding_box, extracted_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Helper to insert a field
      const insertField = (
        fieldName: string,
        field: ExtractedField<any> | undefined,
        fieldType: string = 'string'
      ) => {
        if (!field) return;

        fieldStmt.run(
          borrower.id,
          fieldName,
          fieldType,
          String(field.value),
          field.confidence,
          field.sourceDocumentId,
          field.sourcePage,
          field.evidenceQuote,
          field.boundingBox ? JSON.stringify(field.boundingBox) : null,
          field.extractedAt ? field.extractedAt.toISOString() : null,
          field.notes || null
        );
      };

      // Insert all simple string fields
      insertField('fullName', borrower.fullName);
      insertField('firstName', borrower.firstName);
      insertField('middleName', borrower.middleName);
      insertField('lastName', borrower.lastName);
      insertField('ssn', borrower.ssn);
      insertField('dateOfBirth', borrower.dateOfBirth, 'date');
      insertField('phoneNumber', borrower.phoneNumber, 'phone');
      insertField('alternatePhoneNumber', borrower.alternatePhoneNumber, 'phone');
      insertField('email', borrower.email, 'email');

      // TODO: Handle currentAddress, previousAddresses, incomeHistory, accountNumbers, loanNumbers
      // These require more complex nested structure handling
    });

    transaction();
  }

  async findById(id: string): Promise<BorrowerRecord | null> {
    // Get borrower
    const borrowerStmt = this.db.prepare('SELECT * FROM borrowers WHERE id = ?');
    const borrowerRow = borrowerStmt.get(id) as any;

    if (!borrowerRow) {
      return null;
    }

    // Get all fields
    const fieldsStmt = this.db.prepare(`
      SELECT * FROM borrower_fields
      WHERE borrower_id = ?
      ORDER BY field_name
    `);
    const fieldRows = fieldsStmt.all(id) as any[];

    // Reconstruct borrower
    const borrower: BorrowerRecord = {
      id: borrowerRow.id,
      fullName: this.extractField(fieldRows, 'fullName')!,
      createdAt: new Date(borrowerRow.created_at),
      updatedAt: new Date(borrowerRow.updated_at),
      documentIds: [], // TODO: Get from documents table
      reviewStatus: borrowerRow.review_status as ReviewStatus,
      reviewedAt: borrowerRow.reviewed_at ? new Date(borrowerRow.reviewed_at) : undefined,
      reviewerNotes: borrowerRow.reviewer_notes || undefined
    };

    // Add optional fields
    const firstName = this.extractField(fieldRows, 'firstName');
    if (firstName) borrower.firstName = firstName;

    const middleName = this.extractField(fieldRows, 'middleName');
    if (middleName) borrower.middleName = middleName;

    const lastName = this.extractField(fieldRows, 'lastName');
    if (lastName) borrower.lastName = lastName;

    const ssn = this.extractField(fieldRows, 'ssn');
    if (ssn) borrower.ssn = ssn;

    const dateOfBirth = this.extractField(fieldRows, 'dateOfBirth');
    if (dateOfBirth) borrower.dateOfBirth = dateOfBirth;

    const phoneNumber = this.extractField(fieldRows, 'phoneNumber');
    if (phoneNumber) borrower.phoneNumber = phoneNumber;

    const alternatePhoneNumber = this.extractField(fieldRows, 'alternatePhoneNumber');
    if (alternatePhoneNumber) borrower.alternatePhoneNumber = alternatePhoneNumber;

    const email = this.extractField(fieldRows, 'email');
    if (email) borrower.email = email;

    return borrower;
  }

  async findAll(options: FindOptions = {}): Promise<BorrowerRecord[]> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;

    const columnMap: Record<string, string> = {
      updatedAt: 'updated_at',
      createdAt: 'created_at'
    };

    const stmt = this.db.prepare(`
      SELECT * FROM borrowers
      ORDER BY ${columnMap[sortBy] || 'updated_at'} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];

    // For each borrower, fetch full details
    const borrowers: BorrowerRecord[] = [];
    for (const row of rows) {
      const borrower = await this.findById(row.id);
      if (borrower) {
        borrowers.push(borrower);
      }
    }

    return borrowers;
  }

  async search(query: string): Promise<BorrowerRecord[]> {
    // Search in borrower_fields for matching values
    const stmt = this.db.prepare(`
      SELECT DISTINCT borrower_id FROM borrower_fields
      WHERE field_value LIKE ?
      LIMIT 20
    `);

    const rows = stmt.all(`%${query}%`) as any[];

    // Fetch full borrower details
    const borrowers: BorrowerRecord[] = [];
    for (const row of rows) {
      const borrower = await this.findById(row.borrower_id);
      if (borrower) {
        borrowers.push(borrower);
      }
    }

    return borrowers;
  }

  async count(): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM borrowers');
    const result = stmt.get() as { count: number };

    return result.count;
  }

  async update(id: string, borrower: BorrowerRecord): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Update borrower
      const borrowerStmt = this.db.prepare(`
        UPDATE borrowers
        SET updated_at = ?
        WHERE id = ?
      `);

      borrowerStmt.run(new Date().toISOString(), id);

      // Delete existing fields
      const deleteStmt = this.db.prepare(
        'DELETE FROM borrower_fields WHERE borrower_id = ?'
      );
      deleteStmt.run(id);

      // Re-insert all fields (simpler than selective update)
      const fieldStmt = this.db.prepare(`
        INSERT INTO borrower_fields (
          borrower_id, field_name, field_type, field_value,
          confidence, source_document_id, source_page, evidence_quote,
          bounding_box, extracted_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertField = (
        fieldName: string,
        field: ExtractedField<any> | undefined,
        fieldType: string = 'string'
      ) => {
        if (!field) return;

        fieldStmt.run(
          id,
          fieldName,
          fieldType,
          String(field.value),
          field.confidence,
          field.sourceDocumentId,
          field.sourcePage,
          field.evidenceQuote,
          field.boundingBox ? JSON.stringify(field.boundingBox) : null,
          field.extractedAt ? field.extractedAt.toISOString() : null,
          field.notes || null
        );
      };

      // Re-insert all fields
      insertField('fullName', borrower.fullName);
      insertField('firstName', borrower.firstName);
      insertField('middleName', borrower.middleName);
      insertField('lastName', borrower.lastName);
      insertField('ssn', borrower.ssn);
      insertField('dateOfBirth', borrower.dateOfBirth, 'date');
      insertField('phoneNumber', borrower.phoneNumber, 'phone');
      insertField('alternatePhoneNumber', borrower.alternatePhoneNumber, 'phone');
      insertField('email', borrower.email, 'email');
    });

    transaction();
  }

  async delete(id: string): Promise<void> {
    // Cascade delete will handle borrower_fields
    const stmt = this.db.prepare('DELETE FROM borrowers WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Find a borrower by full name or SSN
   * First tries to match by SSN (if provided), then falls back to normalized full name
   */
  async findByFullNameOrSSN(fullName: string, ssn?: string): Promise<BorrowerRecord | null> {
    // Try to find by SSN first (most reliable)
    if (ssn && ssn.trim() !== '') {
      const ssnStmt = this.db.prepare(`
        SELECT borrower_id FROM borrower_fields
        WHERE field_name = 'ssn' AND field_value = ?
        LIMIT 1
      `);
      const ssnRow = ssnStmt.get(ssn) as any;

      if (ssnRow) {
        return await this.findById(ssnRow.borrower_id);
      }
    }

    // Fall back to normalized full name match
    const normalizedName = fullName.toLowerCase().trim();

    const nameStmt = this.db.prepare(`
      SELECT borrower_id FROM borrower_fields
      WHERE field_name = 'fullName' AND LOWER(TRIM(field_value)) = ?
      LIMIT 1
    `);
    const nameRow = nameStmt.get(normalizedName) as any;

    if (nameRow) {
      return await this.findById(nameRow.borrower_id);
    }

    return null;
  }

  /**
   * Upsert a borrower - update if exists (by SSN or full name), create if not
   * Merges data with existing borrower, keeping higher confidence values
   */
  async upsert(borrower: BorrowerRecord): Promise<void> {
    // Check if borrower already exists
    const existing = await this.findByFullNameOrSSN(
      borrower.fullName.value,
      borrower.ssn?.value
    );

    if (existing) {
      // Merge with existing borrower
      const merged = this.mergeBorrowerRecords(existing, borrower);
      await this.update(existing.id, merged);
    } else {
      // Create new borrower
      await this.create(borrower);
    }
  }

  /**
   * Merge two borrower records, keeping higher confidence values
   * Adapted from ExtractionService merge logic
   */
  private mergeBorrowerRecords(existing: BorrowerRecord, incoming: BorrowerRecord): BorrowerRecord {
    const mergeField = <T extends { confidence: number }>(
      fieldA: T | undefined,
      fieldB: T | undefined
    ): T | undefined => {
      if (!fieldA) return fieldB;
      if (!fieldB) return fieldA;
      return fieldA.confidence >= fieldB.confidence ? fieldA : fieldB;
    };

    return {
      ...existing,
      // Keep field with higher confidence
      fullName: existing.fullName.confidence >= incoming.fullName.confidence
        ? existing.fullName
        : incoming.fullName,
      firstName: mergeField(existing.firstName, incoming.firstName),
      middleName: mergeField(existing.middleName, incoming.middleName),
      lastName: mergeField(existing.lastName, incoming.lastName),
      ssn: mergeField(existing.ssn, incoming.ssn),
      dateOfBirth: mergeField(existing.dateOfBirth, incoming.dateOfBirth),
      phoneNumber: mergeField(existing.phoneNumber, incoming.phoneNumber),
      alternatePhoneNumber: mergeField(existing.alternatePhoneNumber, incoming.alternatePhoneNumber),
      email: mergeField(existing.email, incoming.email),
      currentAddress: mergeField(existing.currentAddress, incoming.currentAddress),

      // Combine arrays (deduplicate by value)
      previousAddresses: this.mergeAddressArrays(
        existing.previousAddresses,
        incoming.previousAddresses
      ),
      accountNumbers: this.mergeArrayFields(existing.accountNumbers, incoming.accountNumbers),
      loanNumbers: this.mergeArrayFields(existing.loanNumbers, incoming.loanNumbers),

      // Combine document IDs (no duplicates)
      documentIds: [...new Set([...existing.documentIds, ...incoming.documentIds])],

      // Keep most recent timestamps
      updatedAt: new Date()
    };
  }

  /**
   * Merge array fields, deduplicating by value
   */
  private mergeArrayFields<T extends { value: string | number }>(
    arrA: T[] | undefined,
    arrB: T[] | undefined
  ): T[] | undefined {
    if (!arrA && !arrB) return undefined;
    if (!arrA) return arrB;
    if (!arrB) return arrA;

    const seen = new Set<string | number>();
    const result: T[] = [];

    for (const item of [...arrA, ...arrB]) {
      if (!seen.has(item.value)) {
        seen.add(item.value);
        result.push(item);
      }
    }

    return result.length > 0 ? result : undefined;
  }

  /**
   * Merge address arrays (addresses are complex objects, so we use JSON stringify for deduplication)
   */
  private mergeAddressArrays<T>(arrA: T[] | undefined, arrB: T[] | undefined): T[] | undefined {
    if (!arrA && !arrB) return undefined;
    if (!arrA) return arrB;
    if (!arrB) return arrA;

    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of [...arrA, ...arrB]) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result.length > 0 ? result : undefined;
  }

  /**
   * Extract an ExtractedField from field rows
   */
  private extractField(
    rows: any[],
    fieldName: string
  ): ExtractedField<string> | undefined {
    const row = rows.find(r => r.field_name === fieldName);
    if (!row) return undefined;

    return {
      value: row.field_value,
      confidence: row.confidence,
      sourceDocumentId: row.source_document_id,
      sourcePage: row.source_page,
      evidenceQuote: row.evidence_quote,
      boundingBox: row.bounding_box ? JSON.parse(row.bounding_box) : undefined,
      extractedAt: row.extracted_at ? new Date(row.extracted_at) : undefined,
      notes: row.notes || undefined
    };
  }

  /**
   * Update the review status of a borrower
   */
  async updateReviewStatus(
    id: string,
    status: ReviewStatus,
    notes?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE borrowers
      SET review_status = ?,
          reviewed_at = ?,
          reviewer_notes = ?,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      status,
      new Date().toISOString(),
      notes || null,
      new Date().toISOString(),
      id
    );
  }

  /**
   * Find borrowers by review status with pagination
   */
  async findByReviewStatus(
    status: ReviewStatus,
    options: FindOptions = {}
  ): Promise<BorrowerRecord[]> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const sortBy = options.sortBy || 'updatedAt';
    const sortOrder = options.sortOrder || 'desc';

    // Map sortBy to actual column name
    const sortColumn = sortBy === 'updatedAt' ? 'updated_at' : 'created_at';

    const stmt = this.db.prepare(`
      SELECT id FROM borrowers
      WHERE review_status = ?
      ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(status, limit, offset) as Array<{ id: string }>;

    // Fetch full borrower records
    const borrowers: BorrowerRecord[] = [];
    for (const row of rows) {
      const borrower = await this.findById(row.id);
      if (borrower) {
        borrowers.push(borrower);
      }
    }

    return borrowers;
  }

  /**
   * Get the history of corrections for a specific field
   */
  async getFieldHistory(
    borrowerId: string,
    fieldName: string
  ): Promise<FieldCorrection[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM field_corrections
      WHERE borrower_id = ? AND field_name = ?
      ORDER BY corrected_at DESC
    `);

    const rows = stmt.all(borrowerId, fieldName) as any[];

    return rows.map(row => ({
      id: row.id,
      borrowerId: row.borrower_id,
      fieldName: row.field_name,
      originalValue: row.original_value,
      correctedValue: row.corrected_value,
      originalConfidence: row.original_confidence,
      sourceDocumentId: row.source_document_id,
      sourcePage: row.source_page,
      originalEvidence: row.original_evidence,
      correctionNote: row.correction_note || undefined,
      correctedAt: new Date(row.corrected_at)
    }));
  }

  /**
   * Count borrowers by review status
   */
  async countByReviewStatus(status: ReviewStatus): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM borrowers
      WHERE review_status = ?
    `);

    const result = stmt.get(status) as { count: number };
    return result.count;
  }
}
