import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus, Page } from '@root/src/shared/storages/appStorage';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import { Button, ToggleSwitch, Tabs } from 'flowbite-react';
import { useCallback, useMemo, useState } from 'react';
import YearSelector from './components/YearSelector';
import BulkYearSelector from './components/BulkYearSelector';
import { Action } from '@root/src/shared/types';
import { FaCalendar, FaCalendarAlt } from 'react-icons/fa';

export function ManualBackfill() {
  const appData = useStorage(appStorage);
  const progress = useStorage(progressStorage);

  const [year, setYear] = useState<string | undefined>(undefined);
  const [dryRun, setDryRun] = useState<boolean>(true); // Default to dry-run for safety

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

  const availableYears = useMemo(() => {
    if (!appData.oldestAmazonYear) return [];
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= appData.oldestAmazonYear; y--) {
      years.push(y);
    }
    return years;
  }, [appData.oldestAmazonYear]);

  const runBulkBackfill = useCallback(
    async (years: number[]) => {
      if (!ready || years.length === 0) return;

      await appStorage.patch({ page: Page.Default });

      // Run syncs sequentially
      for (const y of years) {
        await chrome.runtime.sendMessage({
          action: dryRun ? Action.DryRun : Action.FullSync,
          payload: { year: y.toString() },
        });
        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    },
    [ready, dryRun],
  );

  return (
    <div className="m-3 flex flex-col">
      {/* Dry-Run Toggle (Global) */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <ToggleSwitch checked={dryRun} label="🔍 Dry Run Mode (Recommended)" onChange={setDryRun} />
        <p className="mt-1 text-blue-700 text-xs font-medium">
          {dryRun
            ? '✓ Safe mode: No Monarch data will be modified'
            : '⚠️ Live mode: Monarch transactions will be updated'}
        </p>
      </div>

      {/* Single vs Bulk Selection Tabs */}
      <Tabs aria-label="Year selection mode" style="underline">
        <Tabs.Item active title="Single Year" icon={FaCalendar}>
          <div className="flex flex-col gap-3">
            <YearSelector oldestYear={appData.oldestAmazonYear} onSelect={year => setYear(year)} />

            <Button color="success" disabled={!ready || !year} onClick={runBackfill} size="lg" className="font-bold">
              🚀 Sync {year || 'Selected Year'}
            </Button>
          </div>
        </Tabs.Item>

        <Tabs.Item title="Multiple Years" icon={FaCalendarAlt}>
          <BulkYearSelector
            availableYears={availableYears}
            onSelect={years => runBulkBackfill(years)}
            disabled={!ready}
          />
        </Tabs.Item>
      </Tabs>
    </div>
  );
}

export default ManualBackfill;
