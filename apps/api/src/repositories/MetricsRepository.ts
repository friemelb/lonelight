import Database from 'better-sqlite3';
import {
  ProcessingMetric,
  ExtractionAttempt,
  MetricsSummary,
  ProcessingStatus
} from '@loanlens/domain';

export class MetricsRepository {
  constructor(private db: Database.Database) {}

  /**
   * Create a processing metric record
   */
  async createProcessingMetric(metric: ProcessingMetric): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO processing_metrics (
        document_id, metric_type, started_at, completed_at,
        duration_ms, success, error_message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metric.documentId,
      metric.metricType,
      metric.startedAt.toISOString(),
      metric.completedAt?.toISOString() || null,
      metric.durationMs ?? null,
      metric.success ? 1 : 0,
      metric.errorMessage || null,
      metric.metadata ? JSON.stringify(metric.metadata) : null
    );
  }

  /**
   * Create an extraction attempt record
   */
  async createExtractionAttempt(attempt: ExtractionAttempt): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO extraction_attempts (
        document_id, attempt_number, started_at, completed_at,
        status, error_type, error_message, chunks_processed, fields_extracted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      attempt.documentId,
      attempt.attemptNumber,
      attempt.startedAt.toISOString(),
      attempt.completedAt?.toISOString() || null,
      attempt.status,
      attempt.errorType || null,
      attempt.errorMessage || null,
      attempt.chunksProcessed ?? null,
      attempt.fieldsExtracted ?? null
    );
  }

  /**
   * Get all metrics for a specific document
   */
  async getMetricsByDocumentId(documentId: string): Promise<ProcessingMetric[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM processing_metrics
      WHERE document_id = ?
      ORDER BY started_at DESC
    `);
    const rows = stmt.all(documentId) as any[];

    return rows.map(row => this.rowToMetric(row));
  }

  /**
   * Get extraction attempts for a specific document
   */
  async getExtractionAttempts(documentId: string): Promise<ExtractionAttempt[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM extraction_attempts
      WHERE document_id = ?
      ORDER BY attempt_number ASC
    `);
    const rows = stmt.all(documentId) as any[];

    return rows.map(row => this.rowToAttempt(row));
  }

  /**
   * Get summary metrics for the dashboard
   */
  async getMetricsSummary(): Promise<MetricsSummary> {
    // Get total document count
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM documents');
    const totalResult = totalStmt.get() as { count: number };
    const totalDocuments = totalResult.count;

    // Get documents by status
    const statusStmt = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM documents
      GROUP BY status
    `);
    const statusRows = statusStmt.all() as Array<{ status: ProcessingStatus; count: number }>;

    const byStatus = {
      uploaded: 0,
      processing: 0,
      extracted: 0,
      failed: 0,
      completed: 0
    };

    for (const row of statusRows) {
      const status = row.status.toLowerCase() as keyof typeof byStatus;
      if (status in byStatus) {
        byStatus[status] = row.count;
      }
    }

    // Get total chunks
    const chunksStmt = this.db.prepare('SELECT COUNT(*) as count FROM document_chunks');
    const chunksResult = chunksStmt.get() as { count: number };
    const totalChunks = chunksResult.count;

    // Get average processing time (successful operations only)
    const avgStmt = this.db.prepare(`
      SELECT AVG(duration_ms) as avg_duration
      FROM processing_metrics
      WHERE success = 1 AND duration_ms IS NOT NULL
    `);
    const avgResult = avgStmt.get() as { avg_duration: number | null };
    const avgProcessingTimeMs = avgResult.avg_duration ? Math.round(avgResult.avg_duration) : 0;

    // Calculate success rate
    const successStmt = this.db.prepare(`
      SELECT
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful,
        COUNT(*) as total
      FROM processing_metrics
    `);
    const successResult = successStmt.get() as { successful: number; total: number };
    const successRate = successResult.total > 0
      ? (successResult.successful / successResult.total) * 100
      : 0;

    // Get recent errors count (last 24 hours)
    const errorStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM processing_errors
      WHERE occurred_at >= datetime('now', '-24 hours')
    `);
    const errorResult = errorStmt.get() as { count: number };
    const recentErrorCount = errorResult.count;

    // Get recent metrics (last 10)
    const recentStmt = this.db.prepare(`
      SELECT * FROM processing_metrics
      ORDER BY started_at DESC
      LIMIT 10
    `);
    const recentRows = recentStmt.all() as any[];
    const recentMetrics = recentRows.map(row => this.rowToMetric(row));

    return {
      totalDocuments,
      byStatus,
      totalChunks,
      avgProcessingTimeMs,
      successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal place
      recentErrorCount,
      recentMetrics
    };
  }

  /**
   * Get recent processing errors with details
   */
  async getRecentErrors(limit: number = 10): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT
        e.*,
        d.filename,
        d.status
      FROM processing_errors e
      LEFT JOIN documents d ON e.document_id = d.id
      WHERE e.resolved = 0
      ORDER BY e.occurred_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      documentId: row.document_id,
      filename: row.filename,
      documentStatus: row.status,
      errorType: row.error_type,
      errorMessage: row.error_message,
      occurredAt: new Date(row.occurred_at)
    }));
  }

  /**
   * Convert a database row to a ProcessingMetric domain model
   */
  private rowToMetric(row: any): ProcessingMetric {
    return {
      id: row.id,
      documentId: row.document_id,
      metricType: row.metric_type,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      durationMs: row.duration_ms ?? undefined,
      success: row.success === 1,
      errorMessage: row.error_message || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * Convert a database row to an ExtractionAttempt domain model
   */
  private rowToAttempt(row: any): ExtractionAttempt {
    return {
      id: row.id,
      documentId: row.document_id,
      attemptNumber: row.attempt_number,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      status: row.status,
      errorType: row.error_type || undefined,
      errorMessage: row.error_message || undefined,
      chunksProcessed: row.chunks_processed ?? undefined,
      fieldsExtracted: row.fields_extracted ?? undefined
    };
  }
}
