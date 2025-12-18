import { Button } from 'flowbite-react';
import { useState } from 'react';
import useStorage from '@root/src/shared/hooks/useStorage';
import syncHistoryStorage, { formatDateRange, type SyncRecord } from '@root/src/shared/storages/syncHistoryStorage';
import { FaChevronDown, FaChevronRight, FaDownload, FaRedo, FaTrash } from 'react-icons/fa';

export function SyncHistoryTab() {
  const { history } = useStorage(syncHistoryStorage);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const exportToCSV = () => {
    if (!history || history.length === 0) {
      alert('No history to export');
      return;
    }

    const headers = [
      'Timestamp',
      'Date Range',
      'Start Date',
      'End Date',
      'Amazon Orders',
      'Monarch Transactions',
      'Matched',
      'Updated',
      'Skipped',
      'Cached',
      'Helper Notes',
      'Duration',
      'Status',
      'Error',
    ];

    const rows = history.map(entry => [
      new Date(entry.timestamp).toLocaleString(),
      formatDateRange(entry),
      entry.startDate || '',
      entry.endDate || '',
      entry.amazonOrders,
      entry.monarchTransactions,
      entry.matchesFound,
      entry.updated || 0,
      entry.skipped || 0,
      entry.cached || 0,
      entry.helperNotesAdded || 0,
      entry.duration || '',
      entry.success ? 'Success' : 'Failed',
      entry.failureReason || '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: `monarch_sync_history_${Date.now()}.csv`,
      saveAs: true,
    });
    URL.revokeObjectURL(url);
  };

  const clearAllHistory = async () => {
    if (confirm('Clear all sync history? This cannot be undone.')) {
      await syncHistoryStorage.set({ history: [] });
      alert('✅ History cleared!');
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-4xl mb-3">📜</div>
        <p className="font-medium">No sync history yet</p>
        <p className="text-sm mt-2">Run a sync to start tracking history</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">📜 Sync History</h3>
        <div className="flex gap-2">
          <Button size="xs" color="light" onClick={exportToCSV}>
            <FaDownload className="mr-1" />
            Export CSV
          </Button>
          <Button size="xs" color="failure" onClick={clearAllHistory}>
            <FaTrash className="mr-1" />
            Clear All
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Showing {history.length} sync{history.length !== 1 ? 's' : ''} (auto-cleans after 90 days, keeps last 30)
      </p>

      <div className="space-y-2">
        {history.map(entry => (
          <SyncHistoryEntry key={entry.id} entry={entry} isExpanded={expandedId === entry.id} onToggle={toggleExpand} />
        ))}
      </div>
    </div>
  );
}

function SyncHistoryEntry({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: SyncRecord;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) {
  const statusColor = entry.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  const statusIcon = entry.success ? '🟢' : '🔴';

  return (
    <div className={`border-2 rounded-lg ${statusColor} overflow-hidden transition-all`}>
      {/* Header - Always Visible */}
      <div
        className="p-3 cursor-pointer hover:bg-opacity-70"
        onClick={() => onToggle(entry.id)}
        onKeyDown={e => e.key === 'Enter' && onToggle(entry.id)}
        role="button"
        tabIndex={0}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs">{isExpanded ? <FaChevronDown /> : <FaChevronRight />}</span>
              <span className="font-semibold text-sm">
                {statusIcon} {new Date(entry.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>📅 {formatDateRange(entry)}</div>
              <div>
                📦 {entry.amazonOrders} Amazon → 💳 {entry.monarchTransactions} Monarch →{' '}
                <span className="font-medium text-green-600">✅ {entry.matchesFound} matched</span>
              </div>
              {!entry.success && entry.failureReason && (
                <div className="text-red-600 font-medium">❌ {entry.failureReason}</div>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>⏱️ {entry.duration || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-200 space-y-3">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white bg-opacity-50 p-2 rounded">
              <div className="text-xs text-gray-500">Updated</div>
              <div className="font-bold text-green-600">{entry.updated || 0}</div>
            </div>
            <div className="bg-white bg-opacity-50 p-2 rounded">
              <div className="text-xs text-gray-500">Skipped</div>
              <div className="font-bold text-gray-600">{entry.skipped || 0}</div>
            </div>
            <div className="bg-white bg-opacity-50 p-2 rounded">
              <div className="text-xs text-gray-500">Cached</div>
              <div className="font-bold text-blue-600">{entry.cached || 0}</div>
            </div>
          </div>

          {/* Helper Notes */}
          {entry.helperNotesAdded && entry.helperNotesAdded > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <div className="text-xs font-medium text-yellow-800">
                ⚠️ {entry.helperNotesAdded} helper note{entry.helperNotesAdded !== 1 ? 's' : ''} added for split
                invoices
              </div>
            </div>
          )}

          {/* Unmatched Info */}
          {entry.unmatchedMonarchIds && entry.unmatchedMonarchIds.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded p-2">
              <div className="text-xs font-medium text-orange-800 mb-1">
                ⚠️ {entry.unmatchedMonarchIds.length} unmatched Monarch transaction
                {entry.unmatchedMonarchIds.length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-orange-600">Check for split invoices or manual categorization needed</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button size="xs" color="light" className="flex-1" disabled>
              <FaRedo className="mr-1" />
              Re-run This Sync
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncHistoryTab;
