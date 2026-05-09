import { create } from 'zustand';
import type { BorrowerRecord } from '@loanlens/domain';

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ExtractionRunResult {
  success: boolean;
  borrowersExtracted: number;
  totalDocuments: number;
  totalChunks: number;
  durationMs: number;
  errors: Array<{ message: string; type: string }>;
}

interface BorrowerStore {
  // State
  borrowers: BorrowerRecord[];
  selectedBorrower: BorrowerRecord | null;
  pagination: PaginationInfo | null;
  searchQuery: string;
  isLoading: boolean;
  isExtracting: boolean;
  error: string | null;

  // Actions
  fetchBorrowers: (searchQuery?: string, limit?: number, offset?: number) => Promise<void>;
  fetchBorrowerById: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  clearError: () => void;
  extractBorrowers: () => Promise<ExtractionRunResult>;
}

export const useBorrowerStore = create<BorrowerStore>((set, get) => ({
  // Initial state
  borrowers: [],
  selectedBorrower: null,
  pagination: null,
  searchQuery: '',
  isLoading: false,
  isExtracting: false,
  error: null,

  // Fetch borrowers with optional search and pagination
  fetchBorrowers: async (searchQuery = '', limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });

    try {
      // Build query parameters
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

      // Convert ISO date strings to Date objects in borrowers and ExtractedFields
      const borrowers = data.data.map((borrower: any) => ({
        ...borrower,
        createdAt: new Date(borrower.createdAt),
        updatedAt: new Date(borrower.updatedAt),
        // Convert extractedAt dates in ExtractedFields
        fullName: borrower.fullName ? {
          ...borrower.fullName,
          extractedAt: borrower.fullName.extractedAt
            ? new Date(borrower.fullName.extractedAt)
            : undefined
        } : borrower.fullName,
        firstName: borrower.firstName ? {
          ...borrower.firstName,
          extractedAt: borrower.firstName.extractedAt
            ? new Date(borrower.firstName.extractedAt)
            : undefined
        } : undefined,
        lastName: borrower.lastName ? {
          ...borrower.lastName,
          extractedAt: borrower.lastName.extractedAt
            ? new Date(borrower.lastName.extractedAt)
            : undefined
        } : undefined,
        email: borrower.email ? {
          ...borrower.email,
          extractedAt: borrower.email.extractedAt
            ? new Date(borrower.email.extractedAt)
            : undefined
        } : undefined,
        phoneNumber: borrower.phoneNumber ? {
          ...borrower.phoneNumber,
          extractedAt: borrower.phoneNumber.extractedAt
            ? new Date(borrower.phoneNumber.extractedAt)
            : undefined
        } : undefined
      }));

      set({
        borrowers,
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

  // Fetch a single borrower by ID
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

      // Convert ISO date strings to Date objects
      const convertedBorrower = {
        ...borrower,
        createdAt: new Date(borrower.createdAt),
        updatedAt: new Date(borrower.updatedAt),
        // Convert extractedAt in all ExtractedFields
        fullName: borrower.fullName ? {
          ...borrower.fullName,
          extractedAt: borrower.fullName.extractedAt
            ? new Date(borrower.fullName.extractedAt)
            : undefined
        } : borrower.fullName,
        firstName: borrower.firstName ? {
          ...borrower.firstName,
          extractedAt: borrower.firstName.extractedAt
            ? new Date(borrower.firstName.extractedAt)
            : undefined
        } : undefined,
        lastName: borrower.lastName ? {
          ...borrower.lastName,
          extractedAt: borrower.lastName.extractedAt
            ? new Date(borrower.lastName.extractedAt)
            : undefined
        } : undefined,
        ssn: borrower.ssn ? {
          ...borrower.ssn,
          extractedAt: borrower.ssn.extractedAt
            ? new Date(borrower.ssn.extractedAt)
            : undefined
        } : undefined,
        dateOfBirth: borrower.dateOfBirth ? {
          ...borrower.dateOfBirth,
          extractedAt: borrower.dateOfBirth.extractedAt
            ? new Date(borrower.dateOfBirth.extractedAt)
            : undefined
        } : undefined,
        email: borrower.email ? {
          ...borrower.email,
          extractedAt: borrower.email.extractedAt
            ? new Date(borrower.email.extractedAt)
            : undefined
        } : undefined,
        phoneNumber: borrower.phoneNumber ? {
          ...borrower.phoneNumber,
          extractedAt: borrower.phoneNumber.extractedAt
            ? new Date(borrower.phoneNumber.extractedAt)
            : undefined
        } : undefined,
        alternatePhoneNumber: borrower.alternatePhoneNumber ? {
          ...borrower.alternatePhoneNumber,
          extractedAt: borrower.alternatePhoneNumber.extractedAt
            ? new Date(borrower.alternatePhoneNumber.extractedAt)
            : undefined
        } : undefined
      };

      set({
        selectedBorrower: convertedBorrower,
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

  // Set search query (caller should debounce this)
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  // Clear search and refetch all
  clearSearch: () => {
    set({ searchQuery: '' });
    get().fetchBorrowers('', 50, 0);
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  },

  // Run LLM extraction across all ingested documents
  extractBorrowers: async () => {
    set({ isExtracting: true, error: null });

    try {
      const response = await fetch('/api/borrowers/extract', { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.error?.message ||
          data?.errors?.[0]?.message ||
          `Extraction failed: ${response.statusText}`;
        throw new Error(message);
      }

      const stats = data?.data?.stats ?? {
        totalDocuments: 0,
        totalChunks: 0,
        borrowersExtracted: 0,
        durationMs: 0
      };

      // Refresh borrower list so the table reflects newly-extracted borrowers
      await get().fetchBorrowers(get().searchQuery, get().pagination?.limit ?? 50, 0);

      set({ isExtracting: false });

      return {
        success: data?.success ?? true,
        borrowersExtracted: stats.borrowersExtracted ?? 0,
        totalDocuments: stats.totalDocuments ?? 0,
        totalChunks: stats.totalChunks ?? 0,
        durationMs: stats.durationMs ?? 0,
        errors: Array.isArray(data?.errors) ? data.errors : []
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Extraction failed';
      set({ error: message, isExtracting: false });
      throw error;
    }
  }
}));
