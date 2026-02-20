import { StorageType, createStorage } from './base';

export type AccountSnapshot = {
  id: string;
  name: string;
  balance: number;
  type: string;
  subtype: string;
};

export type Snapshot = {
  timestamp: number;
  accounts: AccountSnapshot[];
  netWorth: number;
  investments: number;
  cash: number;
};

type SnapshotState = {
  snapshots: Snapshot[];
};

const MAX_SNAPSHOTS = 50;

const snapshotStorage = createStorage<SnapshotState>(
  'snapshots',
  { snapshots: [] },
  { storageType: StorageType.Local, liveUpdate: true },
);

export async function addSnapshot(snapshot: Snapshot) {
  const state = await snapshotStorage.get();
  const updated = [snapshot, ...state.snapshots].slice(0, MAX_SNAPSHOTS);
  await snapshotStorage.patch({ snapshots: updated });
}

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  const state = await snapshotStorage.get();
  return state.snapshots[0] ?? null;
}

export async function getPreviousSnapshot(): Promise<Snapshot | null> {
  const state = await snapshotStorage.get();
  return state.snapshots[1] ?? null;
}

export default snapshotStorage;
