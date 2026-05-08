import { create } from 'zustand';
import type { DocumentRecord, ProcessingStatus } from '@loanlens/domain';

interface DocumentFilters {
  status?: ProcessingStatus;
  borrowerId?: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface DocumentStore {
  // State
  documents: DocumentRecord[];
  selectedDocument: DocumentRecord | null;
  pagination: PaginationInfo | null;
  filters: DocumentFilters;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDocuments: (filters?: DocumentFilters, limit?: number, offset?: number) => Promise<void>;
  fetchDocumentById: (id: string) => Promise<void>;
  setFilters: (filters: DocumentFilters) => void;
  resetFilters: () => void;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  // Initial state
  documents: [],
  selectedDocument: null,
  pagination: null,
  filters: {},
  isLoading: false,
  error: null,

  // Fetch documents with optional filters and pagination
  fetchDocuments: async (filters = {}, limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.borrowerId) {
        params.append('borrowerId', filters.borrowerId);
      }

      const response = await fetch(`/api/documents?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert ISO date strings to Date objects
      const documents = data.data.map((doc: any) => ({
        ...doc,
        uploadedAt: new Date(doc.uploadedAt),
        updatedAt: new Date(doc.updatedAt)
      }));

      set({
        documents,
        pagination: data.pagination,
        filters,
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

  // Fetch a single document by ID
  fetchDocumentById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/documents/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Document not found');
        }
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const doc = await response.json();

      // Convert ISO date strings to Date objects
      const document = {
        ...doc,
        uploadedAt: new Date(doc.uploadedAt),
        updatedAt: new Date(doc.updatedAt)
      };

      set({
        selectedDocument: document,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoading: false,
        selectedDocument: null
      });
    }
  },

  // Set filters and refetch
  setFilters: (filters: DocumentFilters) => {
    set({ filters });
    // Automatically fetch with new filters
    get().fetchDocuments(filters, get().pagination?.limit || 50, 0);
  },

  // Reset filters to default
  resetFilters: () => {
    set({ filters: {} });
    get().fetchDocuments({}, 50, 0);
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  }
}));
