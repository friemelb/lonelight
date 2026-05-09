import { create } from 'zustand';
import type { BorrowerRecord, FieldCorrection, ReviewAction } from '@loanlens/domain';

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ReviewStore {
  // State
  reviewQueue: BorrowerRecord[];
  pagination: PaginationInfo | null;
  auditHistory: ReviewAction[];
  corrections: FieldCorrection[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Actions
  fetchReviewQueue: (limit?: number, offset?: number) => Promise<void>;
  approveBorrower: (id: string, notes?: string) => Promise<void>;
  rejectBorrower: (id: string, notes?: string) => Promise<void>;
  correctField: (
    borrowerId: string,
    fieldName: string,
    correctedValue: string,
    correctionNote?: string
  ) => Promise<void>;
  fetchAuditHistory: (borrowerId: string) => Promise<void>;
  clearError: () => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  // Initial state
  reviewQueue: [],
  pagination: null,
  auditHistory: [],
  corrections: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  // Fetch borrowers in the review queue (pending_review status)
  fetchReviewQueue: async (limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/borrowers/review-queue?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch review queue: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert ISO date strings to Date objects
      const reviewQueue = data.data.map((borrower: any) => ({
        ...borrower,
        createdAt: new Date(borrower.createdAt),
        updatedAt: new Date(borrower.updatedAt),
        reviewedAt: borrower.reviewedAt ? new Date(borrower.reviewedAt) : undefined
      }));

      set({
        reviewQueue,
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

  // Approve a borrower
  approveBorrower: async (id: string, notes?: string) => {
    set({ isSubmitting: true, error: null });

    try {
      const response = await fetch(`/api/borrowers/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', notes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to approve borrower');
      }

      // Remove from review queue
      set((state) => ({
        reviewQueue: state.reviewQueue.filter((b) => b.id !== id),
        isSubmitting: false,
        error: null
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isSubmitting: false
      });
      throw error; // Re-throw so UI can handle it
    }
  },

  // Reject a borrower
  rejectBorrower: async (id: string, notes?: string) => {
    set({ isSubmitting: true, error: null });

    try {
      const response = await fetch(`/api/borrowers/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', notes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to reject borrower');
      }

      // Remove from review queue
      set((state) => ({
        reviewQueue: state.reviewQueue.filter((b) => b.id !== id),
        isSubmitting: false,
        error: null
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isSubmitting: false
      });
      throw error; // Re-throw so UI can handle it
    }
  },

  // Correct a specific field on a borrower
  correctField: async (
    borrowerId: string,
    fieldName: string,
    correctedValue: string,
    correctionNote?: string
  ) => {
    set({ isSubmitting: true, error: null });

    try {
      const response = await fetch(`/api/borrowers/${borrowerId}/field`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName, correctedValue, correctionNote })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to correct field');
      }

      set({ isSubmitting: false, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isSubmitting: false
      });
      throw error; // Re-throw so UI can handle it
    }
  },

  // Fetch audit history for a borrower
  fetchAuditHistory: async (borrowerId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/borrowers/${borrowerId}/audit-history`);

      if (!response.ok) {
        throw new Error(`Failed to fetch audit history: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert ISO date strings to Date objects
      const auditHistory = data.auditHistory.map((action: any) => ({
        ...action,
        actionAt: new Date(action.actionAt)
      }));

      const corrections = data.corrections.map((correction: any) => ({
        ...correction,
        correctedAt: new Date(correction.correctedAt)
      }));

      set({
        auditHistory,
        corrections,
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

  // Clear error message
  clearError: () => {
    set({ error: null });
  }
}));
