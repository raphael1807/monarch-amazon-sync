import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { mapFailureReasonToMessage } from '@root/src/shared/storages/appStorage';
import { ProgressPhase, ProgressState } from '@root/src/shared/storages/progressStorage';
import { Button, Progress, Spinner } from 'flowbite-react';
import { useCallback, useState, useEffect } from 'react';
import { FaTimesCircle } from 'react-icons/fa';
import { LuCircleSlash } from 'react-icons/lu';
import { RiCheckboxCircleFill } from 'react-icons/ri';
import { stringify } from 'csv-stringify/browser/esm/sync';
import transactionStorage from '@root/src/shared/storages/transactionStorage';
import { matchTransactions, MatchedTransaction } from '@root/src/shared/api/matchUtil';
import MatchPreview from './MatchPreview';

export function ProgressIndicator({ progress }: { progress: ProgressState }) {
  const { lastSync } = useStorage(appStorage);
  const [matches, setMatches] = useState<MatchedTransaction[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const lastSyncTime = lastSync ? new Date(lastSync.time).toLocaleString() : 'Never';

  // Load matches when sync completes
  useEffect(() => {
    const loadMatches = async () => {
      if (lastSync?.success && lastSync?.transactionsUpdated > 0) {
        const appData = await appStorage.get();
        const transactions = await transactionStorage.get();

        if (transactions && transactions.transactions && transactions.orders) {
          const calculatedMatches = matchTransactions(
            transactions.transactions,
            transactions.orders,
            appData.options.overrideTransactions,
          );
          setMatches(calculatedMatches);
        }
      }
    };
    loadMatches();
  }, [lastSync]);

  const dryRunDownload = useCallback(async () => {
    if (matches.length === 0) return;

    // Create detailed CSV with item details and confidence
    const contents = matches.map((match, index) => {
      const itemsList = match.items
        .map(item => `${item.quantity}x ${item.title} - $${item.price.toFixed(2)}`)
        .join(' | ');
      return {
        '#': index + 1,
        Confidence: `${match.confidence || 100}%`,
        'Order ID': match.amazon.id,
        'Order Date': match.amazon.date,
        'Monarch Date': match.monarch.date,
        Amount: `$${match.amazon.amount.toFixed(2)}`,
        'Monarch Transaction ID': match.monarch.id,
        Items: itemsList,
        Refund: match.amazon.refund ? 'Yes' : 'No',
        'Match Reason': match.reason || 'Exact match',
      };
    });

    const csvData = stringify(contents, { header: true });
    const blob = new Blob([csvData], { type: 'text/csv' });

    const url = URL.createObjectURL(blob);
    const year = new Date().getFullYear();
    chrome.downloads.download({
      url: url,
      filename: `monarch-amazon-sync-${year}.csv`,
    });
  }, [matches]);

  const inProgress = progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle;
  return (
    <>
      {inProgress ? (
        <ProgressSpinner progress={progress} />
      ) : lastSync?.success && lastSync?.transactionsUpdated > 0 ? (
        <div className="flex flex-col gap-2 p-2">
          <div className="flex flex-col items-center gap-2 py-2">
            <RiCheckboxCircleFill className="text-green-500" size={48} />
            <span className="text-lg font-bold text-green-700">✓ Complete!</span>

            <div className="text-xs text-gray-700 text-center space-y-1 bg-gray-50 p-2 rounded w-full">
              <div>
                📦 {lastSync.amazonOrders} orders • 💳 {lastSync.monarchTransactions} transactions
              </div>
              <div className="font-semibold text-green-600">✨ {lastSync.transactionsUpdated} matches</div>
            </div>
          </div>

          {/* Show Preview Toggle */}
          {matches.length > 0 && (
            <div className="border-t pt-2">
              <Button size="sm" color="light" className="w-full mb-2" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? '▼ Hide Matches' : '▶ View Matches'}
              </Button>

              {showPreview && <MatchPreview matches={matches} onDownloadCsv={dryRunDownload} />}
            </div>
          )}

          {lastSync.dryRun ? (
            <div className="flex flex-col gap-2 p-3 bg-blue-100 border-2 border-blue-300 rounded-lg">
              <span className="text-sm font-bold text-blue-800 text-center">🔍 DRY-RUN MODE</span>
              <span className="text-xs text-blue-700 text-center">⚠️ No Monarch data was modified</span>
              {!showPreview && (
                <Button size="md" color="success" className="w-full font-bold" onClick={dryRunDownload}>
                  📥 DOWNLOAD CSV
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 bg-green-100 border-2 border-green-300 rounded-lg">
              <span className="text-sm font-bold text-green-800 text-center block">
                ✓ Updated {lastSync.transactionsUpdated} transactions!
              </span>
            </div>
          )}
        </div>
      ) : lastSync?.success && lastSync?.transactionsUpdated == 0 ? (
        <div className="flex flex-col items-center">
          <LuCircleSlash className="text-green-200" size={48} />
          <span className="text-small">Last sync: {lastSyncTime}</span>
          <span className="text-small">Amazon orders: {lastSync.amazonOrders}</span>
          <span className="text-small">Monarch transactions: {lastSync.monarchTransactions}</span>
          <span className="text-small">No transactions to update</span>
        </div>
      ) : lastSync?.success === false ? (
        <div className="flex flex-col items-center">
          <FaTimesCircle className="text-red-300" size={48} />
          <span className="text-small">Last sync: {lastSyncTime}</span>
          <span className="text-small">Sync failed, please try again</span>
          <span className="text-small text-center">
            Failure reason: {mapFailureReasonToMessage(lastSync.failureReason)}
          </span>
        </div>
      ) : null}
    </>
  );
}

function ProgressSpinner({ progress }: { progress: ProgressState }) {
  const percent = Math.ceil((100 * progress.complete) / progress.total);
  let phase = null;
  let object = null;
  let emoji = '';

  if (progress.phase === ProgressPhase.MonarchUpload) {
    emoji = '💾';
    phase = 'Updating Monarch Notes';
    object = 'transactions';
  } else if (progress.phase === ProgressPhase.AmazonPageScan) {
    emoji = '🔍';
    phase = 'Scanning Amazon Pages';
    object = 'pages';
  } else if (progress.phase === ProgressPhase.AmazonOrderDownload) {
    emoji = '📦';
    phase = 'Downloading Order Details';
    object = 'orders';
  } else if (progress.phase === ProgressPhase.MonarchDownload) {
    emoji = '💳';
    phase = 'Fetching Monarch Transactions';
    object = 'transactions';
  } else {
    emoji = '⏳';
    phase = 'Processing';
    object = 'items';
  }
  const status = `${progress.complete} / ${progress.total} ${object}`;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="self-center">
        <Spinner size="xl" color="purple" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-gray-800">
          {emoji} {phase}
        </p>
        <p className="text-sm text-gray-500 mt-1">This may take a minute...</p>
      </div>
      {progress.total > 0 && (
        <div className="w-full">
          <Progress progress={percent} color="purple" size="lg" />
          <p className="self-center text-sm text-gray-600 mt-2 text-center">{status}</p>
        </div>
      )}
    </div>
  );
}

export default ProgressIndicator;
