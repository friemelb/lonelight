import { create } from 'zustand';

interface HealthCheck {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
}

interface AppStore {
  apiHealth: HealthCheck | null;
  isLoading: boolean;
  error: string | null;
  fetchHealthCheck: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set) => ({
  apiHealth: null,
  isLoading: false,
  error: null,

  fetchHealthCheck: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error('Failed to fetch health check');
      }
      const data = await response.json();
      set({ apiHealth: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      });
    }
  },
}));
