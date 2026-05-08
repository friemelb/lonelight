import { z } from 'zod';
import { ProcessingStatusSchema } from './status.schemas';

/**
 * Zod schema for DocumentRecord
 */
export const DocumentRecordSchema = z.object({
  id: z.string().uuid('Document ID must be a valid UUID'),
  filename: z.string().min(1, 'Filename cannot be empty'),
  mimeType: z.string().regex(
    /^[a-z]+\/[a-z0-9\-\+\.]+$/i,
    'Invalid MIME type format'
  ),
  fileSize: z.number().int().positive('File size must be positive'),
  storagePath: z.string().min(1, 'Storage path cannot be empty'),
  status: ProcessingStatusSchema,
  uploadedAt: z.date(),
  updatedAt: z.date(),
  pageCount: z.number().int().positive().optional(),
  borrowerId: z.string().uuid().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Zod schema for DocumentChunk
 */
export const DocumentChunkSchema = z.object({
  id: z.string().uuid('Chunk ID must be a valid UUID'),
  documentId: z.string().uuid('Document ID must be a valid UUID'),
  pageNumber: z.number().int().positive('Page number must be positive'),
  content: z.string().min(1, 'Content cannot be empty'),
  chunkIndex: z.number().int().nonnegative('Chunk index must be non-negative'),
  boundingBox: z.tuple([
    z.number().nonnegative(),
    z.number().nonnegative(),
    z.number().nonnegative(),
    z.number().nonnegative()
  ]).optional(),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1').optional(),
  extractedAt: z.date()
});
