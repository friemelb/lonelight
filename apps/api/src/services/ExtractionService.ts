/**
 * ExtractionService: OpenAI-powered borrower data extraction
 *
 * Extracts structured borrower information from document chunks using GPT-4o.
 * Validates responses with Zod schemas and implements retry logic.
 */

import OpenAI from 'openai';
import { DocumentRecord, DocumentChunk, BorrowerRecord, ReviewStatus } from '@loanlens/domain';
import {
  OpenAIExtractionResponseSchema,
  type BorrowerExtractionType
} from '@/schemas/borrowerExtraction.schema';
import { Logger } from '@/utils/logger';
import { randomUUID } from 'crypto';

/**
 * Internal extraction result from service
 */
export interface ExtractionServiceResult {
  success: boolean;
  borrowers: BorrowerRecord[];
  error?: string;
  validationErrors?: string[];
  retryAttempted?: boolean;
}

export interface ExtractionContext {
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
}

/**
 * Batch configuration for processing documents in chunks
 */
export interface BatchConfig {
  maxDocumentsPerBatch: number;  // Max documents per OpenAI call
  maxChunksPerBatch: number;     // Safety limit on chunks
  maxCharactersPerBatch: number; // Token limit proxy (~4 chars/token)
}

/**
 * Context for a single batch
 */
interface BatchContext {
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
  batchIndex: number;
}

/**
 * Default batch configuration (5 docs, ~9.5K tokens per batch)
 */
const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxDocumentsPerBatch: 5,
  maxChunksPerBatch: 30,
  maxCharactersPerBatch: 40000
};

export class ExtractionService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-2024-11-20') {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = model;

    Logger.info('ExtractionService initialized', {
      service: 'extraction',
      model: this.model
    });
  }

  /**
   * Extract borrower information from all documents and chunks
   */
  async extractBorrowersFromAllDocuments(
    context: ExtractionContext
  ): Promise<ExtractionServiceResult> {
    const startTime = Date.now();

    try {
      Logger.info('Starting borrower extraction', {
        operation: 'extraction',
        documentCount: context.documents.length,
        chunkCount: context.chunks.length
      });

      // Build comprehensive prompt with all context
      const prompt = this.buildExtractionPrompt(context);

      // First attempt
      Logger.info('Calling OpenAI API (attempt 1)', {
        operation: 'extraction',
        model: this.model,
        promptLength: prompt.length
      });

      let response = await this.callOpenAI(prompt);
      let parseResult = this.parseAndValidateResponse(response);

      // Retry once if validation fails
      if (!parseResult.success && parseResult.error) {
        Logger.warn('First extraction attempt failed, retrying', {
          operation: 'extraction',
          error: parseResult.error,
          validationErrors: parseResult.validationErrors
        });

        const retryPrompt = this.buildRetryPrompt(context, parseResult.error);

        Logger.info('Calling OpenAI API (attempt 2 - retry)', {
          operation: 'extraction',
          model: this.model
        });

        response = await this.callOpenAI(retryPrompt);
        parseResult = this.parseAndValidateResponse(response);
        parseResult.retryAttempted = true;
      }

      const duration = Date.now() - startTime;

      if (parseResult.success) {
        // Convert validated extractions to BorrowerRecord format
        const borrowers = parseResult.borrowers.map(b => this.convertToBorrowerRecord(b));

        Logger.info('Borrower extraction completed successfully', {
          operation: 'extraction',
          borrowerCount: borrowers.length,
          duration
        });

        return {
          success: true,
          borrowers,
          retryAttempted: parseResult.retryAttempted
        };
      } else {
        Logger.error('Borrower extraction failed after retry', new Error(parseResult.error), {
          operation: 'extraction',
          validationErrors: parseResult.validationErrors,
          duration
        });

        return {
          success: false,
          borrowers: [],
          error: parseResult.error,
          validationErrors: parseResult.validationErrors,
          retryAttempted: parseResult.retryAttempted
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      Logger.error('Extraction service error', error as Error, {
        operation: 'extraction',
        duration
      });

      return {
        success: false,
        borrowers: [],
        error: `Extraction service error: ${errorMessage}`
      };
    }
  }

  /**
   * Build extraction prompt with document context
   */
  private buildExtractionPrompt(context: ExtractionContext): string {
    // Group chunks by document
    const chunksByDoc = new Map<string, DocumentChunk[]>();
    for (const chunk of context.chunks) {
      if (!chunksByDoc.has(chunk.documentId)) {
        chunksByDoc.set(chunk.documentId, []);
      }
      chunksByDoc.get(chunk.documentId)!.push(chunk);
    }

    // Build context string with document metadata
    let contextText = '';
    for (const doc of context.documents) {
      const docChunks = chunksByDoc.get(doc.id) || [];
      contextText += `\n\n=== DOCUMENT: ${doc.filename} (ID: ${doc.id}) ===\n`;

      for (const chunk of docChunks) {
        contextText += `\n[CHUNK ${chunk.id} - Page ${chunk.pageNumber}]\n${chunk.content}\n`;
      }
    }

    return `You are an expert at extracting structured borrower information from mortgage loan documents.

CONTEXT - Document chunks to analyze:
${contextText}

TASK:
Extract all borrower information from the documents above. Return a JSON object with the following structure:

{
  "borrowers": [
    {
      "fullName": {
        "value": "John Doe",
        "confidence": 0.95,
        "sourceDocumentId": "uuid-of-document",
        "sourcePage": 1,
        "evidenceQuote": "exact quote from document"
      },
      "firstName": { ... },  // Same structure
      "lastName": { ... },
      "ssn": { ... },
      "dateOfBirth": { ... },
      "phoneNumber": { ... },
      "email": { ... },
      "currentAddress": {
        "street": { "value": "...", "confidence": 0.9, "sourceDocumentId": "...", "sourcePage": 1, "evidenceQuote": "..." },
        "city": { ... },
        "state": { ... },
        "zipCode": { ... }
      },
      "previousAddresses": [ { street: {...}, city: {...}, ... } ],
      "incomeHistory": {
        "value": [
          {
            "employer": { "value": "...", "confidence": 0.9, "sourceDocumentId": "...", "sourcePage": 1, "evidenceQuote": "..." },
            "incomeType": { "value": "W2", ... },
            "frequency": { "value": "BIWEEKLY", ... },
            "grossAmount": { "value": 5000, ... },
            "startDate": { "value": "2020-01-01", ... },
            "isCurrent": { "value": true, ... }
          }
        ],
        "confidence": 0.9,
        "sourceDocumentId": "uuid",
        "sourcePage": 1,
        "evidenceQuote": "quote"
      },
      "accountNumbers": [
        { "value": "1234567890", "confidence": 0.9, "sourceDocumentId": "...", "sourcePage": 1, "evidenceQuote": "..." }
      ],
      "loanNumbers": [
        { "value": "LN-123456", "confidence": 0.9, "sourceDocumentId": "...", "sourcePage": 1, "evidenceQuote": "..." }
      ],
      "documentIds": ["uuid1", "uuid2"]  // List of document IDs this borrower appears in
    }
  ]
}

CRITICAL REQUIREMENTS:
1. EVERY field must include:
   - value: The extracted data
   - confidence: Number between 0 and 1 (your confidence in this extraction)
   - sourceDocumentId: The UUID of the document this came from
   - sourcePage: The page number (from the CHUNK header)
   - evidenceQuote: The EXACT quote from the document that supports this extraction

2. For incomeType, use: "W2", "SELF_EMPLOYMENT", "RENTAL", "INVESTMENT", "RETIREMENT", "SOCIAL_SECURITY", or "OTHER"

3. For frequency, use: "HOURLY", "WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "QUARTERLY", or "ANNUAL"

4. If a borrower appears in multiple documents, list all documentIds

5. Include only fields where you have evidence. Omit fields you cannot find.

6. Confidence scoring guide:
   - 0.9-1.0: Explicit, clear statement
   - 0.7-0.89: Strong inference from context
   - 0.5-0.69: Reasonable inference
   - Below 0.5: Uncertain, avoid extracting

7. Return ONLY the JSON object, no additional text.

Extract the borrower information now:`;
  }

  /**
   * Build retry prompt with error context
   */
  private buildRetryPrompt(context: ExtractionContext, previousError: string): string {
    const basePrompt = this.buildExtractionPrompt(context);
    return `${basePrompt}

IMPORTANT: The previous extraction attempt failed with this error:
${previousError}

Please carefully review the requirements and provide a valid JSON response that matches the exact schema specified above.
Pay special attention to:
- All confidence values must be between 0 and 1
- All sourceDocumentId fields must be valid UUIDs from the documents provided
- All evidenceQuote fields must contain actual text quotes
- The response must be valid, parseable JSON

Try again:`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a mortgage document analysis expert. You extract structured data from loan documents with high accuracy. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,  // Low temperature for consistent, factual extraction
        max_tokens: 16000  // Allow for detailed extraction
      });

      const response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new Error('OpenAI returned empty response');
      }

      return response;
    } catch (error) {
      // Handle OpenAI API errors
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { message: string; status?: number };
        throw new Error(`OpenAI API error: ${apiError.message} (status: ${apiError.status || 'unknown'})`);
      }
      throw error;
    }
  }

  /**
   * Parse and validate OpenAI response
   */
  private parseAndValidateResponse(response: string): {
    success: boolean;
    borrowers: BorrowerExtractionType[];
    error?: string;
    validationErrors?: string[];
    retryAttempted?: boolean;
  } {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      // Validate with Zod
      const result = OpenAIExtractionResponseSchema.safeParse(parsed);

      if (result.success) {
        return {
          success: true,
          borrowers: result.data.borrowers
        };
      } else {
        const validationErrors = result.error.issues.map(
          (e: any) => `${e.path.join('.')}: ${e.message}`
        );

        return {
          success: false,
          borrowers: [],
          error: 'Validation failed: ' + validationErrors.join('; '),
          validationErrors
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';

      return {
        success: false,
        borrowers: [],
        error: `JSON parsing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Convert validated extraction to BorrowerRecord format
   */
  private convertToBorrowerRecord(extraction: BorrowerExtractionType): BorrowerRecord {
    const now = new Date();

    return {
      id: extraction.id || randomUUID(),
      fullName: extraction.fullName as any,
      firstName: extraction.firstName as any,
      middleName: extraction.middleName as any,
      lastName: extraction.lastName as any,
      ssn: extraction.ssn as any,
      dateOfBirth: extraction.dateOfBirth as any,
      phoneNumber: extraction.phoneNumber as any,
      alternatePhoneNumber: extraction.alternatePhoneNumber as any,
      email: extraction.email as any,
      currentAddress: extraction.currentAddress as any,
      previousAddresses: extraction.previousAddresses as any,
      incomeHistory: extraction.incomeHistory as any,
      accountNumbers: extraction.accountNumbers as any,
      loanNumbers: extraction.loanNumbers as any,
      createdAt: extraction.createdAt ? new Date(extraction.createdAt) : now,
      updatedAt: extraction.updatedAt ? new Date(extraction.updatedAt) : now,
      documentIds: extraction.documentIds || [],
      reviewStatus: ReviewStatus.PENDING_REVIEW
    };
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Call OpenAI with exponential backoff retry for 429 errors
   */
  private async callOpenAIWithRetry(prompt: string, maxRetries: number = 3): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.callOpenAI(prompt);
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error (429)
        if (error && typeof error === 'object' && 'status' in error) {
          const statusError = error as { status?: number };

          if (statusError.status === 429) {
            // Exponential backoff: 5s, 10s, 20s
            const delayMs = Math.pow(2, attempt) * 5000;

            Logger.warn(`Rate limit hit (429), retrying in ${delayMs}ms`, {
              operation: 'extraction',
              attempt: attempt + 1,
              maxRetries
            });

            await this.delay(delayMs);
            continue;
          }
        }

        // Non-rate-limit error, don't retry
        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * Create document batches based on config limits
   */
  private createDocumentBatches(
    context: ExtractionContext,
    config: BatchConfig
  ): BatchContext[] {
    const batches: BatchContext[] = [];
    const { documents, chunks } = context;

    // Group chunks by document
    const chunksByDoc = new Map<string, DocumentChunk[]>();
    for (const chunk of chunks) {
      if (!chunksByDoc.has(chunk.documentId)) {
        chunksByDoc.set(chunk.documentId, []);
      }
      chunksByDoc.get(chunk.documentId)!.push(chunk);
    }

    let currentBatch: DocumentRecord[] = [];
    let currentChunkCount = 0;
    let currentCharCount = 0;

    for (const doc of documents) {
      const docChunks = chunksByDoc.get(doc.id) || [];
      const docChunkCount = docChunks.length;
      const docCharCount = docChunks.reduce((sum, c) => sum + c.content.length, 0);

      // Check if adding this document would exceed limits
      const wouldExceedDocs = currentBatch.length >= config.maxDocumentsPerBatch;
      const wouldExceedChunks = currentChunkCount + docChunkCount > config.maxChunksPerBatch;
      const wouldExceedChars = currentCharCount + docCharCount > config.maxCharactersPerBatch;

      if (currentBatch.length > 0 && (wouldExceedDocs || wouldExceedChunks || wouldExceedChars)) {
        // Start new batch
        const batchChunks: DocumentChunk[] = [];
        for (const batchDoc of currentBatch) {
          batchChunks.push(...(chunksByDoc.get(batchDoc.id) || []));
        }

        batches.push({
          documents: currentBatch,
          chunks: batchChunks,
          batchIndex: batches.length
        });

        currentBatch = [doc];
        currentChunkCount = docChunkCount;
        currentCharCount = docCharCount;
      } else {
        // Add to current batch
        currentBatch.push(doc);
        currentChunkCount += docChunkCount;
        currentCharCount += docCharCount;
      }
    }

    // Add final batch
    if (currentBatch.length > 0) {
      const batchChunks: DocumentChunk[] = [];
      for (const batchDoc of currentBatch) {
        batchChunks.push(...(chunksByDoc.get(batchDoc.id) || []));
      }

      batches.push({
        documents: currentBatch,
        chunks: batchChunks,
        batchIndex: batches.length
      });
    }

    return batches;
  }

  /**
   * Merge duplicate borrowers by SSN or full name
   */
  private mergeDuplicateBorrowers(borrowers: BorrowerRecord[]): BorrowerRecord[] {
    const borrowerMap = new Map<string, BorrowerRecord>();

    for (const borrower of borrowers) {
      // Use SSN as primary key, fall back to normalized full name
      const key = borrower.ssn?.value || borrower.fullName.value.toLowerCase().trim();

      if (borrowerMap.has(key)) {
        // Merge with existing borrower
        const existing = borrowerMap.get(key)!;
        borrowerMap.set(key, this.mergeBorrowerRecords(existing, borrower));
      } else {
        borrowerMap.set(key, borrower);
      }
    }

    return Array.from(borrowerMap.values());
  }

  /**
   * Merge two borrower records, keeping higher confidence values
   */
  private mergeBorrowerRecords(a: BorrowerRecord, b: BorrowerRecord): BorrowerRecord {
    const mergeField = <T extends { confidence: number }>(
      fieldA: T | undefined,
      fieldB: T | undefined
    ): T | undefined => {
      if (!fieldA) return fieldB;
      if (!fieldB) return fieldA;
      return fieldA.confidence >= fieldB.confidence ? fieldA : fieldB;
    };

    return {
      ...a,
      // Keep field with higher confidence
      fullName: a.fullName.confidence >= b.fullName.confidence ? a.fullName : b.fullName,
      firstName: mergeField(a.firstName, b.firstName),
      middleName: mergeField(a.middleName, b.middleName),
      lastName: mergeField(a.lastName, b.lastName),
      ssn: mergeField(a.ssn, b.ssn),
      dateOfBirth: mergeField(a.dateOfBirth, b.dateOfBirth),
      phoneNumber: mergeField(a.phoneNumber, b.phoneNumber),
      alternatePhoneNumber: mergeField(a.alternatePhoneNumber, b.alternatePhoneNumber),
      email: mergeField(a.email, b.email),
      currentAddress: b.currentAddress || a.currentAddress,

      // Combine arrays (deduplicate by value)
      previousAddresses: [...(a.previousAddresses || []), ...(b.previousAddresses || [])],
      accountNumbers: this.mergeArrayFields(a.accountNumbers, b.accountNumbers),
      loanNumbers: this.mergeArrayFields(a.loanNumbers, b.loanNumbers),

      // Combine document IDs (no duplicates)
      documentIds: [...new Set([...a.documentIds, ...b.documentIds])],

      // Keep most recent timestamps
      updatedAt: new Date()
    };
  }

  /**
   * Merge array fields, deduplicating by value
   */
  private mergeArrayFields<T extends { value: string | number }>(
    arrA: T[] | undefined,
    arrB: T[] | undefined
  ): T[] | undefined {
    if (!arrA && !arrB) return undefined;
    if (!arrA) return arrB;
    if (!arrB) return arrA;

    const seen = new Set<string | number>();
    const result: T[] = [];

    for (const item of [...arrA, ...arrB]) {
      if (!seen.has(item.value)) {
        seen.add(item.value);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Extract borrowers from all documents in batches
   * Processes documents in smaller batches to avoid rate limits
   */
  async extractBorrowersInBatches(
    context: ExtractionContext,
    config: BatchConfig = DEFAULT_BATCH_CONFIG
  ): Promise<ExtractionServiceResult> {
    const startTime = Date.now();

    try {
      Logger.info('Starting batched borrower extraction', {
        operation: 'extraction',
        documentCount: context.documents.length,
        chunkCount: context.chunks.length,
        batchConfig: config
      });

      // Create batches
      const batches = this.createDocumentBatches(context, config);

      Logger.info('Created document batches', {
        operation: 'extraction',
        batchCount: batches.length,
        avgDocsPerBatch: Math.round(
          (context.documents.length / batches.length) * 10
        ) / 10
      });

      // Process each batch
      const allBorrowers: BorrowerRecord[] = [];
      let retryAttempted = false;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        Logger.info(`Processing batch ${i + 1} of ${batches.length}`, {
          operation: 'extraction',
          batchIndex: i,
          documentCount: batch.documents.length,
          chunkCount: batch.chunks.length
        });

        // Add delay between batches (except for first batch)
        if (i > 0) {
          await this.delay(2000); // 2 second delay
        }

        // Build prompt for this batch
        const prompt = this.buildExtractionPrompt({
          documents: batch.documents,
          chunks: batch.chunks
        });

        // Extract from this batch with retry logic
        let response: string;
        try {
          response = await this.callOpenAIWithRetry(prompt);
        } catch (error) {
          Logger.error(`Batch ${i + 1} extraction failed`, error as Error, {
            operation: 'extraction',
            batchIndex: i
          });
          continue; // Skip this batch, continue with others
        }

        const parseResult = this.parseAndValidateResponse(response);

        if (parseResult.success) {
          const batchBorrowers = parseResult.borrowers.map((b) =>
            this.convertToBorrowerRecord(b)
          );
          allBorrowers.push(...batchBorrowers);

          Logger.info(`Batch ${i + 1} completed successfully`, {
            operation: 'extraction',
            batchIndex: i,
            borrowersExtracted: batchBorrowers.length
          });
        } else {
          // Retry once for this batch
          Logger.warn(`Batch ${i + 1} validation failed, retrying`, {
            operation: 'extraction',
            batchIndex: i,
            error: parseResult.error
          });

          retryAttempted = true;

          const retryPrompt = this.buildRetryPrompt(
            { documents: batch.documents, chunks: batch.chunks },
            parseResult.error || 'Validation failed'
          );

          try {
            response = await this.callOpenAIWithRetry(retryPrompt);
            const retryParseResult = this.parseAndValidateResponse(response);

            if (retryParseResult.success) {
              const batchBorrowers = retryParseResult.borrowers.map((b) =>
                this.convertToBorrowerRecord(b)
              );
              allBorrowers.push(...batchBorrowers);

              Logger.info(`Batch ${i + 1} retry succeeded`, {
                operation: 'extraction',
                batchIndex: i,
                borrowersExtracted: batchBorrowers.length
              });
            } else {
              Logger.error(`Batch ${i + 1} retry also failed`, new Error(retryParseResult.error), {
                operation: 'extraction',
                batchIndex: i
              });
            }
          } catch (retryError) {
            Logger.error(`Batch ${i + 1} retry threw error`, retryError as Error, {
              operation: 'extraction',
              batchIndex: i
            });
          }
        }
      }

      // Merge duplicate borrowers across batches
      const beforeMergeCount = allBorrowers.length;
      const mergedBorrowers = this.mergeDuplicateBorrowers(allBorrowers);
      const duplicatesFound = beforeMergeCount - mergedBorrowers.length;

      const duration = Date.now() - startTime;

      Logger.info('Batched extraction complete', {
        operation: 'extraction',
        totalBatches: batches.length,
        borrowersBeforeMerge: beforeMergeCount,
        borrowersAfterMerge: mergedBorrowers.length,
        duplicatesFound,
        duration
      });

      return {
        success: mergedBorrowers.length > 0,
        borrowers: mergedBorrowers,
        retryAttempted
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      Logger.error('Batched extraction service error', error as Error, {
        operation: 'extraction',
        duration
      });

      return {
        success: false,
        borrowers: [],
        error: `Batched extraction service error: ${errorMessage}`
      };
    }
  }
}
