/**
 * Extraction-related types for OpenAI-powered borrower data extraction
 */

import { BorrowerRecord } from './borrower.types';

/**
 * Source reference for an extracted field
 * Provides full traceability to the source document and chunk
 */
export interface ExtractionSourceReference {
  documentId: string;
  fileName: string;
  chunkId: string;
  quote: string;  // Direct quote from the source text
}

/**
 * Request body for extraction endpoint
 * Currently extraction processes all documents, so body is optional/empty
 */
export interface ExtractionRequest {
  // Future: could add documentIds?: string[] for selective extraction
}

/**
 * Individual extraction error
 */
export interface ExtractionError {
  documentId?: string;
  message: string;
  type: 'validation' | 'api' | 'parsing' | 'database';
  details?: unknown;
}

/**
 * Result of extraction operation for a single borrower
 */
export interface BorrowerExtractionResult {
  borrower: BorrowerRecord;
  documentIds: string[];  // Documents this borrower was extracted from
  extractedAt: Date;
}

/**
 * Response from extraction endpoint
 */
export interface ExtractionResponse {
  success: boolean;
  data: {
    borrowers: BorrowerExtractionResult[];
    stats: {
      totalDocuments: number;
      totalChunks: number;
      borrowersExtracted: number;
      durationMs: number;
    };
  };
  errors: ExtractionError[];
}

/**
 * Internal extraction result from service
 */
export interface ExtractionServiceResult {
  success: boolean;
  borrowers: BorrowerRecord[];
  error?: string;
  validationErrors?: string[];
  retryAttempted?: boolean;
}
