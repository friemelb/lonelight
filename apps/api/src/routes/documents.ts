import { Router, Request, Response } from 'express';
import { getDatabase } from '@/database';
import { DocumentRepository, ChunkRepository} from '@/repositories';
import type { ProcessingStatus } from '@loanlens/domain';

export const documentsRouter = Router();

interface DocumentsQuery {
  limit?: string;
  offset?: string;
  status?: string;
  borrowerId?: string;
}

/**
 * GET /api/documents
 * List all documents with optional filters and pagination
 */
documentsRouter.get(
  '/',
  async (req: Request<{}, {}, {}, DocumentsQuery>, res: Response) => {
    try {
      const db = getDatabase();
      const repository = new DocumentRepository(db);

      const options = {
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
        sortBy: 'uploadedAt' as const,
        sortOrder: 'desc' as const
      };

      const filters = {
        status: req.query.status as ProcessingStatus | undefined,
        borrowerId: req.query.borrowerId
      };

      const documents = await repository.findAll(options, filters);
      const total = await repository.count(filters);

      res.status(200).json({
        data: documents,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + documents.length < total
        }
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  }
);

/**
 * GET /api/documents/:id
 * Get a single document by ID
 */
documentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const repository = new DocumentRepository(db);

    const document = await repository.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        error: {
          message: 'Document not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    return res.status(200).json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    throw error;
  }
});

/**
 * GET /api/documents/:id/chunks
 * Get all chunks for a document
 */
documentsRouter.get('/:id/chunks', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const chunkRepository = new ChunkRepository(db);

    const chunks = await chunkRepository.findByDocumentId(req.params.id);

    res.status(200).json({
      data: chunks,
      count: chunks.length
    });
  } catch (error) {
    console.error('Error fetching chunks:', error);
    throw error;
  }
});
