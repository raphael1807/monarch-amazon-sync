import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus, Page } from '@root/src/shared/storages/appStorage';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import { Button, ToggleSwitch } from 'flowbite-react';
import { useCallback, useMemo, useState } from 'react';
import YearSelector from './components/YearSelector';
import { Action } from '@root/src/shared/types';
import { FaPlay, FaExclamationTriangle } from 'react-icons/fa';

export function ManualBackfillClean() {
  const appData = useStorage(appStorage);
  const progress = useStorage(progressStorage);

  const [year, setYear] = useState<string | undefined>(undefined);
  const [dryRun, setDryRun] = useState<boolean>(true);

  const actionOngoing = useMemo(
    () => progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle,
    [progress],
  );

  const ready =
    appData.amazonStatus === AuthStatus.Success && appData.monarchStatus === AuthStatus.Success && !actionOngoing;

  const runBackfill = useCallback(async () => {
    if (!ready) return;

    await appStorage.patch({ page: Page.Default });
    await chrome.runtime.sendMessage({ action: dryRun ? Action.DryRun : Action.FullSync, payload: { year: year } });
  }, [ready, dryRun, year]);

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

      {/* Year Selector */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">Select Year</div>
        <YearSelector oldestYear={appData.oldestAmazonYear} onSelect={year => setYear(year)} />
      </div>

      {/* Dry Run Toggle */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <ToggleSwitch checked={dryRun} label="Safe Mode (Dry-Run)" onChange={setDryRun} />
        <p className="text-xs text-blue-700 mt-2">
          {dryRun ? '✓ Preview changes without modifying Monarch' : '⚠️ Will update Monarch transactions'}
        </p>
      </div>

      {/* Run Button */}
      <Button
        size="lg"
        color="success"
        className="w-full font-semibold"
        disabled={!ready || !year}
        onClick={runBackfill}>
        <FaPlay className="mr-2" />
        {dryRun ? 'Preview Matches' : 'Sync Now'}
      </Button>
    </div>
  );
}

export default ManualBackfillClean;
