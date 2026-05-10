import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import type Database from 'better-sqlite3';
import { getTestDatabase } from '@/database';
import { BorrowerRepository, DocumentRepository } from '@/repositories';
import type { ExtractedField } from '@loanlens/domain';
import { ProcessingStatus, ReviewStatus } from '@loanlens/domain';

// Mock OpenAI defensively in case any import path triggers it.
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ borrowers: [] }) } }]
          })
        }
      }
    }))
  };
});

vi.mock('@/database', async () => {
  const actual = await vi.importActual('@/database');
  return { ...actual, getDatabase: vi.fn() };
});

describe('Search Routes', () => {
  let app: Express;
  let db: Database.Database;
  let borrowerRepository: BorrowerRepository;
  let documentRepository: DocumentRepository;

  const createField = (
    value: string,
    confidence: number = 0.95,
    sourceDocumentId: string = 'doc-1',
    evidenceQuote?: string
  ): ExtractedField<string> => ({
    value,
    confidence,
    sourceDocumentId,
    sourcePage: 1,
    evidenceQuote: evidenceQuote ?? `Evidence for ${value}`,
    extractedAt: new Date()
  });

  // Helper for seeding nested rows that BorrowerRepository.create doesn't yet write
  // (accountNumbers / loanNumbers / address components live in borrower_fields too).
  const insertExtraField = (
    borrowerId: string,
    fieldName: string,
    fieldValue: string,
    sourceDocumentId: string = 'doc-1',
    confidence: number = 0.9,
    evidenceQuote: string = `Evidence for ${fieldValue}`
  ) => {
    db.prepare(
      `INSERT INTO borrower_fields (
         borrower_id, field_name, field_type, field_value,
         confidence, source_document_id, source_page, evidence_quote,
         bounding_box, extracted_at, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      borrowerId,
      fieldName,
      'string',
      fieldValue,
      confidence,
      sourceDocumentId,
      1,
      evidenceQuote,
      null,
      new Date().toISOString(),
      null
    );
  };

  beforeEach(async () => {
    db = getTestDatabase();
    borrowerRepository = new BorrowerRepository(db);
    documentRepository = new DocumentRepository(db);

    const { getDatabase } = await import('@/database');
    vi.mocked(getDatabase).mockReturnValue(db);

    const { searchRouter } = await import('./search');

    app = express();
    app.use(express.json());
    app.use('/api/search', searchRouter);

    // Two source documents
    await documentRepository.create({
      id: 'doc-1',
      filename: 'loan-app.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      storagePath: '/loan-app.pdf',
      status: ProcessingStatus.COMPLETED,
      uploadedAt: new Date(),
      updatedAt: new Date()
    });

    await documentRepository.create({
      id: 'doc-2',
      filename: 'paystub.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      storagePath: '/paystub.pdf',
      status: ProcessingStatus.COMPLETED,
      uploadedAt: new Date(),
      updatedAt: new Date()
    });

    // Three borrowers with varied attributes
    await borrowerRepository.create({
      id: 'borrower-alice',
      fullName: createField('Alice Anderson', 0.95, 'doc-1', 'Borrower: Alice Anderson'),
      email: createField('alice@example.com', 0.9, 'doc-1'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-03'),
      documentIds: [],
      reviewStatus: ReviewStatus.APPROVED
    });
    insertExtraField(
      'borrower-alice',
      'accountNumbers',
      '1111222233',
      'doc-1',
      0.85,
      'Account #: 1111222233'
    );

    await borrowerRepository.create({
      id: 'borrower-bob',
      fullName: createField('Bob Baker', 0.6, 'doc-2', 'Co-borrower Bob Baker on file'),
      email: createField('bob@example.com', 0.8, 'doc-2'),
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      documentIds: [],
      reviewStatus: ReviewStatus.PENDING_REVIEW
    });
    insertExtraField(
      'borrower-bob',
      'loanNumbers',
      'LN-987654',
      'doc-2',
      0.88,
      'Loan number LN-987654 referenced'
    );

    await borrowerRepository.create({
      id: 'borrower-carol',
      fullName: createField('Carol Carter', 0.99, 'doc-1', 'Primary borrower Carol Carter'),
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-01'),
      documentIds: [],
      reviewStatus: ReviewStatus.REJECTED
    });
    insertExtraField(
      'borrower-carol',
      'currentAddress.city',
      'Springfield',
      'doc-1',
      0.92,
      'City: Springfield, IL'
    );
  });

  afterEach(() => {
    db.close();
  });

  describe('search by query (?q=)', () => {
    it('matches by fullName', async () => {
      const response = await request(app).get('/api/search').query({ q: 'Alice' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-alice');
    });

    it('matches by email', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'bob@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-bob');
    });

    it('does NOT match evidence_quote by default (all-values default)', async () => {
      // "Co-borrower" only appears in Bob's evidenceQuote, never in any field_value.
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'Co-borrower' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('matches evidence_quote when in=evidenceQuote is requested', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'Co-borrower', in: 'evidenceQuote' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-bob');
    });

    it('narrows to a single field name (in=fullName)', async () => {
      // "alice@example.com" lives in `email`, not `fullName` — so an
      // in=fullName scope must NOT find Alice.
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'alice@example.com', in: 'fullName' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('narrows to a single field name and matches when value lives there', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'Alice', in: 'fullName' });

      expect(response.status).toBe(200);
      expect(response.body.data.map((b: any) => b.id)).toEqual(['borrower-alice']);
    });

    it('combines multiple field tokens (in=firstName,lastName)', async () => {
      // Seed an extra borrower whose lastName is "Smith"
      await borrowerRepository.create({
        id: 'borrower-smith',
        fullName: createField('Daniel Smith', 0.9, 'doc-1'),
        lastName: createField('Smith', 0.9, 'doc-1'),
        createdAt: new Date('2024-01-04'),
        updatedAt: new Date('2024-01-04'),
        documentIds: [],
        reviewStatus: ReviewStatus.PENDING_REVIEW
      });

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'Smith', in: 'firstName,lastName' });

      expect(response.status).toBe(200);
      expect(response.body.data.map((b: any) => b.id)).toEqual(['borrower-smith']);
    });

    it('combines field tokens with evidenceQuote', async () => {
      // "borrower" only appears in evidence quotes; "Alice" only in field_value.
      // Asking for in=fullName,evidenceQuote should match both classes.
      const aliceByValue = await request(app)
        .get('/api/search')
        .query({ q: 'Alice', in: 'fullName,evidenceQuote' });
      expect(aliceByValue.body.data.map((b: any) => b.id)).toEqual(['borrower-alice']);

      const allByQuote = await request(app)
        .get('/api/search')
        .query({ q: 'borrower', in: 'fullName,evidenceQuote' });
      expect(allByQuote.body.data.map((b: any) => b.id).sort()).toEqual(
        ['borrower-alice', 'borrower-bob', 'borrower-carol'].sort()
      );
    });

    it('matches accountNumbers when narrowed to in=accountNumbers', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: '1111', in: 'accountNumbers' });

      expect(response.status).toBe(200);
      expect(response.body.data.map((b: any) => b.id)).toEqual(['borrower-alice']);
    });

    it('matches by accountNumbers value', async () => {
      const response = await request(app).get('/api/search').query({ q: '1111222233' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-alice');
    });

    it('matches by loanNumbers value', async () => {
      const response = await request(app).get('/api/search').query({ q: 'LN-987654' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-bob');
    });

    it('matches by address city', async () => {
      const response = await request(app).get('/api/search').query({ q: 'Springfield' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-carol');
    });

    it('returns empty result for non-matching query', async () => {
      const response = await request(app).get('/api/search').query({ q: 'nonexistent-xyz' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('filters', () => {
    it('returns all borrowers when no filters provided', async () => {
      const response = await request(app).get('/api/search');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
    });

    it('filters by minimum confidence on fullName', async () => {
      const response = await request(app).get('/api/search').query({ confidence: '0.9' });

      expect(response.status).toBe(200);
      // Alice (0.95) and Carol (0.99) keep; Bob (0.6) drops.
      const ids = response.body.data.map((b: any) => b.id).sort();
      expect(ids).toEqual(['borrower-alice', 'borrower-carol']);
    });

    it('filters by reviewStatus', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ reviewStatus: ReviewStatus.APPROVED });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-alice');
    });

    it('filters by sourceDocument', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ sourceDocument: 'doc-2' });

      expect(response.status).toBe(200);
      // Only Bob has fields sourced from doc-2
      const ids = response.body.data.map((b: any) => b.id);
      expect(ids).toEqual(['borrower-bob']);
    });

    it('combines q and filters', async () => {
      // "borrower" appears in evidence quotes for all three borrowers, so
      // ask for the evidenceQuote token and narrow with reviewStatus=APPROVED.
      const response = await request(app).get('/api/search').query({
        q: 'borrower',
        in: 'evidenceQuote',
        reviewStatus: ReviewStatus.APPROVED
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('borrower-alice');
    });
  });

  describe('validation', () => {
    it('returns 400 on invalid reviewStatus', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ reviewStatus: 'not_a_real_status' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('reviewStatus');
    });

    it('returns 400 on out-of-range confidence', async () => {
      const response = await request(app).get('/api/search').query({ confidence: '2.5' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('confidence');
    });

    it('returns 400 on non-numeric confidence', async () => {
      const response = await request(app).get('/api/search').query({ confidence: 'abc' });

      expect(response.status).toBe(400);
    });

    it('returns 400 on unknown in token', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'Alice', in: 'fullName,bogus' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("'in'");
      expect(response.body.error.message).toContain('bogus');
    });
  });

  describe('pagination', () => {
    it('returns pagination metadata', async () => {
      const response = await request(app).get('/api/search').query({ limit: '2', offset: '0' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 3,
        limit: 2,
        offset: 0,
        hasMore: true
      });
    });

    it('honours offset', async () => {
      const response = await request(app).get('/api/search').query({ limit: '2', offset: '2' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.hasMore).toBe(false);
    });
  });
});
