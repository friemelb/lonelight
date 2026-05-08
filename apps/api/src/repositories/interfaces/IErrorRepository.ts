export type ErrorType = 'UPLOAD' | 'OCR' | 'EXTRACTION' | 'VALIDATION' | 'SYSTEM';

export interface ProcessingError {
  id?: number;
  documentId?: string;
  borrowerId?: string;
  errorType: ErrorType;
  errorMessage: string;
  errorStack?: string;
  context?: Record<string, unknown>;
  occurredAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface IErrorRepository {
  // Create
  create(error: Omit<ProcessingError, 'id'>): Promise<void>;

  // Read
  findById(id: number): Promise<ProcessingError | null>;
  findByDocumentId(documentId: string): Promise<ProcessingError[]>;
  findByBorrowerId(borrowerId: string): Promise<ProcessingError[]>;
  findUnresolved(): Promise<ProcessingError[]>;

  // Update
  markResolved(id: number): Promise<void>;

  // Delete
  delete(id: number): Promise<void>;
}
