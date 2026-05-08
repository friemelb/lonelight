import { describe, it, expect } from 'vitest';
import { DocumentRecordSchema, DocumentChunkSchema } from '../src/schemas';
import type { DocumentRecord, DocumentChunk } from '../src/types';

describe('DocumentRecord Validation', () => {
  const validDocumentRecord: DocumentRecord = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    filename: 'paystub_2024_01.pdf',
    mimeType: 'application/pdf',
    fileSize: 524288,
    storagePath: '/documents/123e4567.pdf',
    uploadedAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
    status: 'COMPLETED',
    pageCount: 2,
    borrowerId: '987e6543-e21b-12d3-a456-426614174000'
  };

  describe('Valid DocumentRecord', () => {
    it('should pass validation with all required fields', () => {
      expect(() => DocumentRecordSchema.parse(validDocumentRecord))
        .not.toThrow();
    });

    it('should pass validation with error message when status is ERROR', () => {
      const docWithError = {
        ...validDocumentRecord,
        status: 'ERROR' as const,
        errorMessage: 'Failed to parse PDF'
      };

      expect(() => DocumentRecordSchema.parse(docWithError))
        .not.toThrow();
    });

    it('should pass validation with metadata', () => {
      const docWithMetadata = {
        ...validDocumentRecord,
        metadata: { ocrConfidence: 0.95, language: 'en' }
      };

      expect(() => DocumentRecordSchema.parse(docWithMetadata))
        .not.toThrow();
    });

    it('should pass validation with valid PDF MIME type', () => {
      const docWithPDF = {
        ...validDocumentRecord,
        mimeType: 'application/pdf'
      };

      expect(() => DocumentRecordSchema.parse(docWithPDF))
        .not.toThrow();
    });

    it('should pass validation with valid image MIME types', () => {
      const mimeTypes = ['image/jpeg', 'image/png', 'image/tiff'];

      mimeTypes.forEach(mimeType => {
        const docWithMimeType = {
          ...validDocumentRecord,
          mimeType
        };

        expect(() => DocumentRecordSchema.parse(docWithMimeType))
          .not.toThrow();
      });
    });
  });

  describe('Invalid DocumentRecord', () => {
    it('should fail validation with invalid MIME type format', () => {
      const docWithInvalidMime = {
        ...validDocumentRecord,
        mimeType: 'not-a-mime-type'
      };

      expect(() => DocumentRecordSchema.parse(docWithInvalidMime))
        .toThrow();
    });

    it('should fail validation with negative file size', () => {
      const docWithNegativeSize = {
        ...validDocumentRecord,
        fileSize: -100
      };

      expect(() => DocumentRecordSchema.parse(docWithNegativeSize))
        .toThrow();
    });

    it('should fail validation with zero file size', () => {
      const docWithZeroSize = {
        ...validDocumentRecord,
        fileSize: 0
      };

      expect(() => DocumentRecordSchema.parse(docWithZeroSize))
        .toThrow();
    });

    it('should fail validation with zero page count', () => {
      const docWithZeroPages = {
        ...validDocumentRecord,
        pageCount: 0
      };

      expect(() => DocumentRecordSchema.parse(docWithZeroPages))
        .toThrow();
    });

    it('should fail validation with negative page count', () => {
      const docWithNegativePages = {
        ...validDocumentRecord,
        pageCount: -1
      };

      expect(() => DocumentRecordSchema.parse(docWithNegativePages))
        .toThrow();
    });

    it('should fail validation with invalid borrowerId UUID', () => {
      const docWithInvalidBorrowerId = {
        ...validDocumentRecord,
        borrowerId: 'not-a-uuid'
      };

      expect(() => DocumentRecordSchema.parse(docWithInvalidBorrowerId))
        .toThrow();
    });

    it('should fail validation with empty filename', () => {
      const docWithEmptyFilename = {
        ...validDocumentRecord,
        filename: ''
      };

      expect(() => DocumentRecordSchema.parse(docWithEmptyFilename))
        .toThrow();
    });
  });
});

describe('DocumentChunk Validation', () => {
  const validDocumentChunk: DocumentChunk = {
    id: '456e7890-e89b-12d3-a456-426614174000',
    documentId: '123e4567-e89b-12d3-a456-426614174000',
    pageNumber: 1,
    content: 'Employee Name: John Doe\nPay Period: 01/01/2024 - 01/15/2024',
    chunkIndex: 0,
    extractedAt: new Date('2024-01-15T10:35:00Z'),
    confidence: 0.95
  };

  describe('Valid DocumentChunk', () => {
    it('should pass validation with all required fields', () => {
      expect(() => DocumentChunkSchema.parse(validDocumentChunk))
        .not.toThrow();
    });

    it('should pass validation with optional bounding box', () => {
      const chunkWithBBox = {
        ...validDocumentChunk,
        boundingBox: [10, 20, 100, 50] as [number, number, number, number]
      };

      expect(() => DocumentChunkSchema.parse(chunkWithBBox))
        .not.toThrow();
    });

    it('should pass validation without confidence', () => {
      const { confidence, ...chunkWithoutConfidence } = validDocumentChunk;

      expect(() => DocumentChunkSchema.parse(chunkWithoutConfidence))
        .not.toThrow();
    });
  });

  describe('Invalid DocumentChunk', () => {
    it('should fail validation with invalid chunk ID', () => {
      const chunkWithInvalidId = {
        ...validDocumentChunk,
        id: 'not-a-uuid'
      };

      expect(() => DocumentChunkSchema.parse(chunkWithInvalidId))
        .toThrow();
    });

    it('should fail validation with invalid document ID', () => {
      const chunkWithInvalidDocId = {
        ...validDocumentChunk,
        documentId: 'not-a-uuid'
      };

      expect(() => DocumentChunkSchema.parse(chunkWithInvalidDocId))
        .toThrow();
    });

    it('should fail validation with invalid confidence (greater than 1)', () => {
      const chunkWithHighConfidence = {
        ...validDocumentChunk,
        confidence: 1.5
      };

      expect(() => DocumentChunkSchema.parse(chunkWithHighConfidence))
        .toThrow();
    });

    it('should fail validation with negative confidence', () => {
      const chunkWithNegativeConfidence = {
        ...validDocumentChunk,
        confidence: -0.1
      };

      expect(() => DocumentChunkSchema.parse(chunkWithNegativeConfidence))
        .toThrow();
    });

    it('should fail validation with zero page number', () => {
      const chunkWithZeroPage = {
        ...validDocumentChunk,
        pageNumber: 0
      };

      expect(() => DocumentChunkSchema.parse(chunkWithZeroPage))
        .toThrow();
    });

    it('should fail validation with negative page number', () => {
      const chunkWithNegativePage = {
        ...validDocumentChunk,
        pageNumber: -1
      };

      expect(() => DocumentChunkSchema.parse(chunkWithNegativePage))
        .toThrow();
    });

    it('should fail validation with negative chunk index', () => {
      const chunkWithNegativeIndex = {
        ...validDocumentChunk,
        chunkIndex: -1
      };

      expect(() => DocumentChunkSchema.parse(chunkWithNegativeIndex))
        .toThrow();
    });

    it('should fail validation with invalid bounding box (wrong array length)', () => {
      const chunkWithInvalidBBox = {
        ...validDocumentChunk,
        boundingBox: [10, 20, 100] // Only 3 elements
      };

      expect(() => DocumentChunkSchema.parse(chunkWithInvalidBBox))
        .toThrow();
    });

    it('should fail validation with negative bounding box coordinates', () => {
      const chunkWithNegativeBBox = {
        ...validDocumentChunk,
        boundingBox: [-10, 20, 100, 50] as [number, number, number, number]
      };

      expect(() => DocumentChunkSchema.parse(chunkWithNegativeBBox))
        .toThrow();
    });
  });
});
