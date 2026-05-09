import { Router, Request, Response } from 'express';
import { getDatabase } from '@/database';
import { BorrowerRepository, DocumentRepository, ChunkRepository, MetricsRepository, ReviewRepository } from '@/repositories';
import { ExtractionService } from '@/services/ExtractionService';
import { config } from '@/config';
import { Logger } from '@/utils/logger';
import { ProcessingStatus, BorrowerRecord, ReviewStatus } from '@loanlens/domain';
import { v4 as uuidv4 } from 'uuid';

/**
 * Individual extraction error
 */
interface ExtractionError {
  documentId?: string;
  message: string;
  type: 'validation' | 'api' | 'parsing' | 'database';
  details?: unknown;
}

/**
 * Result of extraction operation for a single borrower
 */
interface BorrowerExtractionResult {
  borrower: BorrowerRecord;
  documentIds: string[];
  extractedAt: Date;
}

/**
 * Response from extraction endpoint
 */
interface ExtractionResponse {
  success: boolean;
  data: {
    borrowers: BorrowerExtractionResult[];
    stats: {
      totalDocuments: number;
      totalChunks: number;
      borrowersExtracted: number;
      durationMs: number;
    };
  };
  errors: ExtractionError[];
}

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
 * GET /api/borrowers/review-queue
 * Get borrowers pending review (must be before /:id route to avoid conflict)
 */
borrowersRouter.get('/review-queue', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const repository = new BorrowerRepository(db);

    const options = {
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      sortBy: 'updatedAt' as const,
      sortOrder: 'desc' as const
    };

    const borrowers = await repository.findByReviewStatus(
      ReviewStatus.PENDING_REVIEW,
      options
    );

    const total = await repository.countByReviewStatus(ReviewStatus.PENDING_REVIEW);

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
    console.error('Error fetching review queue:', error);
    throw error;
  }
});

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

/**
 * POST /api/borrowers/extract
 * Extract borrower information from all documents using OpenAI
 */
borrowersRouter.post('/extract', async (_req: Request, res: Response) => {
  const extractionStart = Date.now();

  try {
    // Check if OpenAI API key is configured
    if (!config.openai.apiKey || config.openai.apiKey.trim() === '') {
      Logger.error('OpenAI API key missing', new Error('OPENAI_API_KEY not configured'), {
        operation: 'extraction'
      });

      return res.status(500).json({
        error: {
          message: 'OpenAI API key is not configured. Please set OPENAI_API_KEY in .env file.',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }

    const db = getDatabase();
    const documentRepository = new DocumentRepository(db);
    const chunkRepository = new ChunkRepository(db);
    const borrowerRepository = new BorrowerRepository(db);
    const metricsRepository = new MetricsRepository(db);

    Logger.info('Starting borrower extraction from all documents', {
      operation: 'extraction'
    });

    // Get all documents
    const documents = await documentRepository.findAll({ limit: 1000, offset: 0 });

    if (documents.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          borrowers: [],
          stats: {
            totalDocuments: 0,
            totalChunks: 0,
            borrowersExtracted: 0,
            durationMs: Date.now() - extractionStart
          }
        },
        errors: []
      });
    }

    // Get all chunks for all documents
    const allChunks = [];
    for (const doc of documents) {
      const chunks = await chunkRepository.findByDocumentId(doc.id);
      allChunks.push(...chunks);
    }

    Logger.info('Loaded documents and chunks', {
      operation: 'extraction',
      documentCount: documents.length,
      chunkCount: allChunks.length
    });

    // Initialize extraction service
    const extractionService = new ExtractionService(config.openai.apiKey, config.openai.model);

    // Extract borrowers in batches (5 docs per batch to avoid rate limits)
    const extractionResult = await extractionService.extractBorrowersInBatches(
      {
        documents,
        chunks: allChunks
      },
      {
        maxDocumentsPerBatch: 5,
        maxChunksPerBatch: 30,
        maxCharactersPerBatch: 40000
      }
    );

    const extractionErrors: ExtractionError[] = [];

    if (!extractionResult.success) {
      // Record extraction failure metric
      await metricsRepository.createProcessingMetric({
        documentId: documents[0]?.id || 'unknown',
        metricType: 'extraction',
        startedAt: new Date(extractionStart),
        completedAt: new Date(),
        durationMs: Date.now() - extractionStart,
        success: false,
        errorMessage: extractionResult.error,
        metadata: {
          documentCount: documents.length,
          chunkCount: allChunks.length,
          validationErrors: extractionResult.validationErrors
        }
      });

      extractionErrors.push({
        message: extractionResult.error || 'Extraction failed',
        type: 'api',
        details: extractionResult.validationErrors
      });

      return res.status(422).json({
        success: false,
        data: {
          borrowers: [],
          stats: {
            totalDocuments: documents.length,
            totalChunks: allChunks.length,
            borrowersExtracted: 0,
            durationMs: Date.now() - extractionStart
          }
        },
        errors: extractionErrors
      });
    }

    // Save extracted borrowers to database
    const savedBorrowers = [];
    for (const borrower of extractionResult.borrowers) {
      try {
        // Upsert borrower record (update if exists, create if not)
        await borrowerRepository.upsert(borrower);

        // Link documents to borrower
        for (const docId of borrower.documentIds) {
          try {
            await documentRepository.update(docId, {
              borrowerId: borrower.id,
              status: ProcessingStatus.COMPLETED
            });
          } catch (linkError) {
            Logger.error(`Failed to link document ${docId} to borrower`, linkError as Error, {
              operation: 'extraction',
              borrowerId: borrower.id,
              documentId: docId
            });
          }
        }

        savedBorrowers.push({
          borrower,
          documentIds: borrower.documentIds,
          extractedAt: new Date()
        });

        Logger.info('Saved borrower', {
          operation: 'extraction',
          borrowerId: borrower.id,
          documentCount: borrower.documentIds.length
        });
      } catch (saveError) {
        const errorMsg = saveError instanceof Error ? saveError.message : 'Unknown database error';

        Logger.error('Failed to save borrower', saveError as Error, {
          operation: 'extraction',
          borrowerId: borrower.id
        });

        extractionErrors.push({
          message: `Failed to save borrower: ${errorMsg}`,
          type: 'database',
          details: saveError
        });
      }
    }

    const extractionDuration = Date.now() - extractionStart;

    // Record extraction success metric
    await metricsRepository.createProcessingMetric({
      documentId: documents[0]?.id || 'batch',
      metricType: 'extraction',
      startedAt: new Date(extractionStart),
      completedAt: new Date(),
      durationMs: extractionDuration,
      success: true,
      metadata: {
        documentCount: documents.length,
        chunkCount: allChunks.length,
        borrowerCount: savedBorrowers.length,
        retryAttempted: extractionResult.retryAttempted || false
      }
    });

    Logger.info('Extraction completed', {
      operation: 'extraction',
      borrowerCount: savedBorrowers.length,
      errorCount: extractionErrors.length,
      duration: extractionDuration
    });

    const response: ExtractionResponse = {
      success: true,
      data: {
        borrowers: savedBorrowers,
        stats: {
          totalDocuments: documents.length,
          totalChunks: allChunks.length,
          borrowersExtracted: savedBorrowers.length,
          durationMs: extractionDuration
        }
      },
      errors: extractionErrors
    };

    return res.status(200).json(response);
  } catch (error) {
    const extractionDuration = Date.now() - extractionStart;

    Logger.error('Fatal error during extraction', error as Error, {
      operation: 'extraction',
      duration: extractionDuration
    });

    return res.status(500).json({
      error: {
        message: 'Internal server error during extraction',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/borrowers/:id/review
 * Review a borrower (approve or reject)
 */
borrowersRouter.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        error: {
          message: 'Invalid action. Must be "approve" or "reject"',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    const db = getDatabase();
    const borrowerRepository = new BorrowerRepository(db);
    const reviewRepository = new ReviewRepository(db);

    // Get current borrower
    const borrower = await borrowerRepository.findById(id);
    if (!borrower) {
      return res.status(404).json({
        error: {
          message: 'Borrower not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    const previousStatus = borrower.reviewStatus;
    const newStatus = action === 'approve' ? ReviewStatus.APPROVED : ReviewStatus.REJECTED;

    // Update review status
    await borrowerRepository.updateReviewStatus(id, newStatus, notes);

    // Create audit log entry
    await reviewRepository.createReviewAction(
      id,
      action === 'approve' ? 'approved' : 'rejected',
      previousStatus,
      newStatus,
      notes
    );

    // Fetch updated borrower
    const updatedBorrower = await borrowerRepository.findById(id);

    return res.status(200).json({
      success: true,
      borrower: updatedBorrower
    });
  } catch (error) {
    console.error('Error reviewing borrower:', error);
    throw error;
  }
});

/**
 * PATCH /api/borrowers/:id/field
 * Correct a specific field value
 */
borrowersRouter.patch('/:id/field', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fieldName, correctedValue, correctionNote } = req.body;

    // Validate request
    if (!fieldName || correctedValue === undefined) {
      return res.status(400).json({
        error: {
          message: 'fieldName and correctedValue are required',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    const db = getDatabase();
    const borrowerRepository = new BorrowerRepository(db);
    const reviewRepository = new ReviewRepository(db);

    // Get current borrower
    const borrower = await borrowerRepository.findById(id);
    if (!borrower) {
      return res.status(404).json({
        error: {
          message: 'Borrower not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get the original field value
    const originalField = (borrower as any)[fieldName];
    if (!originalField) {
      return res.status(400).json({
        error: {
          message: `Field '${fieldName}' not found on borrower`,
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create field correction record
    await reviewRepository.createFieldCorrection(
      id,
      fieldName,
      originalField,
      correctedValue,
      correctionNote
    );

    // Update the borrower field
    const updatedBorrower = { ...borrower };
    (updatedBorrower as any)[fieldName] = {
      ...originalField,
      value: correctedValue
    };

    // Update borrower in database
    await borrowerRepository.update(id, updatedBorrower);

    // Update status to corrected if not already
    const previousStatus = borrower.reviewStatus;
    if (previousStatus !== ReviewStatus.CORRECTED) {
      await borrowerRepository.updateReviewStatus(
        id,
        ReviewStatus.CORRECTED,
        `Field '${fieldName}' corrected`
      );

      // Create audit log entry
      await reviewRepository.createReviewAction(
        id,
        'corrected',
        previousStatus,
        ReviewStatus.CORRECTED,
        `Field '${fieldName}' corrected`
      );
    }

    // Fetch final updated borrower
    const finalBorrower = await borrowerRepository.findById(id);

    return res.status(200).json({
      success: true,
      borrower: finalBorrower
    });
  } catch (error) {
    console.error('Error correcting field:', error);
    throw error;
  }
});

/**
 * GET /api/borrowers/:id/audit-history
 * Get audit history for a borrower
 */
borrowersRouter.get('/:id/audit-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const borrowerRepository = new BorrowerRepository(db);
    const reviewRepository = new ReviewRepository(db);

    // Verify borrower exists
    const borrower = await borrowerRepository.findById(id);
    if (!borrower) {
      return res.status(404).json({
        error: {
          message: 'Borrower not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get audit history and corrections
    const auditHistory = await reviewRepository.getAuditHistory(id);
    const corrections = await reviewRepository.getCorrectionsForBorrower(id);

    return res.status(200).json({
      borrowerId: id,
      auditHistory,
      corrections
    });
  } catch (error) {
    console.error('Error fetching audit history:', error);
    throw error;
  }
});
