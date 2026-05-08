import { DocumentChunk } from '@loanlens/domain';

export interface IChunkRepository {
  // Create
  create(chunk: DocumentChunk): Promise<void>;
  createMany(chunks: DocumentChunk[]): Promise<void>;

  // Read
  findById(id: string): Promise<DocumentChunk | null>;
  findByDocumentId(documentId: string): Promise<DocumentChunk[]>;
  findByPage(documentId: string, pageNumber: number): Promise<DocumentChunk[]>;
  searchContent(query: string, documentId?: string): Promise<DocumentChunk[]>;

  // Update
  update(id: string, updates: Partial<DocumentChunk>): Promise<void>;

  // Delete
  delete(id: string): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
