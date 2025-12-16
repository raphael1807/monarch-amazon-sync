import { createStorage, StorageType } from './base';

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

export async function addSyncRecord(record: Omit<SyncRecord, 'id' | 'timestamp'>) {
  const id = Date.now().toString();
  const timestamp = Date.now();

  const newRecord: SyncRecord = {
    id,
    timestamp,
    ...record,
  };

  await syncHistoryStorage.set(state => {
    const history = [newRecord, ...(state?.history || [])].slice(0, 20); // Keep last 20
    return { history };
  });
}

export async function clearSyncHistory() {
  await syncHistoryStorage.set({ history: [] });
}

export default syncHistoryStorage;
