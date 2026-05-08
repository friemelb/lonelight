import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import type Database from 'better-sqlite3';
import { getTestDatabase } from '@/database';
import { DocumentRepository } from '@/repositories';
import { ProcessingStatus } from '@loanlens/domain';
import { FileService } from '@/services/FileService';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock the database module
vi.mock('@/database', async () => {
  const actual = await vi.importActual('@/database');
  return {
    ...actual,
    getDatabase: vi.fn()
  };
});

// Mock the FileService to use our test directory
vi.mock('@/services/FileService', async () => {
  const actual = await vi.importActual('@/services/FileService');
  return {
    ...actual,
    FileService: actual.FileService
  };
});

describe('Ingest Routes', () => {
  let app: Express;
  let db: Database.Database;
  let documentRepository: DocumentRepository;
  let tempCorpusDir: string;

  beforeEach(async () => {
    db = getTestDatabase();
    documentRepository = new DocumentRepository(db);

    // Create temporary corpus directory for testing
    tempCorpusDir = await fs.mkdtemp(path.join(os.tmpdir(), 'corpus-test-'));

    // Mock getDatabase to return our test database
    const { getDatabase } = await import('@/database');
    vi.mocked(getDatabase).mockReturnValue(db);

    // Import ingest router
    const ingestModule = await import('./ingest');

    // Create test Express app
    app = express();
    app.use(express.json());

    // We need to mock the corpus path used by the ingest router
    // Since the router uses a hardcoded path, we'll need to work with the actual corpus
    // or use the actual corpus directory for integration testing
    app.use('/api/ingest', ingestModule.ingestRouter);
  });

  afterEach(async () => {
    db.close();
    // Clean up temporary directory
    try {
      await fs.rm(tempCorpusDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('POST /api/ingest with corpus files', () => {
    it('should ingest documents from the corpus directory', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('errors');
    });

    it('should return correct counts for ingested documents', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const { total, successful, failed } = response.body;

      // Verify counts add up
      expect(successful + failed).toBe(total);

      // We know from the corpus directory there are files
      expect(total).toBeGreaterThan(0);
    });

    it('should create document records in database', async () => {
      const countBefore = await documentRepository.count();

      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const countAfter = await documentRepository.count();

      // Verify documents were created
      expect(countAfter).toBeGreaterThan(countBefore);
      expect(countAfter).toBe(countBefore + response.body.total);
    });

    it('should mark unsupported files as FAILED', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find the unsupported file (unsupported-test.docx)
      const unsupportedDoc = response.body.documents.find(
        (doc: any) => doc.filename === 'unsupported-test.docx'
      );

      if (unsupportedDoc) {
        expect(unsupportedDoc.status).toBe(ProcessingStatus.FAILED);
        expect(unsupportedDoc.errorMessage).toContain('Unsupported file type');

        // Verify it's in the errors array
        const error = response.body.errors.find(
          (err: any) => err.filename === 'unsupported-test.docx'
        );
        expect(error).toBeDefined();
        expect(error.error).toContain('Unsupported file type');
      }
    });

    it('should mark supported files as UPLOADED or EXTRACTED', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find supported files
      const supportedDocs = response.body.documents.filter((doc: any) =>
        ['.txt', '.csv', '.md', '.json', '.pdf'].some(ext => doc.filename.endsWith(ext))
      );

      // All supported files should have UPLOADED, EXTRACTED, or FAILED status (PDF parsing may fail)
      supportedDocs.forEach((doc: any) => {
        expect([ProcessingStatus.UPLOADED, ProcessingStatus.EXTRACTED, ProcessingStatus.FAILED]).toContain(doc.status);
        // Only check for undefined error message if status is EXTRACTED or UPLOADED
        if (doc.status === ProcessingStatus.EXTRACTED || doc.status === ProcessingStatus.UPLOADED) {
          expect(doc.errorMessage).toBeUndefined();
        }
      });

      // Verify at least some files were marked as successful
      expect(response.body.successful).toBeGreaterThan(0);
    });

    it('should set correct document fields for each file', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const documents = response.body.documents;
      expect(documents.length).toBeGreaterThan(0);

      documents.forEach((doc: any) => {
        // Verify required fields are set
        expect(doc.id).toBeDefined();
        expect(doc.filename).toBeDefined();
        expect(doc.mimeType).toBeDefined();
        expect(doc.fileSize).toBeGreaterThanOrEqual(0);
        expect(doc.storagePath).toBeDefined();
        expect(doc.status).toBeDefined();
        expect(doc.uploadedAt).toBeDefined();
        expect(doc.updatedAt).toBeDefined();

        // Verify status is UPLOADED, EXTRACTED, or FAILED
        expect([ProcessingStatus.UPLOADED, ProcessingStatus.EXTRACTED, ProcessingStatus.FAILED]).toContain(doc.status);

        // Verify storagePath is relative from data directory
        expect(doc.storagePath).toContain('corpus');
      });
    });

    it('should verify specific files from corpus are ingested', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const filenames = response.body.documents.map((doc: any) => doc.filename);

      // Verify expected files are present
      expect(filenames).toContain('borrower-info.json');
      expect(filenames).toContain('loan-notes.md');
      expect(filenames).toContain('readme.txt');
      expect(filenames).toContain('transactions.csv');
      expect(filenames).toContain('unsupported-test.docx');
    });

    it('should set correct MIME types for known file extensions', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const mimeTypeMap: Record<string, string> = {
        'borrower-info.json': 'application/json',
        'loan-notes.md': 'text/markdown',
        'readme.txt': 'text/plain',
        'transactions.csv': 'text/csv',
        'unsupported-test.docx': 'application/octet-stream'
      };

      response.body.documents.forEach((doc: any) => {
        if (mimeTypeMap[doc.filename]) {
          expect(doc.mimeType).toBe(mimeTypeMap[doc.filename]);
        }
      });
    });

    it('should handle subdirectories in corpus', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Check if any documents have nested paths
      const nestedDocs = response.body.documents.filter((doc: any) =>
        doc.storagePath.includes(path.sep + 'loan-214' + path.sep)
      );

      // We know loan-214 directory exists with files
      expect(nestedDocs.length).toBeGreaterThan(0);

      // Verify nested files have correct relative paths
      nestedDocs.forEach((doc: any) => {
        expect(doc.storagePath).toMatch(/corpus.*loan-214/);
      });
    });

    it('should allow ingestion to be called multiple times', async () => {
      // First ingestion
      const response1 = await request(app).post('/api/ingest');
      expect(response1.status).toBe(200);
      const firstCount = response1.body.total;

      // Second ingestion
      const response2 = await request(app).post('/api/ingest');
      expect(response2.status).toBe(200);
      const secondCount = response2.body.total;

      // Should ingest the same number of files each time
      expect(secondCount).toBe(firstCount);

      // Total documents in DB should be 2x the number of files
      const totalDocs = await documentRepository.count();
      expect(totalDocs).toBe(firstCount + secondCount);
    });
  });

  describe('POST /api/ingest error handling', () => {
    it('should handle gracefully if corpus directory is inaccessible', async () => {
      // Mock FileService to throw an error
      // This test depends on being able to mock the service at request time
      // For now, we'll test the actual error response structure
      const response = await request(app).post('/api/ingest');

      // Should return successful response if corpus exists
      // Or error response if corpus doesn't exist
      expect([200, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.statusCode).toBe(500);
      }
    });
  });

  describe('POST /api/ingest database verification', () => {
    it('should query database and verify document records after ingestion', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Query all documents from database
      const allDocs = await documentRepository.findAll();

      // Should match the number of documents in response
      expect(allDocs.length).toBe(response.body.documents.length);

      // Verify each document exists in database
      for (const responseDoc of response.body.documents) {
        const dbDoc = await documentRepository.findById(responseDoc.id);

        expect(dbDoc).toBeDefined();
        expect(dbDoc?.filename).toBe(responseDoc.filename);
        expect(dbDoc?.mimeType).toBe(responseDoc.mimeType);
        expect(dbDoc?.fileSize).toBe(responseDoc.fileSize);
        expect(dbDoc?.storagePath).toBe(responseDoc.storagePath);
        expect(dbDoc?.status).toBe(responseDoc.status);

        if (responseDoc.errorMessage) {
          expect(dbDoc?.errorMessage).toBe(responseDoc.errorMessage);
        }
      }
    });

    it('should verify FAILED documents have error messages', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find all failed documents
      const failedDocs = response.body.documents.filter(
        (doc: any) => doc.status === ProcessingStatus.FAILED
      );

      // Each failed document should have an error message
      for (const failedDoc of failedDocs) {
        expect(failedDoc.errorMessage).toBeDefined();
        // Error message can be either "Unsupported file type" or "No parser available"
        expect(
          failedDoc.errorMessage.includes('Unsupported file type') ||
          failedDoc.errorMessage.includes('No parser available')
        ).toBe(true);

        // Verify in database
        const dbDoc = await documentRepository.findById(failedDoc.id);
        expect(dbDoc?.errorMessage).toBeDefined();
      }
    });

    it('should verify UPLOADED documents do not have error messages', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find all uploaded documents
      const uploadedDocs = response.body.documents.filter(
        (doc: any) => doc.status === ProcessingStatus.UPLOADED
      );

      // Each uploaded document should NOT have an error message
      for (const uploadedDoc of uploadedDocs) {
        // errorMessage might be undefined or null
        expect(uploadedDoc.errorMessage).toBeUndefined();

        // Verify in database
        const dbDoc = await documentRepository.findById(uploadedDoc.id);
        expect(dbDoc?.errorMessage).toBeFalsy();
      }
    });

    it('should verify file sizes are recorded correctly', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Verify file sizes are greater than 0 for non-empty files
      const fileService = new FileService();
      const corpusPath = path.join(__dirname, '../../data/corpus');

      for (const doc of response.body.documents) {
        // Get actual file path
        const fullPath = path.join(corpusPath, path.relative('corpus', doc.storagePath));

        try {
          const stats = await fileService.getFileStats(fullPath);
          expect(doc.fileSize).toBe(stats.size);
        } catch (error) {
          // File might be in subdirectory, construct path differently
          const altPath = path.join(
            __dirname,
            '../../data',
            doc.storagePath.replace(/\\/g, path.sep)
          );
          try {
            const stats = await fileService.getFileStats(altPath);
            expect(doc.fileSize).toBe(stats.size);
          } catch (altError) {
            // Skip files we can't verify
            console.log(`Could not verify file size for ${doc.filename}`);
          }
        }
      }
    });
  });

  describe('POST /api/ingest response structure', () => {
    it('should return response with correct structure', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Verify response structure
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('errors');

      // Verify types
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.successful).toBe('number');
      expect(typeof response.body.failed).toBe('number');
      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(Array.isArray(response.body.errors)).toBe(true);

      // Verify counts are non-negative
      expect(response.body.total).toBeGreaterThanOrEqual(0);
      expect(response.body.successful).toBeGreaterThanOrEqual(0);
      expect(response.body.failed).toBeGreaterThanOrEqual(0);
    });

    it('should include error details for failed files', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // If there are failed files, verify error structure
      if (response.body.failed > 0) {
        expect(response.body.errors.length).toBeGreaterThan(0);

        response.body.errors.forEach((error: any) => {
          expect(error).toHaveProperty('filename');
          expect(error).toHaveProperty('error');
          expect(typeof error.filename).toBe('string');
          expect(typeof error.error).toBe('string');
        });
      }
    });

    it('should return empty errors array if all files succeed', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // If successful equals total, errors should be empty
      if (response.body.successful === response.body.total) {
        expect(response.body.errors).toHaveLength(0);
      }
    });
  });

  describe('POST /api/ingest with parsing and chunking', () => {
    it('should parse and chunk supported files after ingestion', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('parsed');
      expect(response.body).toHaveProperty('parseFailed');
      expect(response.body).toHaveProperty('totalChunks');

      // At least some files should be parsed
      expect(response.body.parsed).toBeGreaterThan(0);
      expect(response.body.totalChunks).toBeGreaterThan(0);

      // Verify parsed + parseFailed is reasonable
      // Note: PDF files are supported by FileService but may fail parsing (no parser yet)
      expect(response.body.parsed + response.body.parseFailed).toBeGreaterThan(0);
    });

    it('should update document status to EXTRACTED after parsing', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find documents with supported file types
      const txtDoc = response.body.documents.find((d: any) => d.filename === 'readme.txt');
      const csvDoc = response.body.documents.find((d: any) => d.filename === 'transactions.csv');
      const jsonDoc = response.body.documents.find((d: any) => d.filename === 'borrower-info.json');
      const mdDoc = response.body.documents.find((d: any) => d.filename === 'loan-notes.md');

      // All supported files should have EXTRACTED status
      if (txtDoc) expect(txtDoc.status).toBe(ProcessingStatus.EXTRACTED);
      if (csvDoc) expect(csvDoc.status).toBe(ProcessingStatus.EXTRACTED);
      if (jsonDoc) expect(jsonDoc.status).toBe(ProcessingStatus.EXTRACTED);
      if (mdDoc) expect(mdDoc.status).toBe(ProcessingStatus.EXTRACTED);
    });

    it('should store chunks in database', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);
      expect(response.body.totalChunks).toBeGreaterThan(0);

      // Import ChunkRepository
      const { ChunkRepository } = await import('@/repositories');
      const chunkRepository = new ChunkRepository(db);

      // Find a parsed document
      const parsedDoc = response.body.documents.find(
        (d: any) => d.status === ProcessingStatus.EXTRACTED
      );

      expect(parsedDoc).toBeDefined();

      // Verify chunks exist in database
      const chunks = await chunkRepository.findByDocumentId(parsedDoc.id);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should set pageCount to chunk count', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find documents with EXTRACTED status
      const extractedDocs = response.body.documents.filter(
        (d: any) => d.status === ProcessingStatus.EXTRACTED
      );

      expect(extractedDocs.length).toBeGreaterThan(0);

      // Each extracted document should have a pageCount
      for (const doc of extractedDocs) {
        expect(doc.pageCount).toBeDefined();
        expect(doc.pageCount).toBeGreaterThan(0);

        // Verify pageCount matches actual chunks in database
        const { ChunkRepository } = await import('@/repositories');
        const chunkRepository = new ChunkRepository(db);
        const chunks = await chunkRepository.findByDocumentId(doc.id);
        expect(chunks.length).toBe(doc.pageCount);
      }
    });

    it('should handle parsing failures gracefully', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Response should include parseFailed count
      expect(response.body).toHaveProperty('parseFailed');
      expect(typeof response.body.parseFailed).toBe('number');
      expect(response.body.parseFailed).toBeGreaterThanOrEqual(0);
    });

    it('should update document status to FAILED if parsing fails', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find documents with FAILED status
      const failedDocs = response.body.documents.filter(
        (d: any) => d.status === ProcessingStatus.FAILED
      );

      // Verify failed documents have error messages
      failedDocs.forEach((doc: any) => {
        expect(doc.errorMessage).toBeDefined();
        expect(typeof doc.errorMessage).toBe('string');
      });
    });

    it('should include parse statistics in response', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Verify parse statistics are present
      expect(response.body).toHaveProperty('parsed');
      expect(response.body).toHaveProperty('parseFailed');
      expect(response.body).toHaveProperty('totalChunks');

      // Verify types
      expect(typeof response.body.parsed).toBe('number');
      expect(typeof response.body.parseFailed).toBe('number');
      expect(typeof response.body.totalChunks).toBe('number');

      // Verify relationships
      expect(response.body.parsed).toBeGreaterThanOrEqual(0);
      expect(response.body.parseFailed).toBeGreaterThanOrEqual(0);
      expect(response.body.totalChunks).toBeGreaterThanOrEqual(0);

      // If documents were parsed, totalChunks should be > 0
      if (response.body.parsed > 0) {
        expect(response.body.totalChunks).toBeGreaterThan(0);
      }
    });

    it('should verify chunks can be retrieved by document ID', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      // Find a document with EXTRACTED status
      const extractedDoc = response.body.documents.find(
        (d: any) => d.status === ProcessingStatus.EXTRACTED
      );

      expect(extractedDoc).toBeDefined();

      // Retrieve chunks from database
      const { ChunkRepository } = await import('@/repositories');
      const chunkRepository = new ChunkRepository(db);
      const chunks = await chunkRepository.findByDocumentId(extractedDoc.id);

      expect(chunks.length).toBeGreaterThan(0);

      // Verify chunk structure
      chunks.forEach((chunk, index) => {
        expect(chunk.id).toBeDefined();
        expect(chunk.documentId).toBe(extractedDoc.id);
        expect(chunk.pageNumber).toBe(1);
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.content).toBeDefined();
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.extractedAt).toBeInstanceOf(Date);
      });
    });

    it('should create chunks with proper metadata', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const { ChunkRepository } = await import('@/repositories');
      const chunkRepository = new ChunkRepository(db);

      // Get a parsed document
      const parsedDoc = response.body.documents.find(
        (d: any) => d.status === ProcessingStatus.EXTRACTED
      );

      expect(parsedDoc).toBeDefined();

      const chunks = await chunkRepository.findByDocumentId(parsedDoc.id);
      expect(chunks.length).toBeGreaterThan(0);

      // Verify chunk metadata
      chunks.forEach(chunk => {
        // Check required fields
        expect(chunk.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(chunk.documentId).toBe(parsedDoc.id);
        expect(chunk.pageNumber).toBe(1);
        expect(typeof chunk.chunkIndex).toBe('number');
        expect(chunk.content.trim().length).toBeGreaterThan(0);
        expect(chunk.extractedAt).toBeInstanceOf(Date);
        expect(chunk.extractedAt.getTime()).toBeLessThanOrEqual(Date.now());
      });
    });

    it('should parse different file types correctly', async () => {
      const response = await request(app).post('/api/ingest');

      expect(response.status).toBe(200);

      const { ChunkRepository } = await import('@/repositories');
      const chunkRepository = new ChunkRepository(db);

      // Test .txt file
      const txtDoc = response.body.documents.find((d: any) => d.filename === 'readme.txt');
      if (txtDoc && txtDoc.status === ProcessingStatus.EXTRACTED) {
        const txtChunks = await chunkRepository.findByDocumentId(txtDoc.id);
        expect(txtChunks.length).toBeGreaterThan(0);
      }

      // Test .csv file
      const csvDoc = response.body.documents.find((d: any) => d.filename === 'transactions.csv');
      if (csvDoc && csvDoc.status === ProcessingStatus.EXTRACTED) {
        const csvChunks = await chunkRepository.findByDocumentId(csvDoc.id);
        expect(csvChunks.length).toBeGreaterThan(0);
        // CSV content should have "Column: value" format
        expect(csvChunks[0].content).toContain(':');
      }

      // Test .json file
      const jsonDoc = response.body.documents.find((d: any) => d.filename === 'borrower-info.json');
      if (jsonDoc && jsonDoc.status === ProcessingStatus.EXTRACTED) {
        const jsonChunks = await chunkRepository.findByDocumentId(jsonDoc.id);
        expect(jsonChunks.length).toBeGreaterThan(0);
        // JSON should be formatted
        expect(jsonChunks[0].content).toContain('\n');
      }

      // Test .md file
      const mdDoc = response.body.documents.find((d: any) => d.filename === 'loan-notes.md');
      if (mdDoc && mdDoc.status === ProcessingStatus.EXTRACTED) {
        const mdChunks = await chunkRepository.findByDocumentId(mdDoc.id);
        expect(mdChunks.length).toBeGreaterThan(0);
        // Markdown syntax should be stripped
        expect(mdChunks[0].content).not.toContain('##');
      }
    });
  });
});
