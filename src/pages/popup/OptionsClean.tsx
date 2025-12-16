import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus } from '@root/src/shared/storages/appStorage';
import debugStorage from '@root/src/shared/storages/debugStorage';
import syncHistoryStorage from '@root/src/shared/storages/syncHistoryStorage';
import { Button, Label, TextInput, ToggleSwitch } from 'flowbite-react';
import { useCallback, useEffect } from 'react';
import { FaDownload, FaRedo, FaTrash } from 'react-icons/fa';

export function OptionsClean() {
  const { options } = useStorage(appStorage);
  const { logs } = useStorage(debugStorage);

  const downloadDebugLog = useCallback(() => {
    const errorString = logs.join('\n');
    const blob = new Blob([errorString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: 'debug-log.txt',
    });
  }, [logs]);

  const resetMonarchStatus = useCallback(async () => {
    if (confirm('Reset Monarch connection?')) {
      await appStorage.patch({
        monarchKey: undefined,
        lastMonarchAuth: undefined,
        monarchStatus: AuthStatus.NotLoggedIn,
      });
    }
  }, []);

  const resetAmazonStatus = useCallback(async () => {
    if (confirm('Reset Amazon connection?')) {
      await appStorage.patch({ amazonStatus: AuthStatus.NotLoggedIn });
    }
  }, []);

  const clearHistory = useCallback(async () => {
    if (confirm('Clear sync history?')) {
      await syncHistoryStorage.set({ history: [] });
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
    <div className="p-6 space-y-6">
      {/* Merchant Name */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Merchant Name in Monarch</Label>
        <TextInput
          value={options?.amazonMerchant}
          type="text"
          placeholder="Amazon"
          onChange={e => {
            appStorage.patch({ options: { ...options, amazonMerchant: e.target.value } });
          }}
        />
        <p className="text-xs text-gray-500">Usually &quot;Amazon&quot; or &quot;AMAZON&quot;</p>
      </div>

      {/* Override Toggle */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <ToggleSwitch
          checked={options.overrideTransactions}
          label="Override Existing Notes"
          onChange={value => {
            appStorage.patch({ options: { ...options, overrideTransactions: value } });
          }}
        />
        <p className="text-xs text-gray-500 mt-2">Replace notes that already exist in Monarch</p>
      </div>

      {/* Debug Actions */}
      <div className="space-y-2 border-t border-gray-200 pt-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Debug Tools</p>

        {logs && logs.length > 0 && (
          <Button size="sm" color="light" onClick={downloadDebugLog} className="w-full">
            <FaDownload className="mr-2" />
            Download Debug Logs
          </Button>
        )}

        <Button size="sm" color="light" onClick={clearHistory} className="w-full">
          <FaTrash className="mr-2" />
          Clear Sync History
        </Button>

        <Button size="sm" color="warning" onClick={resetMonarchStatus} className="w-full">
          <FaRedo className="mr-2" />
          Reset Monarch
        </Button>

        <Button size="sm" color="warning" onClick={resetAmazonStatus} className="w-full">
          <FaRedo className="mr-2" />
          Reset Amazon
        </Button>
      </div>
    </div>
  );
}

export default OptionsClean;
