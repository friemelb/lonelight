import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { FieldCorrection, ReviewAction, ReviewStatus, ExtractedField } from '@loanlens/domain';

export class ReviewRepository {
  constructor(private db: Database.Database) {}

  /**
   * Create a field correction record
   */
  async createFieldCorrection(
    borrowerId: string,
    fieldName: string,
    originalField: ExtractedField,
    correctedValue: string,
    correctionNote?: string
  ): Promise<FieldCorrection> {
    const correction: FieldCorrection = {
      id: randomUUID(),
      borrowerId,
      fieldName,
      originalValue: originalField.value,
      correctedValue,
      originalConfidence: originalField.confidence,
      sourceDocumentId: originalField.sourceDocumentId,
      sourcePage: originalField.sourcePage,
      originalEvidence: originalField.evidenceQuote,
      correctionNote,
      correctedAt: new Date()
    };

    const stmt = this.db.prepare(`
      INSERT INTO field_corrections (
        id, borrower_id, field_name, original_value, corrected_value,
        original_confidence, source_document_id, source_page,
        original_evidence, correction_note, corrected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      correction.id,
      correction.borrowerId,
      correction.fieldName,
      correction.originalValue,
      correction.correctedValue,
      correction.originalConfidence,
      correction.sourceDocumentId,
      correction.sourcePage,
      correction.originalEvidence,
      correction.correctionNote || null,
      correction.correctedAt.toISOString()
    );

    return correction;
  }

  /**
   * Get all corrections for a borrower
   */
  async getCorrectionsForBorrower(borrowerId: string): Promise<FieldCorrection[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM field_corrections
      WHERE borrower_id = ?
      ORDER BY corrected_at DESC
    `);

    const rows = stmt.all(borrowerId) as any[];

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
   * Create a review audit log entry
   */
  async createReviewAction(
    borrowerId: string,
    action: 'approved' | 'rejected' | 'corrected' | 'submitted_for_review',
    previousStatus: ReviewStatus,
    newStatus: ReviewStatus,
    notes?: string
  ): Promise<ReviewAction> {
    const reviewAction: ReviewAction = {
      id: randomUUID(),
      borrowerId,
      action,
      previousStatus,
      newStatus,
      notes,
      actionAt: new Date()
    };

    const stmt = this.db.prepare(`
      INSERT INTO borrower_review_audit (
        id, borrower_id, action, previous_status, new_status, notes, action_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      reviewAction.id,
      reviewAction.borrowerId,
      reviewAction.action,
      reviewAction.previousStatus,
      reviewAction.newStatus,
      reviewAction.notes || null,
      reviewAction.actionAt.toISOString()
    );

    return reviewAction;
  }

  /**
   * Get audit history for a borrower
   */
  async getAuditHistory(borrowerId: string): Promise<ReviewAction[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM borrower_review_audit
      WHERE borrower_id = ?
      ORDER BY action_at DESC
    `);

    const rows = stmt.all(borrowerId) as any[];

    return rows.map(row => ({
      id: row.id,
      borrowerId: row.borrower_id,
      action: row.action as ReviewAction['action'],
      previousStatus: row.previous_status as ReviewStatus,
      newStatus: row.new_status as ReviewStatus,
      notes: row.notes || undefined,
      actionAt: new Date(row.action_at)
    }));
  }

  /**
   * Get recent review actions across all borrowers
   */
  async getRecentReviewActions(limit: number = 50): Promise<ReviewAction[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM borrower_review_audit
      ORDER BY action_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      borrowerId: row.borrower_id,
      action: row.action as ReviewAction['action'],
      previousStatus: row.previous_status as ReviewStatus,
      newStatus: row.new_status as ReviewStatus,
      notes: row.notes || undefined,
      actionAt: new Date(row.action_at)
    }));
  }
}
