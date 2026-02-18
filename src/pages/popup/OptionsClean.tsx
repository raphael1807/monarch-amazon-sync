import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus } from '@root/src/shared/storages/appStorage';
import debugStorage from '@root/src/shared/storages/debugStorage';
import syncHistoryStorage from '@root/src/shared/storages/syncHistoryStorage';
import { Button, Label, TextInput, ToggleSwitch } from 'flowbite-react';
import { useCallback, useEffect } from 'react';
import { FaDownload, FaRedo, FaTrash, FaFileAlt } from 'react-icons/fa';

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

  const downloadSyncTrace = useCallback(async () => {
    console.log('🔍 Requesting trace download from background...');

    // Send message to background script to download trace
    chrome.runtime.sendMessage({ action: 'downloadTrace' }, response => {
      console.log('📬 Got response:', response);

      if (response?.success) {
        alert(`✅ Trace saved!\n\nLocation: Downloads/monarch_sync_logs/\nFile: ${response.filename}`);
      } else if (response?.error) {
        alert(`❌ Failed to save trace:\n\n${response.error}`);
      } else {
        alert('⚠️ No trace available.\n\nRun a sync first, then try again.');
      }
    });
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
          label="Re-sync Already Synced"
          onChange={value => {
            appStorage.patch({ options: { ...options, overrideTransactions: value } });
          }}
        />
        <p className="text-xs text-gray-500 mt-2">
          <strong>OFF (default):</strong> Only adds item details to transactions that don&apos;t have notes yet.
          <br />
          <strong>ON:</strong> Overwrites existing notes — useful if you want to re-sync with updated data.
        </p>
      </div>

      {/* Anthropic API Key */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">🤖 Anthropic API Key (optional)</Label>
        <TextInput
          value={options?.aiApiKey || ''}
          type="password"
          placeholder="sk-ant-..."
          onChange={e => {
            appStorage.patch({ options: { ...options, aiApiKey: e.target.value || undefined } });
          }}
        />
        {options?.aiApiKey ? (
          <p className="text-xs text-green-600 font-medium">
            ✅ API key saved ({options.aiApiKey.substring(0, 10)}...)
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Used by the Categorize tab to AI-classify transactions that keywords can&apos;t match. Uses Claude Haiku
            (~$0.001/transaction). Leave blank to use keywords only.
          </p>
        )}
      </div>

      {/* Debug Actions */}
      <div className="space-y-2 border-t border-gray-200 pt-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Debug Tools</p>

        <Button size="sm" color="success" onClick={downloadSyncTrace} className="w-full">
          <FaFileAlt className="mr-2" />
          Download Sync Trace
        </Button>

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
