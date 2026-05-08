import { ProcessingStatus } from './status.types';

/**
 * Metadata for an uploaded document in the system
 */
export interface DocumentRecord {
  /** Unique identifier for the document */
  id: string;

  /** Original filename as provided by user */
  filename: string;

  /** MIME type of the document */
  mimeType: string;

  /** File size in bytes */
  fileSize: number;

  /** Storage path or URL where document is stored */
  storagePath: string;

  /** Current processing status */
  status: ProcessingStatus;

  /** Upload timestamp */
  uploadedAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Total number of pages in document (if applicable) */
  pageCount?: number;

  /** Associated borrower ID (if linked) */
  borrowerId?: string;

  /** Error message if processing failed */
  errorMessage?: string;

  /** Processing metadata (OCR confidence, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * A chunk of extracted text from a document with page reference
 */
export interface DocumentChunk {
  /** Unique identifier for this chunk */
  id: string;

  /** ID of the parent document */
  documentId: string;

  /** Page number where this chunk appears (1-indexed) */
  pageNumber: number;

  /** Extracted text content */
  content: string;

  /** Chunk sequence number within the page */
  chunkIndex: number;

  /** Bounding box coordinates if available [x, y, width, height] */
  boundingBox?: [number, number, number, number];

  /** OCR confidence score (0-1) if applicable */
  confidence?: number;

  /** Extraction timestamp */
  extractedAt: Date;
}
