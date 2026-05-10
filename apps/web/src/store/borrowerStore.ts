import { create } from 'zustand';
import type { BorrowerRecord } from '@loanlens/domain';
import { ReviewStatus } from '@loanlens/domain';

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Tokens accepted by the backend's `?in=` query param. Each names a field on
// BorrowerRecord (matching the `field_name` strings written by
// BorrowerRepository), plus `evidenceQuote` for searching the quote column.
export type SearchToken =
  | 'fullName'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'ssn'
  | 'dateOfBirth'
  | 'phoneNumber'
  | 'alternatePhoneNumber'
  | 'email'
  | 'currentAddress'
  | 'previousAddresses'
  | 'accountNumbers'
  | 'loanNumbers'
  | 'incomeHistory'
  | 'evidenceQuote';

export interface BorrowerFilters {
  q: string;
  // Empty array = match all field values (the original "any value" default).
  // Specific tokens narrow the LIKE to those field_names; `evidenceQuote`
  // additionally searches the `evidence_quote` column.
  searchIn: SearchToken[];
  minConfidence: number;                       // 0-1, default 0 (no filter)
  reviewStatus: ReviewStatus | 'ALL';          // default 'ALL'
  sourceDocumentId: string | 'ALL';            // default 'ALL'
}

export const DEFAULT_FILTERS: BorrowerFilters = {
  q: '',
  searchIn: [],
  minConfidence: 0,
  reviewStatus: 'ALL',
  sourceDocumentId: 'ALL'
};

interface BorrowerStore {
  borrowers: BorrowerRecord[];
  selectedBorrower: BorrowerRecord | null;
  pagination: PaginationInfo | null;
  searchQuery: string;
  filters: BorrowerFilters;
  isLoading: boolean;
  error: string | null;

  fetchBorrowers: (searchQuery?: string, limit?: number, offset?: number) => Promise<void>;
  fetchBorrowerById: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  setFilters: (partial: Partial<BorrowerFilters>) => void;
  fetchFiltered: (limit?: number, offset?: number) => Promise<void>;
  resetFilters: () => void;
  clearError: () => void;
}

// Convert ISO date strings to Date objects on a borrower payload from the API.
function hydrateBorrower(borrower: any): BorrowerRecord {
  const hydrateField = (field: any) =>
    field
      ? {
          ...field,
          extractedAt: field.extractedAt ? new Date(field.extractedAt) : undefined
        }
      : field;

  return {
    ...borrower,
    createdAt: new Date(borrower.createdAt),
    updatedAt: new Date(borrower.updatedAt),
    fullName: hydrateField(borrower.fullName),
    firstName: hydrateField(borrower.firstName),
    middleName: hydrateField(borrower.middleName),
    lastName: hydrateField(borrower.lastName),
    ssn: hydrateField(borrower.ssn),
    dateOfBirth: hydrateField(borrower.dateOfBirth),
    email: hydrateField(borrower.email),
    phoneNumber: hydrateField(borrower.phoneNumber),
    alternatePhoneNumber: hydrateField(borrower.alternatePhoneNumber)
  };
}

export const useBorrowerStore = create<BorrowerStore>((set, get) => ({
  borrowers: [],
  selectedBorrower: null,
  pagination: null,
  searchQuery: '',
  filters: { ...DEFAULT_FILTERS },
  isLoading: false,
  error: null,

  fetchBorrowers: async (searchQuery = '', limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/borrowers?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch borrowers: ${response.statusText}`);
      }

      const data = await response.json();

      set({
        borrowers: data.data.map(hydrateBorrower),
        pagination: data.pagination,
        searchQuery,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoading: false
      });
    }
  },

  fetchBorrowerById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/borrowers/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Borrower not found');
        }
        throw new Error(`Failed to fetch borrower: ${response.statusText}`);
      }

      const borrower = await response.json();

      set({
        selectedBorrower: hydrateBorrower(borrower),
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoading: false,
        selectedBorrower: null
      });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearSearch: () => {
    set({ searchQuery: '' });
    get().fetchBorrowers('', 50, 0);
  },

  // Merge in partial filter updates and refetch immediately.
  setFilters: (partial) => {
    const filters = { ...get().filters, ...partial };
    set({ filters });
    const limit = get().pagination?.limit || 50;
    get().fetchFiltered(limit, 0);
  },

  // Hits /api/search with the current filter state.
  fetchFiltered: async (limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      if (filters.q.trim()) {
        params.append('q', filters.q.trim());
        // Empty searchIn = "all field values" default — no point sending it.
        if (filters.searchIn.length > 0) {
          params.append('in', filters.searchIn.join(','));
        }
      }
      if (filters.minConfidence > 0) {
        params.append('confidence', filters.minConfidence.toString());
      }
      if (filters.reviewStatus !== 'ALL') {
        params.append('reviewStatus', filters.reviewStatus);
      }
      if (filters.sourceDocumentId !== 'ALL') {
        params.append('sourceDocument', filters.sourceDocumentId);
      }

      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to search borrowers: ${response.statusText}`);
      }

      const data = await response.json();

      set({
        borrowers: data.data.map(hydrateBorrower),
        pagination: data.pagination,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoading: false
      });
    }
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
    get().fetchFiltered(50, 0);
  },

  clearError: () => {
    set({ error: null });
  }
}));
