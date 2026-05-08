/**
 * Enum representing the various stages of document processing
 * in the extraction pipeline
 */
export enum ProcessingStatus {
  /** Document has been uploaded but not yet queued */
  UPLOADED = 'UPLOADED',

  /** Document is waiting in the processing queue */
  QUEUED = 'QUEUED',

  /** Document is currently being processed (OCR, text extraction) */
  PROCESSING = 'PROCESSING',

  /** Text extraction is complete, ready for LLM extraction */
  EXTRACTED = 'EXTRACTED',

  /** LLM is analyzing the document */
  ANALYZING = 'ANALYZING',

  /** Processing completed successfully */
  COMPLETED = 'COMPLETED',

  /** Processing failed with recoverable error */
  FAILED = 'FAILED',

  /** Processing failed with unrecoverable error */
  ERROR = 'ERROR'
}

/**
 * Type for ProcessingStatus values
 */
export type ProcessingStatusValue = `${ProcessingStatus}`;
