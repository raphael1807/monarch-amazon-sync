import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus } from '@root/src/shared/storages/appStorage';
import debugStorage from '@root/src/shared/storages/debugStorage';
import syncHistoryStorage from '@root/src/shared/storages/syncHistoryStorage';
import { Label, TextInput, ToggleSwitch, Button, Tabs } from 'flowbite-react';
import { useCallback, useEffect } from 'react';
import EnhancedSettings from './components/EnhancedSettings';
import { FaCog, FaTools, FaDownload, FaRedo } from 'react-icons/fa';

export function Options() {
  const { options } = useStorage(appStorage);
  const { logs } = useStorage(debugStorage);

  const downloadDebugLog = useCallback(() => {
    const errorString = logs.join('\n');
    const blob = new Blob([errorString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: 'error-dump.txt',
    });
  }, [logs]);

  const resetMonarchStatus = useCallback(async () => {
    await appStorage.patch({
      monarchKey: undefined,
      lastMonarchAuth: undefined,
      monarchStatus: AuthStatus.NotLoggedIn,
    });
  }, []);

  const resetAmazonStatus = useCallback(async () => {
    await appStorage.patch({ amazonStatus: AuthStatus.NotLoggedIn });
  }, []);

  const clearHistory = useCallback(async () => {
    if (confirm('Clear all sync history? This cannot be undone.')) {
      await syncHistoryStorage.set({ history: [] });
      alert('History cleared!');
    }
  }, []);

  useEffect(() => {
    if (!options) {
      appStorage.patch({ options: { overrideTransactions: false, syncEnabled: false, amazonMerchant: 'Amazon' } });
    }
  }, [options]);

  if (!options) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <Tabs aria-label="Settings tabs" style="underline">
        <Tabs.Item active title="Settings" icon={FaCog}>
          <EnhancedSettings />
        </Tabs.Item>

        <Tabs.Item title="Advanced" icon={FaTools}>
          <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Advanced Options</h3>

            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded">
              <ToggleSwitch
                checked={options.overrideTransactions}
                label="Override existing notes"
                onChange={value => {
                  appStorage.patch({ options: { ...options, overrideTransactions: value } });
                }}
              />
              <span className="text-gray-600 text-xs">
                Replace existing notes on Monarch transactions (use with caution)
              </span>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Merchant Search Term</Label>
              <TextInput
                value={options?.amazonMerchant}
                type="text"
                placeholder="Amazon"
                onChange={e => {
                  appStorage.patch({ options: { ...options, amazonMerchant: e.target.value } });
                }}
              />
              <p className="text-xs text-gray-500">Term to search in Monarch for Amazon transactions</p>
            </div>
          </div>
        </Tabs.Item>

        <Tabs.Item title="Debug" icon={FaDownload}>
          <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold text-gray-800">Debug Tools</h3>

            {logs && logs.length > 0 && (
              <Button color="light" onClick={downloadDebugLog} className="w-full">
                <FaDownload className="mr-2" />
                Download Debug Logs ({logs.length})
              </Button>
            )}

            <Button color="light" onClick={clearHistory} className="w-full">
              <FaRedo className="mr-2" />
              Clear Sync History
            </Button>

            <div className="border-t pt-3 space-y-2">
              <Button color="warning" onClick={resetMonarchStatus} className="w-full">
                <FaRedo className="mr-2" />
                Reset Monarch Connection
              </Button>
              <p className="text-xs text-gray-600">Use if Monarch API fails. Log out, reset, then log in again.</p>
            </div>

            <div className="space-y-2">
              <Button color="warning" onClick={resetAmazonStatus} className="w-full">
                <FaRedo className="mr-2" />
                Reset Amazon Connection
              </Button>
              <p className="text-xs text-gray-600">Use if Amazon won&apos;t connect properly.</p>
            </div>
          </div>
        </Tabs.Item>
      </Tabs>
    </div>
  );
}

export default Options;
