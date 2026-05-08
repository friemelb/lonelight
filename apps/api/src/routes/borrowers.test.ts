import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import type Database from 'better-sqlite3';
import { getTestDatabase } from '@/database';
import { BorrowerRepository, DocumentRepository } from '@/repositories';
import type { ExtractedField } from '@loanlens/domain';
import { ProcessingStatus } from '@loanlens/domain';

// Mock the database module
vi.mock('@/database', async () => {
  const actual = await vi.importActual('@/database');
  return {
    ...actual,
    getDatabase: vi.fn()
  };
});

describe('Borrowers Routes', () => {
  let app: Express;
  let db: Database.Database;
  let borrowerRepository: BorrowerRepository;
  let documentRepository: DocumentRepository;

  beforeEach(async () => {
    db = getTestDatabase();
    borrowerRepository = new BorrowerRepository(db);
    documentRepository = new DocumentRepository(db);

    // Mock getDatabase to return our test database
    const { getDatabase } = await import('@/database');
    vi.mocked(getDatabase).mockReturnValue(db);

    // Import borrowersRouter after mocking
    const { borrowersRouter } = await import('./borrowers');

    // Create test Express app
    app = express();
    app.use(express.json());
    app.use('/api/borrowers', borrowersRouter);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to create extracted field
  const createField = (value: string, confidence: number = 0.95): ExtractedField<string> => ({
    value,
    confidence,
    sourceDocumentId: 'doc-1',
    sourcePage: 1,
    evidenceQuote: `Evidence for ${value}`,
    extractedAt: new Date()
  });

  describe('GET /api/borrowers', () => {
    beforeEach(async () => {
      // Create a dummy document first (needed for foreign key in borrower_fields)
      await documentRepository.create({
        id: 'doc-1',
        filename: 'dummy.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storagePath: '/dummy.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      // Insert test borrowers
      await borrowerRepository.create({
        id: 'borrower-1',
        fullName: createField('John Smith'),
        firstName: createField('John'),
        lastName: createField('Smith'),
        email: createField('john@example.com'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        documentIds: []
      });

      await borrowerRepository.create({
        id: 'borrower-2',
        fullName: createField('Jane Doe'),
        firstName: createField('Jane'),
        lastName: createField('Doe'),
        phoneNumber: createField('555-1234'),
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        documentIds: []
      });

      await borrowerRepository.create({
        id: 'borrower-3',
        fullName: createField('Bob Johnson'),
        firstName: createField('Bob'),
        lastName: createField('Johnson'),
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
        documentIds: []
      });
    });

    it('should return all borrowers', async () => {
      const response = await request(app).get('/api/borrowers');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toEqual({
        total: 3,
        limit: 50,
        offset: 0,
        hasMore: false
      });
    });

    it('should search borrowers by name', async () => {
      const response = await request(app)
        .get('/api/borrowers')
        .query({ search: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      // Should find both "John Smith" and "Bob Johnson"
      const names = response.body.data.map((b: any) => b.fullName.value);
      expect(names.some((name: string) => name.includes('John'))).toBe(true);
    });

    it('should search borrowers by email', async () => {
      const response = await request(app)
        .get('/api/borrowers')
        .query({ search: 'john@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email.value).toBe('john@example.com');
    });

    it('should paginate borrowers', async () => {
      const response = await request(app)
        .get('/api/borrowers')
        .query({ limit: '2', offset: '1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 3,
        limit: 2,
        offset: 1,
        hasMore: false
      });
    });

    it('should sort borrowers by updatedAt descending by default', async () => {
      const response = await request(app).get('/api/borrowers');

      expect(response.status).toBe(200);
      expect(response.body.data[0].id).toBe('borrower-3');
      expect(response.body.data[2].id).toBe('borrower-1');
    });

    it('should return empty search results for non-matching query', async () => {
      const response = await request(app)
        .get('/api/borrowers')
        .query({ search: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/borrowers/:id', () => {
    beforeEach(async () => {
      // Create a dummy document first (needed for foreign key in borrower_fields)
      await documentRepository.create({
        id: 'doc-1',
        filename: 'dummy.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storagePath: '/dummy.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      await borrowerRepository.create({
        id: 'borrower-123',
        fullName: createField('Alice Williams'),
        firstName: createField('Alice'),
        lastName: createField('Williams'),
        ssn: createField('123-45-6789', 0.98),
        dateOfBirth: createField('1985-05-15', 0.99),
        email: createField('alice@example.com'),
        phoneNumber: createField('555-9876'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
        documentIds: []
      });
    });

    it('should return a borrower by id', async () => {
      const response = await request(app).get('/api/borrowers/borrower-123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('borrower-123');
      expect(response.body.fullName.value).toBe('Alice Williams');
      expect(response.body.firstName.value).toBe('Alice');
      expect(response.body.lastName.value).toBe('Williams');
      expect(response.body.ssn.value).toBe('123-45-6789');
      expect(response.body.ssn.confidence).toBe(0.98);
      expect(response.body.email.value).toBe('alice@example.com');
      expect(response.body.phoneNumber.value).toBe('555-9876');
    });

    it('should return borrower with ExtractedField metadata', async () => {
      const response = await request(app).get('/api/borrowers/borrower-123');

      expect(response.status).toBe(200);
      expect(response.body.fullName.sourceDocumentId).toBe('doc-1');
      expect(response.body.fullName.sourcePage).toBe(1);
      expect(response.body.fullName.evidenceQuote).toBe('Evidence for Alice Williams');
      expect(response.body.fullName.confidence).toBe(0.95);
    });

    it('should return 404 for non-existent borrower', async () => {
      const response = await request(app).get('/api/borrowers/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Borrower not found');
      expect(response.body.error.statusCode).toBe(404);
    });
  });

  describe('GET /api/borrowers/:id/documents', () => {
    beforeEach(async () => {
      // Create a dummy document first (needed for foreign key in borrower_fields)
      await documentRepository.create({
        id: 'doc-dummy',
        filename: 'dummy.pdf',
        mimeType: 'application/pdf',
        fileSize: 500,
        storagePath: '/dummy.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      // Create borrower
      await borrowerRepository.create({
        id: 'borrower-456',
        fullName: {
          value: 'Charlie Brown',
          confidence: 0.95,
          sourceDocumentId: 'doc-dummy',
          sourcePage: 1,
          evidenceQuote: 'Evidence for Charlie Brown',
          extractedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        documentIds: []
      });

      // Create documents for this borrower
      await documentRepository.create({
        id: 'doc-1',
        filename: 'paystub.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: '/uploads/paystub.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        borrowerId: 'borrower-456'
      });

      await documentRepository.create({
        id: 'doc-2',
        filename: 'w2.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storagePath: '/uploads/w2.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        borrowerId: 'borrower-456'
      });

      // Create document for different borrower (no borrowerId, so it's unassigned)
      await documentRepository.create({
        id: 'doc-3',
        filename: 'other.pdf',
        mimeType: 'application/pdf',
        fileSize: 512,
        storagePath: '/uploads/other.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
        // No borrowerId - this document is unassigned
      });
    });

    it('should return all documents for a borrower', async () => {
      const response = await request(app).get('/api/borrowers/borrower-456/documents');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.data[0].borrowerId).toBe('borrower-456');
      expect(response.body.data[1].borrowerId).toBe('borrower-456');
    });

    it('should return empty array for borrower with no documents', async () => {
      await borrowerRepository.create({
        id: 'borrower-no-docs',
        fullName: createField('No Documents Person'),
        createdAt: new Date(),
        updatedAt: new Date(),
        documentIds: []
      });

      const response = await request(app).get('/api/borrowers/borrower-no-docs/documents');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });

    it('should only return documents for the specified borrower', async () => {
      const response = await request(app).get('/api/borrowers/borrower-456/documents');

      expect(response.status).toBe(200);
      const fileNames = response.body.data.map((d: any) => d.filename);
      expect(fileNames).toContain('paystub.pdf');
      expect(fileNames).toContain('w2.pdf');
      expect(fileNames).not.toContain('other.pdf');
    });
  });
});
