import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getTestDatabase } from '@/database';
import { DocumentRepository } from './DocumentRepository';
import type { DocumentRecord } from '@loanlens/domain';
import { ProcessingStatus } from '@loanlens/domain';

describe('DocumentRepository', () => {
  let db: Database.Database;
  let repository: DocumentRepository;

  beforeEach(() => {
    db = getTestDatabase();
    repository = new DocumentRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should insert a document record', async () => {
      const document: DocumentRecord = {
        id: 'doc-123',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: '/uploads/test.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z')
      };

      await repository.create(document);

      const found = await repository.findById('doc-123');
      expect(found).toBeDefined();
      expect(found?.filename).toBe('test.pdf');
      expect(found?.status).toBe('UPLOADED');
    });

    it('should handle optional fields', async () => {
      const document: DocumentRecord = {
        id: 'doc-456',
        filename: 'paystub.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storagePath: '/uploads/paystub.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        pageCount: 3,
        errorMessage: 'Some warning',
        metadata: { source: 'upload' }
      };

      await repository.create(document);

      const found = await repository.findById('doc-456');
      expect(found?.pageCount).toBe(3);
      expect(found?.errorMessage).toBe('Some warning');
      expect(found?.metadata).toEqual({ source: 'upload' });
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Insert test data
      await repository.create({
        id: 'doc-1',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        storagePath: '/a.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      });

      await repository.create({
        id: 'doc-2',
        filename: 'b.pdf',
        mimeType: 'application/pdf',
        fileSize: 200,
        storagePath: '/b.pdf',
        status: ProcessingStatus.PROCESSING,
        uploadedAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      });

      await repository.create({
        id: 'doc-3',
        filename: 'c.pdf',
        mimeType: 'application/pdf',
        fileSize: 300,
        storagePath: '/c.pdf',
        status: ProcessingStatus.COMPLETED,
        uploadedAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
      });
    });

    it('should return all documents', async () => {
      const docs = await repository.findAll();
      expect(docs).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const docs = await repository.findAll({}, { status: ProcessingStatus.COMPLETED });
      expect(docs).toHaveLength(2);
      expect(docs.every(d => d.status === 'COMPLETED')).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const docs = await repository.findAll({ limit: 2, offset: 1 });
      expect(docs).toHaveLength(2);
    });

    it('should sort by uploadedAt descending by default', async () => {
      const docs = await repository.findAll();
      expect(docs[0].id).toBe('doc-3');
      expect(docs[2].id).toBe('doc-1');
    });
  });

  describe('updateStatus', () => {
    it('should update document status', async () => {
      await repository.create({
        id: 'doc-status',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storagePath: '/test.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      await repository.updateStatus('doc-status', ProcessingStatus.PROCESSING);

      const doc = await repository.findById('doc-status');
      expect(doc?.status).toBe(ProcessingStatus.PROCESSING);
    });

    it('should update status with error message', async () => {
      await repository.create({
        id: 'doc-error',
        filename: 'bad.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storagePath: '/bad.pdf',
        status: ProcessingStatus.PROCESSING,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      await repository.updateStatus('doc-error', ProcessingStatus.ERROR, 'Failed to parse');

      const doc = await repository.findById('doc-error');
      expect(doc?.status).toBe(ProcessingStatus.ERROR);
      expect(doc?.errorMessage).toBe('Failed to parse');
    });
  });

  describe('delete', () => {
    it('should delete a document', async () => {
      await repository.create({
        id: 'doc-delete',
        filename: 'delete.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storagePath: '/delete.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      });

      await repository.delete('doc-delete');

      const doc = await repository.findById('doc-delete');
      expect(doc).toBeNull();
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await repository.createMany([
        {
          id: 'doc-1',
          filename: 'a.pdf',
          mimeType: 'application/pdf',
          fileSize: 100,
          storagePath: '/a.pdf',
          status: ProcessingStatus.COMPLETED,
          uploadedAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'doc-2',
          filename: 'b.pdf',
          mimeType: 'application/pdf',
          fileSize: 200,
          storagePath: '/b.pdf',
          status: ProcessingStatus.PROCESSING,
          uploadedAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    });

    it('should count all documents', async () => {
      const count = await repository.count();
      expect(count).toBe(2);
    });

    it('should count with filters', async () => {
      const count = await repository.count({ status: ProcessingStatus.COMPLETED });
      expect(count).toBe(1);
    });
  });
});
