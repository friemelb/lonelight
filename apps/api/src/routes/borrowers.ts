import { Router, Request, Response } from 'express';
import { getDatabase } from '@/database';
import { BorrowerRepository, DocumentRepository } from '@/repositories';

export const borrowersRouter = Router();

interface BorrowersQuery {
  limit?: string;
  offset?: string;
  search?: string;
}

/**
 * GET /api/borrowers
 * List all borrowers with optional search and pagination
 */
borrowersRouter.get(
  '/',
  async (req: Request<{}, {}, {}, BorrowersQuery>, res: Response) => {
    try {
      const db = getDatabase();
      const repository = new BorrowerRepository(db);

      const options = {
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
        sortBy: 'updatedAt' as const,
        sortOrder: 'desc' as const
      };

      let borrowers;
      let total;

      if (req.query.search) {
        borrowers = await repository.search(req.query.search);
        total = borrowers.length;
      } else {
        borrowers = await repository.findAll(options);
        total = await repository.count();
      }

      res.status(200).json({
        data: borrowers,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + borrowers.length < total
        }
      });
    } catch (error) {
      console.error('Error fetching borrowers:', error);
      throw error;
    }
  }
);

/**
 * GET /api/borrowers/:id
 * Get a single borrower by ID with all extracted data
 */
borrowersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const repository = new BorrowerRepository(db);

    const borrower = await repository.findById(req.params.id);

    if (!borrower) {
      return res.status(404).json({
        error: {
          message: 'Borrower not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    return res.status(200).json(borrower);
  } catch (error) {
    console.error('Error fetching borrower:', error);
    throw error;
  }
});

/**
 * GET /api/borrowers/:id/documents
 * Get all documents associated with a borrower
 */
borrowersRouter.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const documentRepository = new DocumentRepository(db);

    const documents = await documentRepository.findByBorrowerId(req.params.id);

    res.status(200).json({
      data: documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Error fetching borrower documents:', error);
    throw error;
  }
});
