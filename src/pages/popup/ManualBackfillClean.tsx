import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus, Page } from '@root/src/shared/storages/appStorage';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import { Button } from 'flowbite-react';
import { useCallback, useMemo } from 'react';
import DateRangeSelector from './components/DateRangeSelector';
import { Action } from '@root/src/shared/types';
import { FaPlay, FaExclamationTriangle } from 'react-icons/fa';
import type { DateRangeOption } from '@root/src/shared/storages/appStorage';
import { useAlarm } from '@root/src/shared/hooks/useAlarm';

// iOS-style toggle component (same as MainClean)
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      }`}>
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        } mt-0.5`}
      />
    </button>
  );
}

export function ManualBackfillClean() {
  const appData = useStorage(appStorage);
  const progress = useStorage(progressStorage);
  const syncAlarm = useAlarm('sync-alarm');

  const actionOngoing = useMemo(
    () => progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle,
    [progress],
  );

  const ready =
    appData.amazonStatus === AuthStatus.Success && appData.monarchStatus === AuthStatus.Success && !actionOngoing;

  const isDryRun = appData.options?.dryRunMode ?? false;

  const runBackfill = useCallback(async () => {
    if (!ready) return;

    console.log('Starting sync:', { range: appData.options?.dateRangeType, dryRun: isDryRun });
    await appStorage.patch({ page: Page.Default });
    await chrome.runtime.sendMessage({
      action: isDryRun ? Action.DryRun : Action.FullSync,
      payload: {}, // Date range is now in options
    });
    console.log('Sync message sent');
  }, [ready, isDryRun, appData.options]);

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
        selectedRange={appData.options?.dateRangeType || '14days'}
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

      {/* Sync Options - Same as Home page */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        {/* Include already-synced */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                appData.options?.overrideTransactions ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
              {appData.options?.overrideTransactions ? '✅' : '⏭️'}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {appData.options?.overrideTransactions ? 'All transactions' : 'New only'}
              </div>
              <div className="text-xs text-gray-500">
                {appData.options?.overrideTransactions ? 'Includes already-synced' : 'Skips transactions with notes'}
              </div>
            </div>
          </div>
          <Toggle
            checked={appData.options?.overrideTransactions || false}
            label="Include already-synced transactions"
            onChange={checked => {
              appData.options &&
                appStorage.patch({
                  options: { ...appData.options, overrideTransactions: checked },
                });
            }}
          />
        </div>

        {/* Preview vs Live */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                appData.options?.dryRunMode ? 'bg-gray-100' : 'bg-green-100'
              }`}>
              {appData.options?.dryRunMode ? '👁️' : '💾'}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {appData.options?.dryRunMode ? 'Preview only' : 'Save to Monarch'}
              </div>
              <div className={`text-xs ${appData.options?.dryRunMode ? 'text-gray-500' : 'text-green-600'}`}>
                {appData.options?.dryRunMode ? 'No changes made' : 'Updates will be saved'}
              </div>
            </div>
          </div>
          <Toggle
            checked={!(appData.options?.dryRunMode ?? false)}
            label="Save changes to Monarch"
            onChange={checked => {
              appData.options &&
                appStorage.patch({
                  options: { ...appData.options, dryRunMode: !checked },
                });
            }}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 pt-3">
          {/* Auto-sync */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  appData.options.syncEnabled ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                {appData.options.syncEnabled ? '🔄' : '✋'}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {appData.options.syncEnabled ? 'Auto-sync ON' : 'Manual sync'}
                </div>
                <div className="text-xs text-gray-500">
                  {appData.options.syncEnabled
                    ? syncAlarm
                      ? `Next: ${new Date(syncAlarm.scheduledTime).toLocaleTimeString()}`
                      : 'Runs every 24 hours'
                    : 'Click Sync button to run'}
                </div>
              </div>
            </div>
            <Toggle
              checked={appData.options.syncEnabled}
              label="Enable auto-sync"
              onChange={value => {
                appStorage.patch({ options: { ...appData.options, syncEnabled: value } });
              }}
            />
          </div>
        </div>
      </div>

      {/* Run Button */}
      <Button size="lg" color="success" className="w-full font-semibold" disabled={!ready} onClick={runBackfill}>
        <FaPlay className="mr-2" />
        {isDryRun ? 'Preview Matches' : 'Sync Now'}
      </Button>
    </div>
  );
}

export default ManualBackfillClean;
