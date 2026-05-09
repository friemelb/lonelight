/**
 * ExtractionService tests with mocked OpenAI responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtractionService } from './ExtractionService';
import type { DocumentRecord, DocumentChunk } from '@loanlens/domain';
import { ProcessingStatus } from '@loanlens/domain';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('ExtractionService', () => {
  let service: ExtractionService;

  const testDocId = '550e8400-e29b-41d4-a716-446655440000';
  const testChunkId = '660e8400-e29b-41d4-a716-446655440001';

  const testDocuments: DocumentRecord[] = [
    {
      id: testDocId,
      filename: 'test-loan.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      storagePath: 'corpus/test-loan.pdf',
      status: ProcessingStatus.EXTRACTED,
      uploadedAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const testChunks: DocumentChunk[] = [
    {
      id: testChunkId,
      documentId: testDocId,
      pageNumber: 1,
      chunkIndex: 0,
      content: 'Borrower: John Doe\nSSN: 123-45-6789\nAddress: 123 Main St, Springfield, IL 62701',
      extractedAt: new Date()
    }
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    service = new ExtractionService('test-api-key', 'gpt-4o-2024-11-20');
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new ExtractionService('')).toThrow('OpenAI API key is required');
    });

    it('should initialize with valid API key', () => {
      const svc = new ExtractionService('valid-key');
      expect(svc).toBeDefined();
    });
  });

  describe('extractBorrowersFromAllDocuments', () => {
    it('should successfully extract borrower from documents', async () => {
      // Mock successful OpenAI response
      const mockResponse = {
        borrowers: [
          {
            fullName: {
              value: 'John Doe',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'Borrower: John Doe'
            },
            ssn: {
              value: '123-45-6789',
              confidence: 0.9,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'SSN: 123-45-6789'
            },
            documentIds: [testDocId]
          }
        ]
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse)
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(true);
      expect(result.borrowers).toHaveLength(1);
      expect(result.borrowers[0].fullName.value).toBe('John Doe');
      expect(result.borrowers[0].ssn?.value).toBe('123-45-6789');
    });

    it('should handle OpenAI API errors', async () => {
      mockCreate.mockRejectedValue(
        new Error('OpenAI API error: Rate limit exceeded')
      );

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Extraction service error');
    });

    it('should handle invalid JSON response', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is not valid JSON'
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parsing failed');
    });

    it('should retry once on validation failure', async () => {
      // First call returns invalid data
      mockCreate
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  borrowers: [
                    {
                      fullName: {
                        value: 'John Doe',
                        confidence: 2.5, // Invalid: confidence > 1
                        sourceDocumentId: testDocId,
                        sourcePage: 1,
                        evidenceQuote: 'Borrower: John Doe'
                      }
                    }
                  ]
                })
              }
            }
          ]
        })
        // Second call returns valid data
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  borrowers: [
                    {
                      fullName: {
                        value: 'John Doe',
                        confidence: 0.95,
                        sourceDocumentId: testDocId,
                        sourcePage: 1,
                        evidenceQuote: 'Borrower: John Doe'
                      },
                      documentIds: [testDocId]
                    }
                  ]
                })
              }
            }
          ]
        });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.retryAttempted).toBe(true);
    });

    it('should fail after retry if validation still fails', async () => {
      // Both calls return invalid data
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                borrowers: [
                  {
                    fullName: {
                      value: 'John Doe',
                      confidence: 2.5, // Invalid
                      sourceDocumentId: testDocId,
                      sourcePage: 1,
                      evidenceQuote: 'Borrower: John Doe'
                    }
                  }
                ]
              })
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(false);
      expect(result.retryAttempted).toBe(true);
      expect(result.validationErrors).toBeDefined();
    });

    it('should extract multiple borrowers', async () => {
      const mockResponse = {
        borrowers: [
          {
            fullName: {
              value: 'John Doe',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'Borrower: John Doe'
            },
            documentIds: [testDocId]
          },
          {
            fullName: {
              value: 'Jane Smith',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 2,
              evidenceQuote: 'Co-Borrower: Jane Smith'
            },
            documentIds: [testDocId]
          }
        ]
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse)
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(true);
      expect(result.borrowers).toHaveLength(2);
      expect(result.borrowers[0].fullName.value).toBe('John Doe');
      expect(result.borrowers[1].fullName.value).toBe('Jane Smith');
    });

    it('should handle markdown code blocks in response', async () => {
      const mockResponse = {
        borrowers: [
          {
            fullName: {
              value: 'John Doe',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'Borrower: John Doe'
            },
            documentIds: [testDocId]
          }
        ]
      };

      // Response wrapped in markdown code blocks
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '```json\n' + JSON.stringify(mockResponse) + '\n```'
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(true);
      expect(result.borrowers).toHaveLength(1);
    });

    it('should handle empty OpenAI response', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI returned empty response');
    });

    it('should extract complex borrower with all fields', async () => {
      const mockResponse = {
        borrowers: [
          {
            fullName: {
              value: 'John Doe',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'Borrower: John Doe'
            },
            firstName: {
              value: 'John',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'First Name: John'
            },
            lastName: {
              value: 'Doe',
              confidence: 0.95,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'Last Name: Doe'
            },
            ssn: {
              value: '123-45-6789',
              confidence: 0.9,
              sourceDocumentId: testDocId,
              sourcePage: 1,
              evidenceQuote: 'SSN: 123-45-6789'
            },
            currentAddress: {
              street: {
                value: '123 Main St',
                confidence: 0.9,
                sourceDocumentId: testDocId,
                sourcePage: 1,
                evidenceQuote: 'Address: 123 Main St'
              },
              city: {
                value: 'Springfield',
                confidence: 0.9,
                sourceDocumentId: testDocId,
                sourcePage: 1,
                evidenceQuote: 'City: Springfield'
              },
              state: {
                value: 'IL',
                confidence: 0.9,
                sourceDocumentId: testDocId,
                sourcePage: 1,
                evidenceQuote: 'State: IL'
              },
              zipCode: {
                value: '62701',
                confidence: 0.9,
                sourceDocumentId: testDocId,
                sourcePage: 1,
                evidenceQuote: 'ZIP: 62701'
              }
            },
            accountNumbers: [
              {
                value: '1234567890',
                confidence: 0.85,
                sourceDocumentId: testDocId,
                sourcePage: 2,
                evidenceQuote: 'Account #: 1234567890'
              }
            ],
            documentIds: [testDocId]
          }
        ]
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse)
            }
          }
        ]
      });

      const result = await service.extractBorrowersFromAllDocuments({
        documents: testDocuments,
        chunks: testChunks
      });

      expect(result.success).toBe(true);
      expect(result.borrowers[0].fullName.value).toBe('John Doe');
      expect(result.borrowers[0].currentAddress?.city.value).toBe('Springfield');
      expect(result.borrowers[0].accountNumbers).toHaveLength(1);
    });
  });
});
