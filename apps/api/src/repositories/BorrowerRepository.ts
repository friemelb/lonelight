import Database from 'better-sqlite3';
import { BorrowerRecord, ExtractedField } from '@loanlens/domain';
import { IBorrowerRepository } from './interfaces/IBorrowerRepository';
import { FindOptions } from './interfaces/IDocumentRepository';

export class BorrowerRepository implements IBorrowerRepository {
  constructor(private db: Database.Database) {}

  async create(borrower: BorrowerRecord): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Insert borrower
      const borrowerStmt = this.db.prepare(`
        INSERT INTO borrowers (id, created_at, updated_at)
        VALUES (?, ?, ?)
      `);

      borrowerStmt.run(
        borrower.id,
        borrower.createdAt.toISOString(),
        borrower.updatedAt.toISOString()
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
      documentIds: [] // TODO: Get from documents table
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
}
