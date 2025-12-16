import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ToggleSwitch, Tabs } from 'flowbite-react';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import useStorage from '@root/src/shared/hooks/useStorage';
import { checkAmazonAuth } from '@root/src/shared/api/amazonApi';
import appStorage, { AuthStatus } from '@root/src/shared/storages/appStorage';
import ProgressIndicator from './components/ProgressIndicator';
import withErrorBoundary from '@root/src/shared/hoc/withErrorBoundary';
import withSuspense from '@root/src/shared/hoc/withSuspense';
import SmartConnectionInfo from './components/SmartConnectionInfo';
import SyncHistory from './components/SyncHistory';
import syncHistoryStorage from '@root/src/shared/storages/syncHistoryStorage';
import { useAlarm } from '@root/src/shared/hooks/useAlarm';
import { Action } from '@root/src/shared/types';
import { FaHome, FaHistory, FaSync } from 'react-icons/fa';

const Main = () => {
  const progress = useStorage(progressStorage);
  const appData = useStorage(appStorage);
  const syncAlarm = useAlarm('sync-alarm');

  // If the action is ongoing for more than 15 seconds, we assume it's stuck and mark it as complete
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

  // Check if we need to re-authenticate with Amazon
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

  const ready =
    appData.amazonStatus === AuthStatus.Success && appData.monarchStatus === AuthStatus.Success && !actionOngoing;

  const forceSync = useCallback(async () => {
    if (!ready) return;

    await chrome.runtime.sendMessage({ action: Action.FullSync });
  }, [ready]);

  const { history } = useStorage(syncHistoryStorage);

  // Calculate quick stats
  const stats = {
    totalSyncs: history?.length || 0,
    totalMatches: history?.reduce((sum, h) => sum + (h.matchesFound || 0), 0) || 0,
    successRate:
      history?.length > 0 ? ((history.filter(h => h.success).length / history.length) * 100).toFixed(0) : '0',
  };

  return (
    <div className="flex flex-col">
      {/* Quick Stats Bar */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 border-b">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-purple-700">{stats.totalMatches}</div>
            <div className="text-xs text-gray-600">Total Matches</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-700">{stats.successRate}%</div>
            <div className="text-xs text-gray-600">Success</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-700">{stats.totalSyncs}</div>
            <div className="text-xs text-gray-600">Syncs</div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="p-3 space-y-2">
        <SmartConnectionInfo
          name="Amazon connection"
          status={appData.amazonStatus}
          lastUpdated={appData.lastAmazonAuth}
          message={
            appData.amazonStatus === AuthStatus.NotLoggedIn
              ? 'Log in to Amazon and refresh'
              : appData.amazonStatus === AuthStatus.Failure
                ? 'Connection failed. Click to retry.'
                : undefined
          }
        />
        <SmartConnectionInfo
          name="Monarch connection"
          status={appData.monarchStatus}
          lastUpdated={appData.lastMonarchAuth}
          message={
            appData.monarchStatus === AuthStatus.NotLoggedIn
              ? 'Open Monarch and wait 10 seconds'
              : appData.monarchStatus === AuthStatus.Failure
                ? 'Log in to Monarch and retry'
                : undefined
          }
        />
      </div>

      {/* Tabs: Overview / History */}
      <Tabs aria-label="Main tabs" style="underline">
        <Tabs.Item active title="Overview" icon={FaHome}>
          <div className="flex flex-col gap-3 p-3">
            <ProgressIndicator progress={progress} />

            {/* Auto-Sync Controls */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="font-semibold text-sm">Daily Auto-Sync</div>
                  <div className="text-xs text-gray-500">
                    {appData.options.syncEnabled
                      ? `Next: ${syncAlarm ? new Date(syncAlarm.scheduledTime).toLocaleString() : '...'}`
                      : 'Automatically sync once per day'}
                  </div>
                </div>
                <ToggleSwitch
                  checked={appData.options.syncEnabled}
                  onChange={value => {
                    appStorage.patch({ options: { ...appData.options, syncEnabled: value } });
                  }}
                />
              </div>

              <Button color="purple" disabled={!ready} onClick={forceSync} className="w-full mt-2 font-bold">
                <FaSync className="mr-2" />
                Sync Now
              </Button>
            </div>
          </div>
        </Tabs.Item>

        <Tabs.Item title="History" icon={FaHistory}>
          <SyncHistory />
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Main, <div> Loading ... </div>), <div> Error Occur </div>);
