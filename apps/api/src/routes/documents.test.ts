import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import type Database from 'better-sqlite3';
import { getTestDatabase } from '@/database';
import { DocumentRepository, ChunkRepository } from '@/repositories';
import { ProcessingStatus } from '@loanlens/domain';

// Mock the database module
vi.mock('@/database', async () => {
  const actual = await vi.importActual('@/database');
  return {
    ...actual,
    getDatabase: vi.fn()
  };
});

describe('Documents Routes', () => {
  let app: Express;
  let db: Database.Database;
  let documentRepository: DocumentRepository;
  let chunkRepository: ChunkRepository;

  beforeEach(async () => {
    db = getTestDatabase();
    documentRepository = new DocumentRepository(db);
    chunkRepository = new ChunkRepository(db);

    // Mock getDatabase to return our test database
    const { getDatabase } = await import('@/database');
    vi.mocked(getDatabase).mockReturnValue(db);

    // Import documentsRouter after mocking
    const { documentsRouter } = await import('./documents');

    // Create test Express app
    app = express();
    app.use(express.json());
    app.use('/api/documents', documentsRouter);
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      // Create a dummy document first (needed for borrower creation)
      //  Use an old date so it doesn't interfere with test expectations
      await documentRepository.create({
        id: 'doc-dummy',
        filename: 'dummy.pdf',
        mimeType: 'application/pdf',
        fileSize: 500,
        storagePath: '/dummy.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      });

      // Create a borrower (needed for foreign key in documents)
      db.prepare('INSERT INTO borrowers (id, created_at, updated_at) VALUES (?, ?, ?)').run(
        'borrower-1',
        new Date().toISOString(),
        new Date().toISOString()
      );
      db.prepare(`INSERT INTO borrower_fields (
        borrower_id, field_name, field_type, field_value,
        confidence, source_document_id, source_page, evidence_quote
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'borrower-1', 'fullName', 'string', 'Test Borrower',
        0.95, 'doc-dummy', 1, 'Evidence'
      );

      // Insert test documents
      await documentRepository.create({
        id: 'doc-1',
        filename: 'test1.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: '/uploads/test1.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        pageCount: 5
      });

      await documentRepository.create({
        id: 'doc-2',
        filename: 'test2.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storagePath: '/uploads/test2.pdf',
        status: ProcessingStatus.PROCESSING,
        uploadedAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      });

      await documentRepository.create({
        id: 'doc-3',
        filename: 'test3.pdf',
        mimeType: 'application/pdf',
        fileSize: 3072,
        storagePath: '/uploads/test3.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
        borrowerId: 'borrower-1'
      });
    });

    it('should return all documents', async () => {
      const response = await request(app).get('/api/documents');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(4); // Includes doc-dummy
      expect(response.body.pagination).toEqual({
        total: 4,
        limit: 50,
        offset: 0,
        hasMore: false
      });
    });

    it('should filter documents by status', async () => {
      const response = await request(app)
        .get('/api/documents')
        .query({ status: 'COMPLETED' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((d: any) => d.status === 'COMPLETED')).toBe(true);
    });

    it('should filter documents by borrowerId', async () => {
      const response = await request(app)
        .get('/api/documents')
        .query({ borrowerId: 'borrower-1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('doc-3');
    });

    it('should paginate documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .query({ limit: '2', offset: '1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 4,
        limit: 2,
        offset: 1,
        hasMore: true // offset(1) + returned(2) = 3 < 4
      });
    });

    it('should sort documents by uploadedAt descending by default', async () => {
      const response = await request(app).get('/api/documents');

      expect(response.status).toBe(200);
      expect(response.body.data[0].id).toBe('doc-3'); // Most recent
      expect(response.body.data[3].id).toBe('doc-dummy'); // Oldest
    });
  });

  describe('GET /api/documents/:id', () => {
    beforeEach(async () => {
      await documentRepository.create({
        id: 'doc-123',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: '/uploads/test.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
        pageCount: 10,
        metadata: { source: 'upload' }
      });
    });

    it('should return a document by id', async () => {
      const response = await request(app).get('/api/documents/doc-123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('doc-123');
      expect(response.body.filename).toBe('test.pdf');
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.pageCount).toBe(10);
      expect(response.body.metadata).toEqual({ source: 'upload' });
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app).get('/api/documents/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Document not found');
      expect(response.body.error.statusCode).toBe(404);
    });
  });

  describe('GET /api/documents/:id/chunks', () => {
    beforeEach(async () => {
      await documentRepository.create({
        id: 'doc-456',
        filename: 'chunked.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storagePath: '/uploads/chunked.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      await chunkRepository.create({
        id: 'chunk-1',
        documentId: 'doc-456',
        pageNumber: 1,
        chunkIndex: 0,
        content: 'First chunk of text',
        extractedAt: new Date()
      });

      await chunkRepository.create({
        id: 'chunk-2',
        documentId: 'doc-456',
        pageNumber: 1,
        chunkIndex: 1,
        content: 'Second chunk of text',
        extractedAt: new Date()
      });

      await chunkRepository.create({
        id: 'chunk-3',
        documentId: 'doc-456',
        pageNumber: 2,
        chunkIndex: 0,
        content: 'Third chunk on page 2',
        extractedAt: new Date()
      });
    });

    it('should return all chunks for a document', async () => {
      const response = await request(app).get('/api/documents/doc-456/chunks');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.count).toBe(3);
      expect(response.body.data[0].documentId).toBe('doc-456');
      expect(response.body.data[0].content).toBe('First chunk of text');
    });

    it('should return empty array for document with no chunks', async () => {
      await documentRepository.create({
        id: 'doc-no-chunks',
        filename: 'empty.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        storagePath: '/uploads/empty.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app).get('/api/documents/doc-no-chunks/chunks');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });
});
