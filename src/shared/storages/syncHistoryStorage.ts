import { createStorage, StorageType } from './base';
import type { DateRangeOption } from './appStorage';

export interface SyncRecord {
  id: string;
  timestamp: number;
  success: boolean;
  dryRun: boolean;
  amazonOrders: number;
  monarchTransactions: number;
  matchesFound: number;
  duration?: number;
  failureReason?: string;
  year?: number;

  // Enhanced fields for detailed history
  rangeType?: DateRangeOption;
  startDate?: string; // ISO format
  endDate?: string; // ISO format
  updated?: number;
  skipped?: number;
  cached?: number;
  helperNotesAdded?: number;
  matchedTransactionIds?: string[];
  unmatchedMonarchIds?: string[];
  splitInvoiceOrderIds?: string[];
}

type State = {
  history: SyncRecord[];
};

const syncHistoryStorage = createStorage<State>(
  'sync-history',
  {
    history: [],
  },
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  },
);

const MAX_HISTORY_ENTRIES = 30;
const MAX_AGE_DAYS = 90;

export async function addSyncRecord(record: Omit<SyncRecord, 'id' | 'timestamp'>) {
  const id = Date.now().toString();
  const timestamp = Date.now();

  const newRecord: SyncRecord = {
    id,
    timestamp,
    ...record,
  };

  await syncHistoryStorage.set(state => {
    const history = [newRecord, ...(state?.history || [])];

    // Auto-cleanup: Remove entries older than MAX_AGE_DAYS
    const cutoffTime = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const filtered = history.filter(entry => entry.timestamp >= cutoffTime);

    // Keep only last MAX_HISTORY_ENTRIES
    const limited = filtered.slice(0, MAX_HISTORY_ENTRIES);

    if (limited.length < history.length) {
      console.log(`🧹 Cleaned ${history.length - limited.length} old history entries`);
    }

    return { history: limited };
  });
}

// Helper to format date range for display
export function formatDateRange(entry: SyncRecord): string {
  if (!entry.rangeType) {
    return entry.year ? `Year ${entry.year}` : 'Last 3 months';
  }

  if (entry.rangeType === 'custom' && entry.startDate && entry.endDate) {
    return `${entry.startDate} to ${entry.endDate}`;
  }

  const labels: Record<DateRangeOption, string> = {
    '7days': 'Last 7 days',
    '30days': 'Last 30 days',
    '3months': 'Last 3 months',
    thisYear: 'This year',
    lastYear: 'Last year',
    custom: 'Custom',
  };
  return labels[entry.rangeType] || entry.rangeType;
}

export async function clearSyncHistory() {
  await syncHistoryStorage.set({ history: [] });
}

export default syncHistoryStorage;
