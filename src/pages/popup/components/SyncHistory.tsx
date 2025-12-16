import useStorage from '@root/src/shared/hooks/useStorage';
import syncHistoryStorage, { SyncRecord } from '@root/src/shared/storages/syncHistoryStorage';
import { Button } from 'flowbite-react';
import { FaCheckCircle, FaTimesCircle, FaTrash, FaFlask, FaSync } from 'react-icons/fa';

export function SyncHistory() {
  const { history } = useStorage(syncHistoryStorage);

  const clearHistory = async () => {
    if (confirm('Clear all sync history?')) {
      await syncHistoryStorage.set({ history: [] });
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <p>No sync history yet</p>
        <p className="text-xs mt-1">Run a sync to see history here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
      <div className="sticky top-0 bg-white pb-2 border-b flex justify-between items-center px-2">
        <span className="font-bold text-sm">Recent Syncs</span>
        <Button size="xs" color="light" onClick={clearHistory}>
          <FaTrash className="mr-1" />
          Clear
        </Button>
      </div>

      <div className="space-y-2 px-2">
        {history.slice(0, 10).map(record => (
          <SyncRecordItem key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}

function SyncRecordItem({ record }: { record: SyncRecord }) {
  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={`p-2 rounded border ${record.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {record.success ? (
            <FaCheckCircle className="text-green-500" size={14} />
          ) : (
            <FaTimesCircle className="text-red-500" size={14} />
          )}
          <span className="text-xs font-semibold">{new Date(record.timestamp).toLocaleString()}</span>
        </div>
        <div className="flex gap-1">
          {record.dryRun && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded">
              <FaFlask className="inline mr-1" size={10} />
              Dry-Run
            </span>
          )}
          {!record.dryRun && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded">
              <FaSync className="inline mr-1" size={10} />
              Live
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-600 space-y-0.5">
        {record.success ? (
          <>
            <div className="flex justify-between">
              <span>Amazon orders:</span>
              <span className="font-medium">{record.amazonOrders}</span>
            </div>
            <div className="flex justify-between">
              <span>Matches found:</span>
              <span className="font-medium text-green-600">{record.matchesFound}</span>
            </div>
            {record.year && (
              <div className="flex justify-between">
                <span>Year:</span>
                <span className="font-medium">{record.year}</span>
              </div>
            )}
            {record.duration && (
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{formatDuration(record.duration)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-red-600">Failed: {record.failureReason || 'Unknown error'}</div>
        )}
      </div>
    </div>
  );
}

export default SyncHistory;
