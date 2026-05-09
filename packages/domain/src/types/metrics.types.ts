/**
 * Types for processing metrics and observability
 */

/**
 * Metric type categories for processing pipeline
 */
export type MetricType = 'parsing' | 'chunking' | 'extraction' | 'ingestion';

/**
 * Processing metric record for tracking document processing performance
 */
export interface ProcessingMetric {
  /** Unique identifier for this metric */
  id?: number;

  /** ID of the document being processed */
  documentId: string;

  /** Type of processing operation */
  metricType: MetricType;

  /** When the operation started */
  startedAt: Date;

  /** When the operation completed (null if still in progress) */
  completedAt?: Date;

  /** Duration of the operation in milliseconds */
  durationMs?: number;

  /** Whether the operation succeeded */
  success: boolean;

  /** Error message if operation failed */
  errorMessage?: string;

  /** Additional metadata (JSON object) */
  metadata?: Record<string, unknown>;
}

/**
 * Status of an extraction attempt
 */
export type ExtractionStatus = 'in_progress' | 'success' | 'failed' | 'retrying';

/**
 * Extraction attempt record for tracking retry logic
 */
export interface ExtractionAttempt {
  /** Unique identifier for this attempt */
  id?: number;

  /** ID of the document being extracted */
  documentId: string;

  /** Attempt number (1 for first attempt, 2+ for retries) */
  attemptNumber: number;

  /** When the attempt started */
  startedAt: Date;

  /** When the attempt completed */
  completedAt?: Date;

  /** Current status of the attempt */
  status: ExtractionStatus;

  /** Type of error if failed */
  errorType?: string;

  /** Error message if failed */
  errorMessage?: string;

  /** Number of chunks processed in this attempt */
  chunksProcessed?: number;

  /** Number of fields extracted successfully */
  fieldsExtracted?: number;
}

/**
 * Summary statistics for dashboard metrics
 */
export interface MetricsSummary {
  /** Total documents in the system */
  totalDocuments: number;

  /** Documents by status */
  byStatus: {
    uploaded: number;
    processing: number;
    extracted: number;
    failed: number;
    completed: number;
  };

  /** Total number of chunks created */
  totalChunks: number;

  /** Average processing duration in milliseconds */
  avgProcessingTimeMs: number;

  /** Success rate as a percentage (0-100) */
  successRate: number;

  /** Count of recent errors (last 24 hours) */
  recentErrorCount: number;

  /** Most recent processing metrics */
  recentMetrics: ProcessingMetric[];

  /** Review workflow counts */
  reviewCounts: {
    pendingReview: number;
    approved: number;
    rejected: number;
    corrected: number;
  };
}
