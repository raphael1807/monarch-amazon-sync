import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage from '@root/src/shared/storages/appStorage';
import syncHistoryStorage from '@root/src/shared/storages/syncHistoryStorage';
import SmartConnectionInfo from './SmartConnectionInfo';
import SyncHistory from './SyncHistory';
import { Button, Tabs } from 'flowbite-react';
import { FaHistory, FaHome, FaSync } from 'react-icons/fa';

interface DashboardProps {
  onManualSync?: () => void;
}

export function Dashboard({ onManualSync }: DashboardProps) {
  const appData = useStorage(appStorage);
  const { history } = useStorage(syncHistoryStorage);

  // Calculate stats
  const stats = {
    totalSyncs: history?.length || 0,
    successfulSyncs: history?.filter(h => h.success).length || 0,
    totalMatches: history?.reduce((sum, h) => sum + (h.matchesFound || 0), 0) || 0,
    lastSync: history?.[0] || null,
  };

  const successRate = stats.totalSyncs > 0 ? ((stats.successfulSyncs / stats.totalSyncs) * 100).toFixed(0) : '0';

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header with Quick Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">Dashboard</h2>
        {onManualSync && (
          <Button size="xs" color="purple" onClick={onManualSync}>
            <FaSync className="mr-1" />
            Sync Now
          </Button>
        )}
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatsCard emoji="🎯" value={stats.totalMatches} label="Total Matches" color="purple" />
        <StatsCard emoji="✓" value={`${successRate}%`} label="Success Rate" color="green" />
        <StatsCard emoji="📊" value={stats.totalSyncs} label="Total Syncs" color="blue" />
      </div>

      {/* Connection Status */}
      <div className="space-y-2">
        <SmartConnectionInfo
          name="Amazon connection"
          status={appData.amazonStatus}
          lastUpdated={appData.lastAmazonAuth}
        />
        <SmartConnectionInfo
          name="Monarch connection"
          status={appData.monarchStatus}
          lastUpdated={appData.lastMonarchAuth}
        />
      </div>

      {/* Tabs for Home / History */}
      <Tabs aria-label="Dashboard tabs" style="underline">
        <Tabs.Item active title="Overview" icon={FaHome}>
          <LastSyncSummary lastSync={stats.lastSync} />
        </Tabs.Item>
        <Tabs.Item title="History" icon={FaHistory}>
          <SyncHistory />
        </Tabs.Item>
      </Tabs>
    </div>
  );
}

function StatsCard({
  emoji,
  value,
  label,
  color,
}: {
  emoji: string;
  value: string | number;
  label: string;
  color: string;
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  return (
    <div className={`p-2 rounded border ${colorClasses[color as keyof typeof colorClasses]} text-center`}>
      <div className="text-2xl">{emoji}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function LastSyncSummary({
  lastSync,
}: {
  lastSync: { timestamp: number; success: boolean; amazonOrders: number; matchesFound: number; dryRun: boolean } | null;
}) {
  if (!lastSync) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="text-base">No syncs yet</p>
        <p className="text-sm mt-2">Click &quot;Manual backfill&quot; to get started!</p>
      </div>
    );
  }

  const timeSince = Date.now() - lastSync.timestamp;
  const hoursAgo = Math.floor(timeSince / (1000 * 60 * 60));
  const timeAgo =
    hoursAgo < 1
      ? `${Math.floor(timeSince / (1000 * 60))} minutes ago`
      : hoursAgo < 24
        ? `${hoursAgo} hours ago`
        : `${Math.floor(hoursAgo / 24)} days ago`;

  return (
    <div className="p-4 space-y-3">
      <div className="text-center">
        <p className="text-sm text-gray-600">Last Sync</p>
        <p className="text-lg font-semibold text-gray-800">{timeAgo}</p>
      </div>

      <div className="bg-gray-50 p-3 rounded space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className={`font-medium ${lastSync.success ? 'text-green-600' : 'text-red-600'}`}>
            {lastSync.success ? '✓ Success' : '✗ Failed'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Mode:</span>
          <span className="font-medium">{lastSync.dryRun ? '🔍 Dry-Run' : '🚀 Live'}</span>
        </div>
        {lastSync.success && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Orders:</span>
              <span className="font-medium">{lastSync.amazonOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Matches:</span>
              <span className="font-medium text-green-600">{lastSync.matchesFound}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
