import { create } from 'zustand';

interface MetricsSummary {
  totalDocuments: number;
  byStatus: {
    uploaded: number;
    processing: number;
    extracted: number;
    failed: number;
    completed: number;
  };
  totalChunks: number;
  avgProcessingTimeMs: number;
  successRate: number;
  recentErrorCount: number;
  recentMetrics: any[];
}

interface MetricsStore {
  metrics: MetricsSummary | null;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  metrics: null,
  isLoading: false,
  error: null,

  fetchMetrics: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/metrics/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      set({ metrics: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      });
    }
  },
}));
