import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus, Page } from '@root/src/shared/storages/appStorage';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import { Button, ToggleSwitch } from 'flowbite-react';
import { useCallback, useMemo, useState } from 'react';
import DateRangeSelector from './components/DateRangeSelector';
import { Action } from '@root/src/shared/types';
import { FaPlay, FaExclamationTriangle } from 'react-icons/fa';
import type { DateRangeOption } from '@root/src/shared/storages/appStorage';

export function ManualBackfillClean() {
  const appData = useStorage(appStorage);
  const progress = useStorage(progressStorage);

  const [dryRun, setDryRun] = useState<boolean>(true);

  const handleToggle = useCallback(
    (checked: boolean) => {
      console.log('🔄 Safe Mode toggle changed:', { from: dryRun, to: checked });
      setDryRun(checked);
    },
    [dryRun],
  );

  const actionOngoing = useMemo(
    () => progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle,
    [progress],
  );

  const ready =
    appData.amazonStatus === AuthStatus.Success && appData.monarchStatus === AuthStatus.Success && !actionOngoing;

  const runBackfill = useCallback(async () => {
    if (!ready) return;

    console.log('Starting sync:', { range: appData.options?.dateRangeType, dryRun });
    await appStorage.patch({ page: Page.Default });
    await chrome.runtime.sendMessage({
      action: dryRun ? Action.DryRun : Action.FullSync,
      payload: {}, // Date range is now in options
    });
    console.log('Sync message sent');
  }, [ready, dryRun, appData.options]);

  const amazonConnected = appData.amazonStatus === AuthStatus.Success;
  const monarchConnected = appData.monarchStatus === AuthStatus.Success;

  return (
    <div className="p-6 space-y-6">
      {/* Connection Check */}
      {(!amazonConnected || !monarchConnected) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Connection Required</p>
              <p className="text-xs text-yellow-700 mt-1">
                {!amazonConnected && 'Amazon.ca not connected. '}
                {!monarchConnected && 'Monarch not connected.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Selector */}
      <DateRangeSelector
        selectedRange={appData.options?.dateRangeType || '3months'}
        customStart={appData.options?.customStartDate}
        customEnd={appData.options?.customEndDate}
        onChange={(range: DateRangeOption, start?: string, end?: string) => {
          appData.options &&
            appStorage.patch({
              options: {
                ...appData.options,
                dateRangeType: range,
                customStartDate: start,
                customEndDate: end,
              },
            });
        }}
      />

      {/* Override Toggle */}
      <div
        className={`border-2 rounded-lg p-4 ${
          appData.options?.overrideTransactions ? 'bg-orange-50 border-orange-400' : 'bg-gray-50 border-gray-300'
        }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">♻️ Override Already-Synced Transactions</span>
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
        <p
          className={`text-xs font-medium ${
            appData.options?.overrideTransactions ? 'text-orange-800' : 'text-gray-600'
          }`}>
          {appData.options?.overrideTransactions
            ? '✓ Will update ALL transactions (even with existing notes)'
            : '○ Will only update empty transactions (skip existing notes)'}
        </p>
        <p className="text-xs text-gray-500 mt-2">💡 Enable this to refresh transactions that were already synced</p>
      </div>

      {/* Dry Run Toggle */}
      <div className={`border-2 rounded-lg p-4 ${dryRun ? 'bg-blue-50 border-blue-400' : 'bg-red-50 border-red-400'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">🔍 Safe Mode (Preview)</span>
          <ToggleSwitch checked={dryRun} onChange={handleToggle} />
        </div>
        <p className={`text-xs font-medium ${dryRun ? 'text-blue-800' : 'text-red-800'}`}>
          {dryRun ? '✓ Preview only - No Monarch changes' : '⚠️ LIVE MODE - Will update Monarch!'}
        </p>
      </div>

      {/* Run Button */}
      <Button size="lg" color="success" className="w-full font-semibold" disabled={!ready} onClick={runBackfill}>
        <FaPlay className="mr-2" />
        {dryRun ? 'Preview Matches' : 'Sync Now'}
      </Button>
    </div>
  );
}

export default ManualBackfillClean;
