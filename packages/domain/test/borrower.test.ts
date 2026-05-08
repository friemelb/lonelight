import { describe, it, expect } from 'vitest';
import { BorrowerRecordSchema } from '../src/schemas';
import type { BorrowerRecord, ExtractedField } from '../src/types';

describe('BorrowerRecord Validation', () => {
  const validExtractedName: ExtractedField<string> = {
    value: 'John Doe',
    confidence: 0.95,
    sourceDocumentId: '123e4567-e89b-12d3-a456-426614174000',
    sourcePage: 1,
    evidenceQuote: 'Name: John Doe'
  };

  const validExtractedSSN: ExtractedField<string> = {
    value: '123-45-6789',
    confidence: 0.92,
    sourceDocumentId: '123e4567-e89b-12d3-a456-426614174000',
    sourcePage: 2,
    evidenceQuote: 'SSN: 123-45-6789'
  };

  const validExtractedDate: ExtractedField<string> = {
    value: '1985-05-15',
    confidence: 0.88,
    sourceDocumentId: '123e4567-e89b-12d3-a456-426614174000',
    sourcePage: 1,
    evidenceQuote: 'Date of Birth: 05/15/1985'
  };

  const validBorrowerRecord: BorrowerRecord = {
    id: '987e6543-e21b-12d3-a456-426614174000',
    fullName: validExtractedName,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    documentIds: ['123e4567-e89b-12d3-a456-426614174000']
  };

  describe('Valid BorrowerRecord', () => {
    it('should pass validation with all required fields', () => {
      expect(() => BorrowerRecordSchema.parse(validBorrowerRecord))
        .not.toThrow();
    });

    it('should pass validation with optional SSN field', () => {
      const borrowerWithSSN = {
        ...validBorrowerRecord,
        ssn: validExtractedSSN
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithSSN))
        .not.toThrow();
    });

    it('should pass validation with optional dateOfBirth field', () => {
      const borrowerWithDOB = {
        ...validBorrowerRecord,
        dateOfBirth: validExtractedDate
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithDOB))
        .not.toThrow();
    });

    it('should pass validation with multiple document IDs', () => {
      const borrowerWithMultipleDocs = {
        ...validBorrowerRecord,
        documentIds: [
          '123e4567-e89b-12d3-a456-426614174000',
          'abc12345-e89b-12d3-a456-426614174001'
        ]
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithMultipleDocs))
        .not.toThrow();
    });
  });

  describe('Missing Required Fields', () => {
    it('should fail validation when id is missing', () => {
      const { id, ...borrowerWithoutId } = validBorrowerRecord;

      expect(() => BorrowerRecordSchema.parse(borrowerWithoutId))
        .toThrow();
    });

    it('should fail validation when id is not a valid UUID', () => {
      const borrowerWithInvalidId = {
        ...validBorrowerRecord,
        id: 'not-a-uuid'
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithInvalidId))
        .toThrow();
    });

    it('should fail validation when fullName is missing', () => {
      const { fullName, ...borrowerWithoutName } = validBorrowerRecord;

      expect(() => BorrowerRecordSchema.parse(borrowerWithoutName))
        .toThrow();
    });

    it('should fail validation when documentIds is missing', () => {
      const { documentIds, ...borrowerWithoutDocs } = validBorrowerRecord;

      expect(() => BorrowerRecordSchema.parse(borrowerWithoutDocs))
        .toThrow();
    });

    it('should fail validation when documentIds is empty array', () => {
      const borrowerWithEmptyDocs = {
        ...validBorrowerRecord,
        documentIds: []
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithEmptyDocs))
        .toThrow();
    });
  });

  describe('Invalid ExtractedField in BorrowerRecord', () => {
    it('should fail validation when fullName has missing source reference', () => {
      const borrowerWithBadName = {
        ...validBorrowerRecord,
        fullName: {
          value: 'John Doe',
          confidence: 0.95,
          // Missing sourceDocumentId
          sourcePage: 1,
          evidenceQuote: 'Name: John Doe'
        }
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithBadName))
        .toThrow();
    });

    it('should fail validation when fullName has invalid confidence', () => {
      const borrowerWithInvalidConfidence = {
        ...validBorrowerRecord,
        fullName: {
          ...validExtractedName,
          confidence: 1.5 // Greater than 1
        }
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithInvalidConfidence))
        .toThrow();
    });

    it('should fail validation when fullName has empty evidenceQuote', () => {
      const borrowerWithEmptyEvidence = {
        ...validBorrowerRecord,
        fullName: {
          ...validExtractedName,
          evidenceQuote: ''
        }
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithEmptyEvidence))
        .toThrow();
    });

    it('should fail validation when SSN has negative confidence', () => {
      const borrowerWithNegativeConfidence = {
        ...validBorrowerRecord,
        ssn: {
          ...validExtractedSSN,
          confidence: -0.1
        }
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithNegativeConfidence))
        .toThrow();
    });
  });

  describe('DocumentIds Validation', () => {
    it('should fail validation with invalid UUID in documentIds', () => {
      const borrowerWithInvalidDocId = {
        ...validBorrowerRecord,
        documentIds: ['not-a-uuid']
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithInvalidDocId))
        .toThrow();
    });

    it('should fail validation with mix of valid and invalid UUIDs', () => {
      const borrowerWithMixedDocIds = {
        ...validBorrowerRecord,
        documentIds: [
          '123e4567-e89b-12d3-a456-426614174000',
          'invalid-uuid'
        ]
      };

      expect(() => BorrowerRecordSchema.parse(borrowerWithMixedDocIds))
        .toThrow();
    });
  });
});
