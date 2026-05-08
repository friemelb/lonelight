import { z } from 'zod';

/**
 * Zod schema for ExtractedField with generic value type
 */
export const ExtractedFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.number()
      .min(0, 'Confidence must be at least 0')
      .max(1, 'Confidence must be at most 1'),
    sourceDocumentId: z.string()
      .uuid('Source document ID must be a valid UUID')
      .min(1, 'Source document ID is required'),
    sourcePage: z.number()
      .int('Source page must be an integer')
      .positive('Source page must be positive'),
    evidenceQuote: z.string()
      .min(1, 'Evidence quote is required and cannot be empty'),
    boundingBox: z.tuple([
      z.number().nonnegative(),
      z.number().nonnegative(),
      z.number().nonnegative(),
      z.number().nonnegative()
    ]).optional(),
    extractedAt: z.date().optional(),
    notes: z.string().optional()
  });

/**
 * Specific ExtractedField schemas for common types
 */
export const StringExtractedFieldSchema = ExtractedFieldSchema(z.string());
export const NumberExtractedFieldSchema = ExtractedFieldSchema(z.number());
export const BooleanExtractedFieldSchema = ExtractedFieldSchema(z.boolean());
