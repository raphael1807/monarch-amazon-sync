import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { mapFailureReasonToMessage } from '@root/src/shared/storages/appStorage';
import { ProgressPhase, ProgressState } from '@root/src/shared/storages/progressStorage';
import { Button, Progress, Spinner } from 'flowbite-react';
import { useCallback, useEffect, useState } from 'react';
import { FaTimesCircle } from 'react-icons/fa';
import { LuCircleSlash } from 'react-icons/lu';
import { RiCheckboxCircleFill } from 'react-icons/ri';
import { stringify } from 'csv-stringify/browser/esm/sync';
import transactionStorage from '@root/src/shared/storages/transactionStorage';
import { matchTransactions } from '@root/src/shared/api/matchUtil';

export function ProgressIndicator({ progress }: { progress: ProgressState }) {
  const { lastSync } = useStorage(appStorage);
  const [csvDownloaded, setCsvDownloaded] = useState(false);
  const [lastProcessedSync, setLastProcessedSync] = useState<number | null>(null);

  const lastSyncTime = lastSync ? new Date(lastSync.time).toLocaleString() : 'Never';

  const dryRunDownload = useCallback(async () => {
    const appData = await appStorage.get();
    const transactions = await transactionStorage.get();

    if (!lastSync || !transactions || !lastSync?.dryRun) {
      return;
    }

    const matches = matchTransactions(
      transactions.transactions,
      transactions.orders,
      appData.options.overrideTransactions,
    );

    // Create detailed CSV with item details
    const contents = matches.map(match => {
      const itemsList = match.items
        .map(item => `${item.quantity}x ${item.title} - $${item.price.toFixed(2)}`)
        .join(' | ');
      return {
        'Order ID': match.amazon.id,
        'Order Date': match.amazon.date,
        'Monarch Transaction Date': match.monarch.date,
        Amount: `$${match.amazon.amount.toFixed(2)}`,
        'Monarch Transaction ID': match.monarch.id,
        Items: itemsList,
        Refund: match.amazon.refund ? 'Yes' : 'No',
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

    setCsvDownloaded(true);
  }, [lastSync]);

  // Auto-download CSV when dry-run completes (only when transitioning from in-progress to complete)
  useEffect(() => {
    const shouldAutoDownload =
      lastSync?.success &&
      lastSync?.dryRun &&
      lastSync?.time &&
      lastSync.time !== lastProcessedSync &&
      progress.phase === ProgressPhase.Complete && // Only when actually complete
      lastSync.transactionsUpdated > 0; // And there are matches

    if (shouldAutoDownload) {
      setLastProcessedSync(lastSync.time);
      setCsvDownloaded(false);
      // Auto-download after UI settles
      setTimeout(() => {
        dryRunDownload();
      }, 800);
    }
  }, [lastSync, dryRunDownload, lastProcessedSync, progress.phase]);

  const inProgress = progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle;
  return (
    <>
      {inProgress ? (
        <ProgressSpinner progress={progress} />
      ) : lastSync?.success && lastSync?.transactionsUpdated > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <RiCheckboxCircleFill className="text-green-500" size={48} />
          <span className="text-base font-semibold text-green-700">✓ Sync Complete</span>
          <div className="text-sm text-gray-600 text-center">
            <div>📦 {lastSync.amazonOrders} Amazon orders found</div>
            <div>💳 {lastSync.monarchTransactions} Monarch transactions</div>
            <div>✨ {lastSync.transactionsUpdated} matches found</div>
          </div>
          {lastSync.dryRun ? (
            <div className="flex flex-col items-center gap-2 mt-2 p-3 bg-blue-50 rounded-lg w-full">
              <span className="text-sm font-medium text-blue-800">🔍 Dry-Run Mode</span>
              <span className="text-xs text-blue-600 text-center">No Monarch data was modified</span>
              {csvDownloaded ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-green-600 font-medium">✓ CSV Downloaded!</span>
                  <span className="text-xs text-gray-500">Check your Downloads folder</span>
                  <Button size="xs" outline color="blue" onClick={dryRunDownload}>
                    Download Again
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Spinner size="sm" />
                  <span className="text-xs text-blue-600">Preparing CSV download...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 p-2 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-700">
                ✓ Updated {lastSync.transactionsUpdated} Monarch transactions
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
