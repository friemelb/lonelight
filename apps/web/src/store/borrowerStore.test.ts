import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReviewStatus } from '@loanlens/domain';
import { useBorrowerStore, DEFAULT_FILTERS } from './borrowerStore';

const sampleBorrower = {
  id: 'borrower-1',
  fullName: {
    value: 'Alice Anderson',
    confidence: 0.95,
    sourceDocumentId: 'doc-1',
    sourcePage: 1,
    evidenceQuote: 'Borrower: Alice Anderson',
    extractedAt: '2024-01-01T00:00:00Z'
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  documentIds: [],
  reviewStatus: ReviewStatus.APPROVED
};

const samplePayload = {
  data: [sampleBorrower],
  pagination: { total: 1, limit: 50, offset: 0, hasMore: false }
};

function mockFetchOnce(payload: unknown, ok = true, statusText = 'OK') {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok,
    statusText,
    json: () => Promise.resolve(payload)
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('borrowerStore — search & filters', () => {
  beforeEach(() => {
    // Reset store to a clean state between tests.
    useBorrowerStore.setState({
      borrowers: [],
      selectedBorrower: null,
      pagination: null,
      searchQuery: '',
      filters: { ...DEFAULT_FILTERS },
      isLoading: false,
      error: null
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('fetchFiltered', () => {
    it('hits /api/search with only limit and offset by default', async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      await useBorrowerStore.getState().fetchFiltered();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url.startsWith('/api/search?')).toBe(true);
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('limit')).toBe('50');
      expect(params.get('offset')).toBe('0');
      expect(params.get('q')).toBeNull();
      expect(params.get('confidence')).toBeNull();
      expect(params.get('reviewStatus')).toBeNull();
      expect(params.get('sourceDocument')).toBeNull();
    });

    it('populates borrowers and pagination from the response', async () => {
      mockFetchOnce(samplePayload);

      await useBorrowerStore.getState().fetchFiltered();

      const state = useBorrowerStore.getState();
      expect(state.borrowers).toHaveLength(1);
      expect(state.borrowers[0].id).toBe('borrower-1');
      // ISO strings should be hydrated to Date instances
      expect(state.borrowers[0].createdAt).toBeInstanceOf(Date);
      expect(state.borrowers[0].updatedAt).toBeInstanceOf(Date);
      expect(state.pagination).toEqual(samplePayload.pagination);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error state on a failed response', async () => {
      mockFetchOnce({}, false, 'Internal Server Error');

      await useBorrowerStore.getState().fetchFiltered();

      const state = useBorrowerStore.getState();
      expect(state.error).toContain('Internal Server Error');
      expect(state.isLoading).toBe(false);
      expect(state.borrowers).toEqual([]);
    });
  });

  describe('setFilters', () => {
    it('merges partial updates and triggers a fetch with the new params', async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore.getState().setFilters({
        q: 'Alice',
        minConfidence: 0.8,
        reviewStatus: ReviewStatus.APPROVED,
        sourceDocumentId: 'doc-42'
      });

      // Wait a tick for the async fetch to resolve
      await Promise.resolve();
      await Promise.resolve();

      const state = useBorrowerStore.getState();
      expect(state.filters.q).toBe('Alice');
      expect(state.filters.minConfidence).toBe(0.8);
      expect(state.filters.reviewStatus).toBe(ReviewStatus.APPROVED);
      expect(state.filters.sourceDocumentId).toBe('doc-42');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('q')).toBe('Alice');
      expect(params.get('confidence')).toBe('0.8');
      expect(params.get('reviewStatus')).toBe(ReviewStatus.APPROVED);
      expect(params.get('sourceDocument')).toBe('doc-42');
    });

    it('skips defaults when building the query string', async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore.getState().setFilters({ q: 'Alice' });

      await Promise.resolve();
      await Promise.resolve();

      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('q')).toBe('Alice');
      expect(params.get('in')).toBeNull();
      expect(params.get('confidence')).toBeNull();
      expect(params.get('reviewStatus')).toBeNull();
      expect(params.get('sourceDocument')).toBeNull();
    });
  });

  describe('searchIn tokens', () => {
    it("does not send 'in' when searchIn is empty (all-values default)", async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore.getState().setFilters({ q: 'Alice', searchIn: [] });
      await Promise.resolve();
      await Promise.resolve();

      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('in')).toBeNull();
    });

    it("sends 'in=fullName' when narrowed to a single field", async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore.getState().setFilters({ q: 'Alice', searchIn: ['fullName'] });
      await Promise.resolve();
      await Promise.resolve();

      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('in')).toBe('fullName');
    });

    it("joins multiple tokens with commas", async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore
        .getState()
        .setFilters({ q: 'Alice', searchIn: ['firstName', 'lastName', 'evidenceQuote'] });
      await Promise.resolve();
      await Promise.resolve();

      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('in')).toBe('firstName,lastName,evidenceQuote');
    });

    it("does not send 'in' when q is empty (no point matching nothing)", async () => {
      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore.getState().setFilters({ searchIn: ['fullName'] });
      await Promise.resolve();
      await Promise.resolve();

      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('q')).toBeNull();
      expect(params.get('in')).toBeNull();
    });
  });

  describe('resetFilters', () => {
    it('restores defaults and refetches', async () => {
      // Pre-populate dirty filters
      useBorrowerStore.setState({
        filters: {
          q: 'foo',
          searchIn: ['fullName', 'evidenceQuote'],
          minConfidence: 0.5,
          reviewStatus: ReviewStatus.REJECTED,
          sourceDocumentId: 'doc-x'
        }
      });

      const fetchMock = mockFetchOnce(samplePayload);

      useBorrowerStore.getState().resetFilters();
      await Promise.resolve();
      await Promise.resolve();

      const state = useBorrowerStore.getState();
      expect(state.filters).toEqual(DEFAULT_FILTERS);

      const url = fetchMock.mock.calls[0][0] as string;
      const params = new URL(`http://x${url}`).searchParams;
      expect(params.get('q')).toBeNull();
      expect(params.get('confidence')).toBeNull();
      expect(params.get('reviewStatus')).toBeNull();
      expect(params.get('sourceDocument')).toBeNull();
    });
  });
});
