import { Router, Request, Response } from 'express';
import { getDatabase } from '@/database';
import { BorrowerRepository } from '@/repositories';
import { ReviewStatus } from '@loanlens/domain';

export const searchRouter = Router();

interface SearchQuery {
  q?: string;
  in?: string;
  confidence?: string;
  reviewStatus?: string;
  sourceDocument?: string;
  limit?: string;
  offset?: string;
}

const VALID_REVIEW_STATUSES = new Set<string>(Object.values(ReviewStatus));

// Tokens accepted by `?in=`: each names a field on BorrowerRecord (matching the
// `field_name` strings written by BorrowerRepository), plus the special
// `evidenceQuote` for searching the `evidence_quote` column.
const VALID_SEARCH_TOKENS = new Set<string>([
  'fullName',
  'firstName',
  'middleName',
  'lastName',
  'ssn',
  'dateOfBirth',
  'phoneNumber',
  'alternatePhoneNumber',
  'email',
  'currentAddress',
  'previousAddresses',
  'accountNumbers',
  'loanNumbers',
  'incomeHistory',
  'evidenceQuote'
]);

/**
 * GET /api/search
 * Search borrowers by name, address, account/loan numbers, or evidence quote.
 * Supports filters for confidence (min on fullName), review status, and source document.
 */
searchRouter.get(
  '/',
  async (req: Request<{}, {}, {}, SearchQuery>, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    let minConfidence: number | undefined;
    if (req.query.confidence !== undefined && req.query.confidence !== '') {
      const parsed = parseFloat(req.query.confidence);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
        return res.status(400).json({
          error: {
            message: 'confidence must be a number between 0 and 1',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      minConfidence = parsed;
    }

    let reviewStatus: ReviewStatus | undefined;
    if (req.query.reviewStatus) {
      if (!VALID_REVIEW_STATUSES.has(req.query.reviewStatus)) {
        return res.status(400).json({
          error: {
            message: `reviewStatus must be one of: ${[...VALID_REVIEW_STATUSES].join(', ')}`,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      reviewStatus = req.query.reviewStatus as ReviewStatus;
    }

    let searchIn: string[] | undefined;
    if (req.query.in !== undefined && req.query.in !== '') {
      const requested = req.query.in.split(',').map((s) => s.trim()).filter(Boolean);
      const invalid = requested.filter((s) => !VALID_SEARCH_TOKENS.has(s));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: {
            message: `'in' tokens must be a subset of: ${[...VALID_SEARCH_TOKENS].join(', ')} (got invalid: ${invalid.join(', ')})`,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      searchIn = requested;
    }

    const repository = new BorrowerRepository(getDatabase());

    const { borrowers, total } = await repository.searchAndFilter({
      q: req.query.q,
      searchIn,
      minConfidence,
      reviewStatus,
      sourceDocumentId: req.query.sourceDocument,
      limit,
      offset
    });

    return res.status(200).json({
      data: borrowers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + borrowers.length < total
      }
    });
  }
);
