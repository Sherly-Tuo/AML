import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultDemandBids } from '../data/vic1DemandBids';
import { defaultSupplyReports } from '../data/solarSupplyReports';
import type { DemandBid, MarketReport, OptimizationRun } from '../types';

interface NewMarketReport {
  reporterName: string;
  surplusKwh: number;
  pricePerKwh: number;
  reportedAt?: string;
}

interface NewOptimizationRun {
  surplusKwh: number;
  inputPrice: number;
  optimizedPrice: number;
  expectedRevenue: number;
}

interface NewDemandBid {
  buyerName: string;
  demandKwh: number;
  maxPricePerKwh: number;
  requestedAt?: string;
}

interface AppState {
  marketReports: MarketReport[];
  demandBids: DemandBid[];
  optimizationHistory: OptimizationRun[];
  addMarketReport: (report: NewMarketReport) => void;
  removeMarketReport: (id: string) => void;
  resetMarketReports: () => void;
  importDemandBids: (bids: NewDemandBid[], mode?: 'append' | 'replace') => void;
  removeDemandBid: (id: string) => void;
  resetDemandBids: () => void;
  saveOptimizationRun: (run: NewOptimizationRun) => void;
  clearOptimizationHistory: () => void;
}

export const seedMarketReports: MarketReport[] = defaultSupplyReports;

export const seedDemandBids: DemandBid[] = defaultDemandBids;

const isSeedMarketReport = (report: MarketReport) => report.id.startsWith('solar-');
const isSeedDemandBid = (bid: DemandBid) => bid.id.startsWith('vic1-');

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore storage failures on constrained devices/browsers.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore storage failures on constrained devices/browsers.
    }
  },
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toHourStartIso = (value = new Date()) => {
  const timestamp = new Date(value);
  timestamp.setUTCMinutes(0, 0, 0);
  return timestamp.toISOString();
};

const looksLikeLegacySampleSupplyDataset = (value: unknown): value is MarketReport[] =>
  Array.isArray(value) &&
  value.length === 8 &&
  value.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const report = item as MarketReport;
    return /^seed-\d+$/.test(report.id);
  });

const looksLikeLegacyVic1DailyDataset = (value: unknown): value is DemandBid[] =>
  Array.isArray(value) &&
  value.length === 456 &&
  value.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const bid = item as DemandBid;
    return /^vic1-\d{4}-\d{2}-\d{2}$/.test(bid.id);
  });

const normalizeDemandBid = (bid: NewDemandBid): DemandBid => ({
  id: createId('demand'),
  buyerName: bid.buyerName.trim() || 'Demand participant',
  demandKwh: Number(bid.demandKwh.toFixed(2)),
  maxPricePerKwh: Number(bid.maxPricePerKwh.toFixed(3)),
  requestedAt:
    bid.requestedAt && !Number.isNaN(new Date(bid.requestedAt).getTime())
      ? new Date(bid.requestedAt).toISOString()
      : new Date().toISOString(),
});

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      marketReports: seedMarketReports,
      demandBids: seedDemandBids,
      optimizationHistory: [],

      addMarketReport: (report) =>
        set((state) => ({
          marketReports: [
            {
              id: createId('report'),
              reporterName: report.reporterName.trim(),
              surplusKwh: Number(report.surplusKwh.toFixed(2)),
              pricePerKwh: Number(report.pricePerKwh.toFixed(3)),
              reportedAt: toHourStartIso(report.reportedAt ? new Date(report.reportedAt) : new Date()),
            },
            ...state.marketReports,
          ],
        })),

      removeMarketReport: (id) =>
        set((state) => ({
          marketReports: state.marketReports.filter((report) => report.id !== id),
        })),

      resetMarketReports: () =>
        set({
          marketReports: seedMarketReports,
        }),

      importDemandBids: (bids, mode = 'append') =>
        set((state) => {
          const normalized = bids
            .filter((bid) => bid.demandKwh > 0 && bid.maxPricePerKwh > 0)
            .map(normalizeDemandBid);

          return {
            demandBids: mode === 'replace' ? normalized : [...normalized, ...state.demandBids],
          };
        }),

      removeDemandBid: (id) =>
        set((state) => ({
          demandBids: state.demandBids.filter((bid) => bid.id !== id),
        })),

      resetDemandBids: () =>
        set({
          demandBids: seedDemandBids,
        }),

      saveOptimizationRun: (run) =>
        set((state) => ({
          optimizationHistory: [
            {
              id: createId('quote'),
              surplusKwh: Number(run.surplusKwh.toFixed(2)),
              inputPrice: Number(run.inputPrice.toFixed(3)),
              optimizedPrice: Number(run.optimizedPrice.toFixed(3)),
              expectedRevenue: Number(run.expectedRevenue.toFixed(2)),
              createdAt: new Date().toISOString(),
            },
            ...state.optimizationHistory,
          ].slice(0, 12),
        })),

      clearOptimizationHistory: () =>
        set({
          optimizationHistory: [],
        }),
    }),
    {
      name: 'voltshare-market-db',
      version: 5,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        marketReports: state.marketReports.filter((report) => !isSeedMarketReport(report)),
        demandBids: state.demandBids.filter((bid) => !isSeedDemandBid(bid)),
        optimizationHistory: state.optimizationHistory,
      }),
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<AppState> | undefined;

        return {
          ...currentState,
          ...state,
          marketReports: [...(state?.marketReports ?? []), ...seedMarketReports],
          demandBids: [...(state?.demandBids ?? []), ...seedDemandBids],
          optimizationHistory: state?.optimizationHistory ?? [],
        };
      },
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<AppState> | undefined;

        if (!state) {
          return {
            marketReports: seedMarketReports,
            demandBids: seedDemandBids,
            optimizationHistory: [],
          };
        }

        if (version < 2) {
          return {
            ...state,
            marketReports: looksLikeLegacySampleSupplyDataset(state.marketReports) ? seedMarketReports : state.marketReports,
            demandBids: seedDemandBids,
          };
        }

        if (version < 3 && looksLikeLegacyVic1DailyDataset(state.demandBids)) {
          return {
            ...state,
            demandBids: seedDemandBids,
          };
        }

        if (version < 4 && looksLikeLegacySampleSupplyDataset(state.marketReports)) {
          return {
            ...state,
            marketReports: seedMarketReports,
          };
        }

        if (version < 5) {
          return {
            ...state,
            marketReports: (state.marketReports ?? []).filter((report) => !isSeedMarketReport(report as MarketReport)),
            demandBids: (state.demandBids ?? []).filter((bid) => !isSeedDemandBid(bid as DemandBid)),
            optimizationHistory: state.optimizationHistory ?? [],
          };
        }

        return state;
      },
    },
  ),
);
