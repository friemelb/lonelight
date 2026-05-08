import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { getDatabase } from '@/database';
import { DocumentRepository } from '@/repositories';
import { FileService } from '@/services/FileService';
import { ProcessingStatus, DocumentRecord } from '@loanlens/domain';

export const ingestRouter = Router();

interface IngestResponse {
  total: number;
  successful: number;
  failed: number;
  documents: DocumentRecord[];
  errors: Array<{ filename: string; error: string }>;
}

/**
 * POST /api/ingest
 * Scan the corpus directory and ingest all documents into the database
 */
ingestRouter.post('/', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const documentRepository = new DocumentRepository(db);
    const fileService = new FileService();

    // Define the corpus directory path
    const corpusPath = path.join(__dirname, '../../data/corpus');
    const dataPath = path.join(__dirname, '../../data');

    console.log(`Scanning corpus directory: ${corpusPath}`);

    // Scan the corpus directory
    let files;
    try {
      files = await fileService.scanDirectory(corpusPath);
    } catch (error) {
      console.error('Error scanning corpus directory:', error);
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
        console.error(`Failed to save document ${file.filename}:`, dbError);
        errors.push({
          filename: file.filename,
          error: 'Database error: Failed to save document'
        });
        failed++;
      }
    }

    // Return response
    const response: IngestResponse = {
      total: files.length,
      successful,
      failed,
      documents,
      errors
    };

    console.log(
      `Ingestion complete: ${successful} successful, ${failed} failed out of ${files.length} total`
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error during ingestion:', error);
    return res.status(500).json({
      error: {
        message: 'Internal server error during ingestion',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});
