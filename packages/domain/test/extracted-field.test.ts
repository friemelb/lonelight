import { describe, it, expect } from 'vitest';
import { StringExtractedFieldSchema } from '../src/schemas';
import type { ExtractedField } from '../src/types';

describe('ExtractedField Validation', () => {
  const validExtractedField: ExtractedField<string> = {
    value: 'John Doe',
    confidence: 0.95,
    sourceDocumentId: '123e4567-e89b-12d3-a456-426614174000',
    sourcePage: 1,
    evidenceQuote: 'Name: John Doe'
  };

  describe('Valid ExtractedField', () => {
    it('should pass validation with all required fields', () => {
      expect(() => StringExtractedFieldSchema.parse(validExtractedField))
        .not.toThrow();
    });

    it('should pass validation with optional bounding box', () => {
      const fieldWithBBox = {
        ...validExtractedField,
        boundingBox: [10, 20, 100, 50] as [number, number, number, number]
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithBBox))
        .not.toThrow();
    });

    it('should pass validation with extractedAt timestamp', () => {
      const fieldWithTimestamp = {
        ...validExtractedField,
        extractedAt: new Date()
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithTimestamp))
        .not.toThrow();
    });

    it('should pass validation with notes', () => {
      const fieldWithNotes = {
        ...validExtractedField,
        notes: 'Extracted from header section'
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithNotes))
        .not.toThrow();
    });
  });

  describe('Missing Source References', () => {
    it('should fail validation when sourceDocumentId is missing', () => {
      const { sourceDocumentId, ...fieldWithoutDocId } = validExtractedField;

      expect(() => StringExtractedFieldSchema.parse(fieldWithoutDocId))
        .toThrow();
    });

    it('should fail validation when sourceDocumentId is empty string', () => {
      const fieldWithEmptyDocId = {
        ...validExtractedField,
        sourceDocumentId: ''
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithEmptyDocId))
        .toThrow('Source document ID is required');
    });

    it('should fail validation when sourceDocumentId is not a valid UUID', () => {
      const fieldWithInvalidDocId = {
        ...validExtractedField,
        sourceDocumentId: 'not-a-uuid'
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithInvalidDocId))
        .toThrow('Source document ID must be a valid UUID');
    });

    it('should fail validation when sourcePage is missing', () => {
      const { sourcePage, ...fieldWithoutPage } = validExtractedField;

      expect(() => StringExtractedFieldSchema.parse(fieldWithoutPage))
        .toThrow();
    });

    it('should fail validation when sourcePage is zero', () => {
      const fieldWithZeroPage = {
        ...validExtractedField,
        sourcePage: 0
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithZeroPage))
        .toThrow('Source page must be positive');
    });

    it('should fail validation when sourcePage is negative', () => {
      const fieldWithNegativePage = {
        ...validExtractedField,
        sourcePage: -1
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithNegativePage))
        .toThrow('Source page must be positive');
    });

    it('should fail validation when evidenceQuote is missing', () => {
      const { evidenceQuote, ...fieldWithoutEvidence } = validExtractedField;

      expect(() => StringExtractedFieldSchema.parse(fieldWithoutEvidence))
        .toThrow();
    });

    it('should fail validation when evidenceQuote is empty string', () => {
      const fieldWithEmptyEvidence = {
        ...validExtractedField,
        evidenceQuote: ''
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithEmptyEvidence))
        .toThrow('Evidence quote is required and cannot be empty');
    });
  });

  describe('Invalid Confidence Values', () => {
    it('should fail validation when confidence is less than 0', () => {
      const fieldWithNegativeConfidence = {
        ...validExtractedField,
        confidence: -0.1
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithNegativeConfidence))
        .toThrow('Confidence must be at least 0');
    });

    it('should fail validation when confidence is greater than 1', () => {
      const fieldWithHighConfidence = {
        ...validExtractedField,
        confidence: 1.5
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithHighConfidence))
        .toThrow('Confidence must be at most 1');
    });

    it('should pass validation when confidence is exactly 0', () => {
      const fieldWithZeroConfidence = {
        ...validExtractedField,
        confidence: 0
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithZeroConfidence))
        .not.toThrow();
    });

    it('should pass validation when confidence is exactly 1', () => {
      const fieldWithMaxConfidence = {
        ...validExtractedField,
        confidence: 1
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithMaxConfidence))
        .not.toThrow();
    });

    it('should fail validation when confidence is missing', () => {
      const { confidence, ...fieldWithoutConfidence } = validExtractedField;

      expect(() => StringExtractedFieldSchema.parse(fieldWithoutConfidence))
        .toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should fail validation when value is missing', () => {
      const { value, ...fieldWithoutValue } = validExtractedField;

      expect(() => StringExtractedFieldSchema.parse(fieldWithoutValue))
        .toThrow();
    });

    it('should fail validation with invalid bounding box (wrong array length)', () => {
      const fieldWithInvalidBBox = {
        ...validExtractedField,
        boundingBox: [10, 20, 100] // Only 3 elements instead of 4
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithInvalidBBox))
        .toThrow();
    });

    it('should fail validation with negative bounding box coordinates', () => {
      const fieldWithNegativeBBox = {
        ...validExtractedField,
        boundingBox: [-10, 20, 100, 50] as [number, number, number, number]
      };

      expect(() => StringExtractedFieldSchema.parse(fieldWithNegativeBBox))
        .toThrow();
    });
  });
});
