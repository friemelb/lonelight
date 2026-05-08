import { describe, it, expect, beforeEach } from 'vitest';
import { ParsingService } from './ParsingService';
import { DocumentRecord, ProcessingStatus } from '@loanlens/domain';

describe('ParsingService', () => {
  let service: ParsingService;

  beforeEach(() => {
    service = new ParsingService();
  });

  describe('parser selection', () => {
    it('should select correct parser for .txt files', async () => {
      const doc: DocumentRecord = {
        id: 'test-1',
        filename: 'readme.txt',
        mimeType: 'text/plain',
        fileSize: 100,
        storagePath: 'corpus/readme.txt',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should select correct parser for .csv files', async () => {
      const doc: DocumentRecord = {
        id: 'test-2',
        filename: 'transactions.csv',
        mimeType: 'text/csv',
        fileSize: 100,
        storagePath: 'corpus/transactions.csv',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should select correct parser for .json files', async () => {
      const doc: DocumentRecord = {
        id: 'test-3',
        filename: 'borrower-info.json',
        mimeType: 'application/json',
        fileSize: 100,
        storagePath: 'corpus/borrower-info.json',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should select correct parser for .md files', async () => {
      const doc: DocumentRecord = {
        id: 'test-4',
        filename: 'loan-notes.md',
        mimeType: 'text/markdown',
        fileSize: 100,
        storagePath: 'corpus/loan-notes.md',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should select correct parser for .pdf files', async () => {
      const doc: DocumentRecord = {
        id: 'test-5',
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        storagePath: 'corpus/loan-214/document.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should select correct parser for .docx files', async () => {
      const doc: DocumentRecord = {
        id: 'test-6',
        filename: 'simple.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 100,
        storagePath: 'corpus/simple.docx',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should return error for unsupported file types', async () => {
      const doc: DocumentRecord = {
        id: 'test-7',
        filename: 'test.xls',
        mimeType: 'application/vnd.ms-excel',
        fileSize: 100,
        storagePath: 'corpus/test.xls',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(false);
      expect(result.chunks).toHaveLength(0);
      expect(result.error).toContain('No parser available');
    });
  });

  describe('parsing and chunking', () => {
    it('should successfully parse and chunk .txt file', async () => {
      const doc: DocumentRecord = {
        id: 'txt-test',
        filename: 'readme.txt',
        mimeType: 'text/plain',
        fileSize: 103,
        storagePath: 'corpus/readme.txt',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // Verify chunk structure
      result.chunks.forEach((chunk, index) => {
        expect(chunk.id).toBeDefined();
        expect(chunk.documentId).toBe(doc.id);
        expect(chunk.pageNumber).toBe(1);
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.content).toBeDefined();
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.extractedAt).toBeInstanceOf(Date);
      });
    });

    it('should successfully parse and chunk .csv file', async () => {
      const doc: DocumentRecord = {
        id: 'csv-test',
        filename: 'transactions.csv',
        mimeType: 'text/csv',
        fileSize: 132,
        storagePath: 'corpus/transactions.csv',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);

      // CSV should be formatted as "Column: value"
      const content = result.chunks[0].content;
      expect(content).toContain(':');
    });

    it('should successfully parse and chunk .json file', async () => {
      const doc: DocumentRecord = {
        id: 'json-test',
        filename: 'borrower-info.json',
        mimeType: 'application/json',
        fileSize: 112,
        storagePath: 'corpus/borrower-info.json',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);

      // JSON should be pretty-printed
      const content = result.chunks[0].content;
      expect(content).toContain('\n');
    });

    it('should successfully parse and chunk .md file', async () => {
      const doc: DocumentRecord = {
        id: 'md-test',
        filename: 'loan-notes.md',
        mimeType: 'text/markdown',
        fileSize: 110,
        storagePath: 'corpus/loan-notes.md',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);

      // Markdown should have syntax stripped
      const content = result.chunks[0].content;
      expect(content).not.toContain('##');
    });

    it('should successfully parse and chunk .pdf file', async () => {
      const doc: DocumentRecord = {
        id: 'pdf-test',
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        fileSize: 92426,
        storagePath: 'corpus/loan-214/document.pdf',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);

      // PDF content should be extracted
      const content = result.chunks[0].content;
      expect(content.length).toBeGreaterThan(0);
    });

    it('should successfully parse and chunk .docx file', async () => {
      const doc: DocumentRecord = {
        id: 'docx-test',
        filename: 'simple.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 5000,
        storagePath: 'corpus/simple.docx',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);

      // DOCX should have text extracted
      const content = result.chunks[0].content;
      expect(content).toContain('simple test document');
    });

    it('should handle parsing errors gracefully', async () => {
      const doc: DocumentRecord = {
        id: 'error-test',
        filename: 'nonexistent.txt',
        mimeType: 'text/plain',
        fileSize: 0,
        storagePath: 'corpus/nonexistent.txt',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(false);
      expect(result.chunks).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to parse');
    });

    it('should return chunks with proper structure', async () => {
      const doc: DocumentRecord = {
        id: 'structure-test',
        filename: 'readme.txt',
        mimeType: 'text/plain',
        fileSize: 103,
        storagePath: 'corpus/readme.txt',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);

      result.chunks.forEach(chunk => {
        // Verify all required fields are present
        expect(chunk).toHaveProperty('id');
        expect(chunk).toHaveProperty('documentId');
        expect(chunk).toHaveProperty('pageNumber');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('chunkIndex');
        expect(chunk).toHaveProperty('extractedAt');

        // Verify types
        expect(typeof chunk.id).toBe('string');
        expect(typeof chunk.documentId).toBe('string');
        expect(typeof chunk.pageNumber).toBe('number');
        expect(typeof chunk.content).toBe('string');
        expect(typeof chunk.chunkIndex).toBe('number');
        expect(chunk.extractedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('integration with real corpus files', () => {
    it('should parse all supported files in corpus', async () => {
      const testFiles = [
        {
          filename: 'readme.txt',
          mimeType: 'text/plain',
          fileSize: 103,
          storagePath: 'corpus/readme.txt'
        },
        {
          filename: 'transactions.csv',
          mimeType: 'text/csv',
          fileSize: 132,
          storagePath: 'corpus/transactions.csv'
        },
        {
          filename: 'borrower-info.json',
          mimeType: 'application/json',
          fileSize: 112,
          storagePath: 'corpus/borrower-info.json'
        },
        {
          filename: 'loan-notes.md',
          mimeType: 'text/markdown',
          fileSize: 110,
          storagePath: 'corpus/loan-notes.md'
        },
        {
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          fileSize: 92426,
          storagePath: 'corpus/loan-214/document.pdf'
        },
        {
          filename: 'simple.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileSize: 5000,
          storagePath: 'corpus/simple.docx'
        }
      ];

      for (const file of testFiles) {
        const doc: DocumentRecord = {
          id: `test-${file.filename}`,
          ...file,
          status: ProcessingStatus.UPLOADED,
          uploadedAt: new Date(),
          updatedAt: new Date()
        };

        const result = await service.parseAndChunkDocument(doc);

        expect(result.success).toBe(true);
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      }
    });

    it('should handle corpus files with consistent chunk metadata', async () => {
      const doc: DocumentRecord = {
        id: 'metadata-test',
        filename: 'readme.txt',
        mimeType: 'text/plain',
        fileSize: 103,
        storagePath: 'corpus/readme.txt',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);

      // All chunks should have the same documentId
      const documentIds = new Set(result.chunks.map(c => c.documentId));
      expect(documentIds.size).toBe(1);
      expect(documentIds.has(doc.id)).toBe(true);

      // All chunks should have sequential indexes
      const indexes = result.chunks.map(c => c.chunkIndex);
      expect(indexes).toEqual([...Array(indexes.length).keys()]);
    });

    it('should produce valid chunk IDs for all files', async () => {
      const doc: DocumentRecord = {
        id: 'id-test',
        filename: 'transactions.csv',
        mimeType: 'text/csv',
        fileSize: 132,
        storagePath: 'corpus/transactions.csv',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(true);

      // All chunks should have unique UUIDs
      const ids = result.chunks.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Verify UUID format
      ids.forEach(id => {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });
  });

  describe('error handling', () => {
    it('should return error for missing file', async () => {
      const doc: DocumentRecord = {
        id: 'missing-test',
        filename: 'missing.txt',
        mimeType: 'text/plain',
        fileSize: 0,
        storagePath: 'corpus/missing.txt',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(false);
      expect(result.chunks).toHaveLength(0);
      expect(result.error).toBeDefined();
    });

    it('should return error for unsupported file extension', async () => {
      const doc: DocumentRecord = {
        id: 'unsupported-test',
        filename: 'test.xyz',
        mimeType: 'application/octet-stream',
        fileSize: 0,
        storagePath: 'corpus/test.xyz',
        status: ProcessingStatus.UPLOADED,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.parseAndChunkDocument(doc);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No parser available');
    });
  });
});
