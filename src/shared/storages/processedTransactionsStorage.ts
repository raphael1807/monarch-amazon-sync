import { StorageType, createStorage } from '@src/shared/storages/base';

export type ProcessedTransaction = {
  noteHash: string; // SHA-256 hash of the note content
  lastUpdated: number; // Unix timestamp
  amazonOrderId: string; // For reference
  amount: number; // For debugging
};

type State = {
  // Map of Monarch transaction ID -> processed info
  processedTransactions: Record<string, ProcessedTransaction>;
};

const processedTransactionsStorage = createStorage<State>(
  'processedTransactions',
  {
    processedTransactions: {},
  },
  {
    storageType: StorageType.Local,
    liveUpdate: false, // Don't need live updates for cache
  },
);

// Helper to compute hash of note content
export async function computeNoteHash(note: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(note);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // First 16 chars is enough
}

// Check if transaction was already processed with the same note
export async function wasAlreadyProcessed(monarchId: string, noteContent: string): Promise<boolean> {
  const storage = await processedTransactionsStorage.get();
  const processed = storage.processedTransactions[monarchId];

  if (!processed) {
    return false; // Never processed before
  }

  const currentHash = await computeNoteHash(noteContent);
  return processed.noteHash === currentHash;
}

// Mark transaction as processed
export async function markAsProcessed(
  monarchId: string,
  noteContent: string,
  amazonOrderId: string,
  amount: number,
): Promise<void> {
  const storage = await processedTransactionsStorage.get();
  const noteHash = await computeNoteHash(noteContent);

  storage.processedTransactions[monarchId] = {
    noteHash,
    lastUpdated: Date.now(),
    amazonOrderId,
    amount,
  };

  await processedTransactionsStorage.set(storage);
}

// Clear all cached transactions
export async function clearProcessedCache(): Promise<void> {
  await processedTransactionsStorage.set({
    processedTransactions: {},
  });
}

// Clear transactions older than specified days
export async function clearOldProcessedTransactions(daysOld: number = 30): Promise<number> {
  const storage = await processedTransactionsStorage.get();
  const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

  let removedCount = 0;
  const filtered: Record<string, ProcessedTransaction> = {};

  for (const [id, data] of Object.entries(storage.processedTransactions)) {
    if (data.lastUpdated >= cutoffTime) {
      filtered[id] = data;
    } else {
      removedCount++;
    }
  }

  await processedTransactionsStorage.set({
    processedTransactions: filtered,
  });

  return removedCount;
}

// Get cache statistics
export async function getCacheStats(): Promise<{
  total: number;
  oldest: number | null;
  newest: number | null;
}> {
  const storage = await processedTransactionsStorage.get();
  const entries = Object.values(storage.processedTransactions);

  if (entries.length === 0) {
    return { total: 0, oldest: null, newest: null };
  }

  const timestamps = entries.map(e => e.lastUpdated);
  return {
    total: entries.length,
    oldest: Math.min(...timestamps),
    newest: Math.max(...timestamps),
  };
}

export default processedTransactionsStorage;
