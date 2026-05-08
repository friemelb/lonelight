import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '@/database';
import { DocumentRepository, ChunkRepository, MetricsRepository } from '@/repositories';
import { FileService } from '@/services/FileService';
import { ParsingService } from '@/services/ParsingService';
import { ProcessingStatus, DocumentRecord } from '@loanlens/domain';
import { Logger } from '@/utils/logger';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ingestRouter = Router();

interface IngestResponse {
  total: number;
  successful: number;
  failed: number;
  parsed: number;
  parseFailed: number;
  totalChunks: number;
  documents: DocumentRecord[];
  errors: Array<{ filename: string; error: string }>;
}

/**
 * POST /api/ingest
 * Scan the corpus directory and ingest all documents into the database
 */
ingestRouter.post('/', async (_req: Request, res: Response) => {
  const ingestionStart = Date.now();

  try {
    const db = getDatabase();
    const documentRepository = new DocumentRepository(db);
    const metricsRepository = new MetricsRepository(db);
    const fileService = new FileService();

    // Define the corpus directory path
    const corpusPath = path.join(__dirname, '../../data/corpus');
    const dataPath = path.join(__dirname, '../../data');

    Logger.info('Starting document ingestion', { operation: 'ingestion', corpusPath });

    // Scan the corpus directory
    let files;
    try {
      files = await fileService.scanDirectory(corpusPath);
      Logger.info('Corpus directory scanned', { fileCount: files.length });
    } catch (error) {
      Logger.error('Failed to scan corpus directory', error as Error, { corpusPath });
      return res.status(500).json({
        error: {
          message: 'Failed to scan corpus directory',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }

    const documents: DocumentRecord[] = [];
    const errors: Array<{ filename: string; error: string }> = [];
    let successful = 0;
    let failed = 0;

    // Process each file found
    for (const file of files) {
      const documentId = randomUUID();
      const now = new Date();

      // Calculate relative path from data directory
      const relativeFromData = path.relative(dataPath, file.fullPath);

      // Check if file type is supported
      const isSupported = fileService.isSupportedFileType(file.filename);

      let document: DocumentRecord;

      if (isSupported) {
        // Create document record with UPLOADED status
        document = {
          id: documentId,
          filename: file.filename,
          mimeType: file.mimeType,
          fileSize: file.size,
          storagePath: relativeFromData,
          status: ProcessingStatus.UPLOADED,
          uploadedAt: now,
          updatedAt: now
        };
        successful++;
      } else {
        // Create document record with FAILED status
        const extension = path.extname(file.filename);
        const errorMessage = `Unsupported file type: ${extension}`;

        document = {
          id: documentId,
          filename: file.filename,
          mimeType: file.mimeType,
          fileSize: file.size,
          storagePath: relativeFromData,
          status: ProcessingStatus.FAILED,
          uploadedAt: now,
          updatedAt: now,
          errorMessage
        };

        errors.push({
          filename: file.filename,
          error: errorMessage
        });
        failed++;
      }

      // Save to database
      try {
        await documentRepository.create(document);
        documents.push(document);
      } catch (dbError) {
        Logger.error(`Failed to save document ${file.filename}`, dbError as Error, {
          filename: file.filename,
          documentId
        });
        errors.push({
          filename: file.filename,
          error: 'Database error: Failed to save document'
        });
        failed++;
      }
    }

    // NEW: Parse and chunk successfully ingested documents
    const parsingService = new ParsingService();
    const chunkRepository = new ChunkRepository(db);

    let parsedCount = 0;
    let parseFailedCount = 0;
    let totalChunks = 0;

    for (const doc of documents) {
      // Only parse documents that were successfully ingested (UPLOADED status)
      if (doc.status !== ProcessingStatus.UPLOADED) {
        continue;
      }

      const parsingStart = Date.now();

      try {
        Logger.info('Starting document parsing', {
          operation: 'parsing',
          documentId: doc.id,
          filename: doc.filename
        });

        // Update status to PROCESSING
        await documentRepository.updateStatus(doc.id, ProcessingStatus.PROCESSING);

        // Parse and chunk the document
        const parseResult = await parsingService.parseAndChunkDocument(doc);

        if (parseResult.success && parseResult.chunks.length > 0) {
          // Save chunks to database
          await chunkRepository.createMany(parseResult.chunks);

          const parsingDuration = Date.now() - parsingStart;

          Logger.info('Document parsing completed', {
            operation: 'parsing',
            documentId: doc.id,
            filename: doc.filename,
            chunkCount: parseResult.chunks.length,
            duration: parsingDuration
          });

          // Record parsing metric
          await metricsRepository.createProcessingMetric({
            documentId: doc.id,
            metricType: 'parsing',
            startedAt: new Date(parsingStart),
            completedAt: new Date(),
            durationMs: parsingDuration,
            success: true,
            metadata: {
              chunkCount: parseResult.chunks.length,
              filename: doc.filename
            }
          });

          // Update document status to EXTRACTED
          await documentRepository.updateStatus(doc.id, ProcessingStatus.EXTRACTED);

          // Update document with page count
          await documentRepository.update(doc.id, {
            pageCount: parseResult.chunks.length
          });

          // Update the document object in memory (for response)
          doc.status = ProcessingStatus.EXTRACTED;
          doc.pageCount = parseResult.chunks.length;

          parsedCount++;
          totalChunks += parseResult.chunks.length;
        } else {
          // Parsing failed
          const errorMsg = parseResult.error || 'Failed to parse document';
          const parsingDuration = Date.now() - parsingStart;

          Logger.error('Document parsing failed', new Error(errorMsg), {
            operation: 'parsing',
            documentId: doc.id,
            filename: doc.filename,
            duration: parsingDuration
          });

          // Record parsing failure metric
          await metricsRepository.createProcessingMetric({
            documentId: doc.id,
            metricType: 'parsing',
            startedAt: new Date(parsingStart),
            completedAt: new Date(),
            durationMs: parsingDuration,
            success: false,
            errorMessage: errorMsg,
            metadata: { filename: doc.filename }
          });

          await documentRepository.updateStatus(
            doc.id,
            ProcessingStatus.FAILED,
            errorMsg
          );

          // Update the document object in memory
          doc.status = ProcessingStatus.FAILED;
          doc.errorMessage = errorMsg;

          parseFailedCount++;
          errors.push({
            filename: doc.filename,
            error: errorMsg
          });
        }
      } catch (error) {
        // Handle unexpected errors
        const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
        const parsingDuration = Date.now() - parsingStart;

        Logger.error(`Unexpected error parsing document ${doc.filename}`, error as Error, {
          operation: 'parsing',
          documentId: doc.id,
          filename: doc.filename,
          duration: parsingDuration
        });

        // Record parsing failure metric
        await metricsRepository.createProcessingMetric({
          documentId: doc.id,
          metricType: 'parsing',
          startedAt: new Date(parsingStart),
          completedAt: new Date(),
          durationMs: parsingDuration,
          success: false,
          errorMessage: errorMsg,
          metadata: { filename: doc.filename }
        });

        await documentRepository.updateStatus(
          doc.id,
          ProcessingStatus.FAILED,
          errorMsg
        );

        doc.status = ProcessingStatus.FAILED;
        doc.errorMessage = errorMsg;

        parseFailedCount++;
        errors.push({
          filename: doc.filename,
          error: errorMsg
        });
      }
    }

    const ingestionDuration = Date.now() - ingestionStart;

    Logger.info('Parsing phase complete', {
      operation: 'parsing',
      parsedCount,
      parseFailedCount,
      totalChunks
    });

    Logger.info('Ingestion complete', {
      operation: 'ingestion',
      total: files.length,
      successful,
      failed,
      parsed: parsedCount,
      parseFailed: parseFailedCount,
      totalChunks,
      duration: ingestionDuration
    });

    // Return response
    const response: IngestResponse = {
      total: files.length,
      successful,
      failed,
      parsed: parsedCount,
      parseFailed: parseFailedCount,
      totalChunks,
      documents,
      errors
    };

    return res.status(200).json(response);
  } catch (error) {
    Logger.error('Fatal error during ingestion', error as Error, {
      operation: 'ingestion',
      duration: Date.now() - ingestionStart
    });
    return res.status(500).json({
      error: {
        message: 'Internal server error during ingestion',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});
