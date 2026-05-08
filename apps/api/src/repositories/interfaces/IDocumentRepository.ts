import { DocumentRecord, ProcessingStatus } from '@loanlens/domain';

export interface FindOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'uploadedAt' | 'updatedAt' | 'filename';
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentFilters {
  status?: ProcessingStatus;
  borrowerId?: string;
  uploadedAfter?: Date;
  uploadedBefore?: Date;
}

export interface IDocumentRepository {
  // Create
  create(document: DocumentRecord): Promise<void>;
  createMany(documents: DocumentRecord[]): Promise<void>;

  // Read
  findById(id: string): Promise<DocumentRecord | null>;
  findAll(options?: FindOptions, filters?: DocumentFilters): Promise<DocumentRecord[]>;
  findByBorrowerId(borrowerId: string): Promise<DocumentRecord[]>;
  findByStatus(status: ProcessingStatus): Promise<DocumentRecord[]>;
  count(filters?: DocumentFilters): Promise<number>;

  // Update
  update(id: string, updates: Partial<DocumentRecord>): Promise<void>;
  updateStatus(id: string, status: ProcessingStatus, errorMessage?: string): Promise<void>;

  // Delete
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
}
