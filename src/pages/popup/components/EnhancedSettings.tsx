import { useState } from 'react';
import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage from '@root/src/shared/storages/appStorage';
import { Button, Label, TextInput, ToggleSwitch, RangeSlider } from 'flowbite-react';

export function EnhancedSettings() {
  const appData = useStorage(appStorage);
  const [matchTolerance, setMatchTolerance] = useState(appData.options.matchTolerance || 1);
  const [dateTolerance, setDateTolerance] = useState(appData.options.dateTolerance || 7);
  const [merchant, setMerchant] = useState(appData.options.amazonMerchant || 'Amazon');
  const [notifications, setNotifications] = useState(appData.options.notifications ?? true);
  const [autoSync, setAutoSync] = useState(appData.options.syncEnabled || false);
  const [aiKey, setAiKey] = useState(appData.options.aiApiKey || '');

  const saveSettings = async () => {
    await appStorage.patch({
      options: {
        ...appData.options,
        matchTolerance,
        dateTolerance,
        amazonMerchant: merchant,
        notifications,
        syncEnabled: autoSync,
        aiApiKey: aiKey || undefined,
      },
    });
    alert('Settings saved!');
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-h-96 overflow-y-auto">
      <h3 className="text-lg font-bold text-gray-800">Settings</h3>

      {/* Match Tolerance */}
      <div className="space-y-2">
        <Label htmlFor="match-tolerance" className="font-semibold">
          Amount Tolerance: ±${matchTolerance.toFixed(2)}
        </Label>
        <RangeSlider
          id="match-tolerance"
          min={0}
          max={5}
          step={0.5}
          value={matchTolerance}
          onChange={e => setMatchTolerance(parseFloat(e.target.value))}
        />
        <p className="text-xs text-gray-500">
          Matches transactions within ±${matchTolerance.toFixed(2)} of Amazon order amount
        </p>
      </div>

      {/* Date Tolerance */}
      <div className="space-y-2">
        <Label htmlFor="date-tolerance" className="font-semibold">
          Date Tolerance: ±{dateTolerance} days
        </Label>
        <RangeSlider
          id="date-tolerance"
          min={1}
          max={14}
          step={1}
          value={dateTolerance}
          onChange={e => setDateTolerance(parseInt(e.target.value))}
        />
        <p className="text-xs text-gray-500">
          Looks for Monarch transactions within ±{dateTolerance} days of Amazon order
        </p>
      </div>

      {/* Merchant Name */}
      <div className="space-y-2">
        <Label htmlFor="merchant" className="font-semibold">
          Merchant Search Term
        </Label>
        <TextInput id="merchant" value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="Amazon" />
        <p className="text-xs text-gray-500">
          Search term to find Amazon transactions in Monarch (usually &quot;Amazon&quot;)
        </p>
      </div>

      {/* Notifications Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <div>
          <div className="font-semibold text-sm">Browser Notifications</div>
          <div className="text-xs text-gray-500">Get notified when syncs complete</div>
        </div>
        <ToggleSwitch checked={notifications} onChange={setNotifications} />
      </div>

      {/* Auto Sync Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <div>
          <div className="font-semibold text-sm">Daily Auto-Sync</div>
          <div className="text-xs text-gray-500">Automatically sync once per day</div>
        </div>
        <ToggleSwitch checked={autoSync} onChange={setAutoSync} />
      </div>

      {/* Claude API Key */}
      <div className="space-y-2 p-3 bg-gray-50 rounded">
        <Label htmlFor="ai-key" className="font-semibold">
          🤖 Anthropic API Key (optional)
        </Label>
        <TextInput
          id="ai-key"
          type="password"
          value={aiKey}
          onChange={e => setAiKey(e.target.value)}
          placeholder="sk-ant-..."
        />
        <p className="text-xs text-gray-500">
          Used by the Categorize tab to AI-classify transactions that keywords can&apos;t match. Uses Claude Haiku
          (~$0.001/transaction). Leave blank to use keywords only.
        </p>
      </div>

      {/* Save Button */}
      <Button color="success" onClick={saveSettings} className="w-full font-bold">
        💾 Save Settings
      </Button>
    </div>
  );
}

export default EnhancedSettings;
