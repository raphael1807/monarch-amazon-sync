import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ToggleSwitch } from 'flowbite-react';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import useStorage from '@root/src/shared/hooks/useStorage';
import { checkAmazonAuth, Order } from '@root/src/shared/api/amazonApi';
import appStorage, { AuthStatus } from '@root/src/shared/storages/appStorage';
import withErrorBoundary from '@root/src/shared/hoc/withErrorBoundary';
import withSuspense from '@root/src/shared/hoc/withSuspense';
import { useAlarm } from '@root/src/shared/hooks/useAlarm';
import { Action } from '@root/src/shared/types';
import transactionStorage from '@root/src/shared/storages/transactionStorage';
import { matchTransactions, MatchedTransaction } from '@root/src/shared/api/matchUtil';
import { MonarchTransaction } from '@root/src/shared/api/monarchApi';
import UnmatchedTransactions from './components/UnmatchedTransactions';
import { FaCheckCircle, FaExclamationTriangle, FaSync, FaChevronDown, FaChevronUp, FaDownload } from 'react-icons/fa';
import { stringify } from 'csv-stringify/browser/esm/sync';

const MainClean = () => {
  const progress = useStorage(progressStorage);
  const appData = useStorage(appStorage);
  const transactionData = useStorage(transactionStorage);
  const syncAlarm = useAlarm('sync-alarm');
  const [matches, setMatches] = useState<MatchedTransaction[]>([]);
  const [expanded, setExpanded] = useState(false);

  const actionOngoing = useMemo(() => {
    return progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle;
  }, [progress]);

  useEffect(() => {
    if (actionOngoing) {
      if ((progress.lastUpdated || 0) < Date.now() - 15_000) {
        progressStorage.patch({
          phase: ProgressPhase.Complete,
        });
      }
    }
  }, [actionOngoing, progress.lastUpdated]);

  const [checkedAmazon, setCheckedAmazon] = useState(false);

  useEffect(() => {
    if (
      (appData.amazonStatus === AuthStatus.Success &&
        new Date(appData.lastAmazonAuth).getTime() > Date.now() - 1000 * 60 * 60 * 24) ||
      checkedAmazon
    ) {
      return;
    }
    setCheckedAmazon(true);
    appStorage.patch({ amazonStatus: AuthStatus.Pending }).then(() => {
      checkAmazonAuth().then(amazon => {
        if (amazon.status === AuthStatus.Success) {
          appStorage.patch({
            amazonStatus: AuthStatus.Success,
            lastAmazonAuth: Date.now(),
            oldestAmazonYear: amazon.startingYear,
          });
        } else {
          appStorage.patch({ amazonStatus: amazon.status });
        }
      });
    });
  }, [appData.amazonStatus, appData.lastAmazonAuth, checkedAmazon]);

  // Load matches when sync completes
  useEffect(() => {
    const loadMatches = async () => {
      if (appData.lastSync?.success && appData.lastSync?.transactionsUpdated > 0) {
        console.log('Loading matches for display...');
        const transactions = await transactionStorage.get();

        if (transactions && transactions.transactions && transactions.orders) {
          const calculatedMatches = matchTransactions(
            transactions.transactions,
            transactions.orders,
            appData.options.overrideTransactions,
          );
          console.log('Matches loaded:', calculatedMatches.length);
          setMatches(calculatedMatches);
          setExpanded(true); // Auto-expand to show results
        }
      } else {
        setMatches([]);
        setExpanded(false);
      }
    };
    loadMatches();
  }, [appData.lastSync, appData.options.overrideTransactions]);

  const ready =
    appData.amazonStatus === AuthStatus.Success && appData.monarchStatus === AuthStatus.Success && !actionOngoing;

  const forceSync = useCallback(async () => {
    if (!ready) return;
    const isDryRun = appData.options?.dryRunMode ?? true;
    await chrome.runtime.sendMessage({
      action: isDryRun ? Action.DryRun : Action.FullSync,
    });
  }, [ready, appData.options]);

  const amazonConnected = appData.amazonStatus === AuthStatus.Success;
  const monarchConnected = appData.monarchStatus === AuthStatus.Success;

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-500">Amazon.ca ↔ Monarch Money</p>
          </div>
          {ready && (
            <Button
              size="sm"
              color={appData.options?.dryRunMode ? 'purple' : 'success'}
              onClick={forceSync}
              disabled={!ready}>
              <FaSync className="mr-1 text-xs" />
              <span className="text-xs">{appData.options?.dryRunMode ? 'Preview' : 'Sync'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status - Minimal */}
      <div className="px-5 py-4 space-y-2">
        <ConnectionPill
          label="Amazon.ca"
          connected={amazonConnected}
          onFix={() => chrome.tabs.create({ url: 'https://www.amazon.ca' })}
        />
        <ConnectionPill
          label="Monarch"
          connected={monarchConnected}
          onFix={() => chrome.tabs.create({ url: 'https://app.monarch.com' })}
        />
      </div>

      {/* Progress or Results */}
      <div className="px-5 py-3">
        {actionOngoing ? (
          <ProgressMinimal progress={progress} />
        ) : appData.lastSync?.success ? (
          <ResultsCard
            lastSync={appData.lastSync}
            matches={matches}
            expanded={expanded}
            setExpanded={setExpanded}
            unmatchedOrders={transactionData.unmatchedOrders || []}
            unmatchedTransactions={transactionData.unmatchedTransactions || []}
          />
        ) : null}
      </div>

      {/* Sync Options - Bottom */}
      {ready && (
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 space-y-3">
          {/* Re-sync existing */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">♻️</span>
              <div>
                <div className="text-sm font-medium text-gray-900">Re-sync existing</div>
                <div className="text-xs text-gray-500">Update transactions with notes</div>
              </div>
            </div>
            <ToggleSwitch
              checked={appData.options?.overrideTransactions || false}
              onChange={checked => {
                appData.options &&
                  appStorage.patch({
                    options: { ...appData.options, overrideTransactions: checked },
                  });
              }}
            />
          </div>

          {/* Preview mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{appData.options?.dryRunMode ? '🔍' : '⚡'}</span>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {appData.options?.dryRunMode ? 'Preview mode' : 'Live mode'}
                </div>
                <div
                  className={`text-xs ${appData.options?.dryRunMode ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
                  {appData.options?.dryRunMode ? 'No changes to Monarch' : 'Will update Monarch!'}
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={appData.options?.dryRunMode ?? true}
              onChange={checked => {
                appData.options &&
                  appStorage.patch({
                    options: { ...appData.options, dryRunMode: checked },
                  });
              }}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 pt-3">
            {/* Auto-Sync */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">Auto-Sync</div>
                  <div className="text-xs text-gray-500">
                    {appData.options.syncEnabled && syncAlarm
                      ? `Next: ${new Date(syncAlarm.scheduledTime).toLocaleTimeString()}`
                      : 'Sync daily automatically'}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={appData.options.syncEnabled}
                onChange={value => {
                  appStorage.patch({ options: { ...appData.options, syncEnabled: value } });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ConnectionPill({ label, connected, onFix }: { label: string; connected: boolean; onFix: () => void }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
        connected ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
      }`}>
      <div className="flex items-center gap-2.5">
        {connected ? (
          <FaCheckCircle className="text-green-600" size={18} />
        ) : (
          <FaExclamationTriangle className="text-red-600" size={18} />
        )}
        <span className={`font-semibold text-sm ${connected ? 'text-green-900' : 'text-red-900'}`}>{label}</span>
      </div>
      {!connected && (
        <Button size="xs" color="failure" onClick={onFix} className="text-xs">
          Fix
        </Button>
      )}
    </div>
  );
}

function ProgressMinimal({ progress }: { progress: { phase: ProgressPhase; complete: number; total: number } }) {
  const percent = Math.ceil((100 * progress.complete) / progress.total) || 0;

  const getPhase = () => {
    if (progress.phase === ProgressPhase.AmazonPageScan) return 'Scanning Amazon...';
    if (progress.phase === ProgressPhase.AmazonOrderDownload) return 'Loading orders...';
    if (progress.phase === ProgressPhase.MonarchDownload) return 'Fetching Monarch...';
    if (progress.phase === ProgressPhase.MonarchUpload) return 'Updating notes...';
    return 'Processing...';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-center mb-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
      <p className="text-center text-gray-700 font-medium mb-2">{getPhase()}</p>
      {progress.total > 0 && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}></div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">
            {progress.complete} / {progress.total}
          </p>
        </>
      )}
    </div>
  );
}

function ResultsCard({
  lastSync,
  matches,
  expanded,
  setExpanded,
  unmatchedOrders,
  unmatchedTransactions,
}: {
  lastSync: { transactionsUpdated: number; dryRun?: boolean; amazonOrders: number; monarchTransactions: number };
  matches: MatchedTransaction[];
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  unmatchedOrders: Order[];
  unmatchedTransactions: MonarchTransaction[];
}) {
  if (!lastSync.transactionsUpdated || lastSync.transactionsUpdated === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-600">No matches found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">✓ Complete</h3>
            <p className="text-sm opacity-90">{lastSync.transactionsUpdated} matches found</p>
          </div>
          {lastSync.dryRun && <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">Dry-Run</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-gray-100">
        <div>
          <div className="text-2xl font-bold text-gray-900">{lastSync.amazonOrders}</div>
          <div className="text-xs text-gray-500">Amazon Orders</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{lastSync.monarchTransactions}</div>
          <div className="text-xs text-gray-500">Monarch Transactions</div>
        </div>
      </div>

      {/* Matches Preview */}
      {matches.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors">
            <span>View {matches.length} matches</span>
            {expanded ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          {expanded && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {matches.slice(0, 10).map((match: MatchedTransaction, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">{match.items[0]?.title.substring(0, 40)}...</span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        (match.confidence || 100) >= 95
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                      {match.confidence || 100}%
                    </span>
                  </div>
                  <div className="text-gray-500">
                    ${match.amazon.amount.toFixed(2)} • {match.amazon.date}
                  </div>
                </div>
              ))}
              {matches.length > 10 && (
                <p className="text-center text-xs text-gray-500">+ {matches.length - 10} more matches</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unmatched Transactions */}
      <div className="px-6 py-4 border-t border-gray-100">
        <UnmatchedTransactions unmatchedAmazon={unmatchedOrders} unmatchedMonarch={unmatchedTransactions} />
      </div>

      {/* Actions */}
      {lastSync.dryRun && (
        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
          <p className="text-xs text-blue-800 mb-3 text-center font-medium">⚠️ Dry-run mode - No data was modified</p>
          <Button size="md" color="success" className="w-full" onClick={() => downloadCsv(matches)}>
            <FaDownload className="mr-2" />
            Download Report
          </Button>
        </div>
      )}
    </div>
  );
}

function downloadCsv(matches: MatchedTransaction[]) {
  if (matches.length === 0) return;

  const contents = matches.map((match, index) => {
    const itemsList = match.items
      .map(item => `${item.quantity}x ${item.title} - $${item.price.toFixed(2)}`)
      .join(' | ');
    return {
      '#': index + 1,
      Confidence: `${match.confidence || 100}%`,
      'Order ID': match.amazon.id,
      'Order Date': match.amazon.date,
      Amount: `$${match.amazon.amount.toFixed(2)}`,
      'Monarch ID': match.monarch.id,
      Items: itemsList,
    };
  });

  const csvData = stringify(contents, { header: true });
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    filename: `monarch-amazon-sync-${new Date().getFullYear()}.csv`,
  });
}

export default withErrorBoundary(
  withSuspense(MainClean, <div className="p-6">Loading...</div>),
  <div className="p-6">Error occurred</div>,
);
