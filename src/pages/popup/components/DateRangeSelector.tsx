import { Label, Radio } from 'flowbite-react';
import { DateRangeOption } from '@root/src/shared/storages/appStorage';
import { useState } from 'react';

interface DateRangeSelectorProps {
  selectedRange: DateRangeOption;
  customStart?: string;
  customEnd?: string;
  onChange: (range: DateRangeOption, start?: string, end?: string) => void;
}

export function DateRangeSelector({ selectedRange, customStart, customEnd, onChange }: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(selectedRange === 'custom');

  const handleRangeChange = (range: DateRangeOption) => {
    setShowCustom(range === 'custom');
    if (range !== 'custom') {
      onChange(range);
    }
  };

  const handleCustomDateChange = (start?: string, end?: string) => {
    onChange('custom', start || customStart, end || customEnd);
  };

  const getEstimate = (range: DateRangeOption): string => {
    const estimates: Record<DateRangeOption, string> = {
      '7days': '~1-3 orders',
      '14days': '~3-7 orders',
      '30days': '~5-15 orders',
      '3months': '~15-30 orders',
      '6months': '~30-50 orders',
      thisYear: '~50-100 orders',
      lastYear: '~50-100 orders',
      custom: 'Varies',
    };
    return estimates[range];
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-semibold text-gray-700">📅 Select Sync Period</Label>

      <div className="grid grid-cols-2 gap-3">
        {/* 7 days */}
        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200 hover:border-blue-300">
          <Radio
            id="range-7days"
            name="dateRange"
            value="7days"
            checked={selectedRange === '7days'}
            onChange={() => handleRangeChange('7days')}
          />
          <label htmlFor="range-7days" className="text-sm cursor-pointer flex-1">
            <div className="font-medium">Last 7 days</div>
            <div className="text-xs text-gray-500">{getEstimate('7days')}</div>
          </label>
        </div>

        {/* 14 days */}
        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-blue-200 bg-blue-50">
          <Radio
            id="range-14days"
            name="dateRange"
            value="14days"
            checked={selectedRange === '14days'}
            onChange={() => handleRangeChange('14days')}
          />
          <label htmlFor="range-14days" className="text-sm cursor-pointer flex-1">
            <div className="font-medium">Last 14 days ⭐</div>
            <div className="text-xs text-gray-500">{getEstimate('14days')}</div>
          </label>
        </div>

        {/* 30 days */}
        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200 hover:border-blue-300">
          <Radio
            id="range-30days"
            name="dateRange"
            value="30days"
            checked={selectedRange === '30days'}
            onChange={() => handleRangeChange('30days')}
          />
          <label htmlFor="range-30days" className="text-sm cursor-pointer flex-1">
            <div className="font-medium">Last 30 days</div>
            <div className="text-xs text-gray-500">{getEstimate('30days')}</div>
          </label>
        </div>

        {/* 3 months */}
        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200 hover:border-blue-300">
          <Radio
            id="range-3months"
            name="dateRange"
            value="3months"
            checked={selectedRange === '3months'}
            onChange={() => handleRangeChange('3months')}
          />
          <label htmlFor="range-3months" className="text-sm cursor-pointer flex-1">
            <div className="font-medium">Last 3 months</div>
            <div className="text-xs text-gray-500">{getEstimate('3months')}</div>
          </label>
        </div>

        {/* 6 months */}
        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200 hover:border-blue-300">
          <Radio
            id="range-6months"
            name="dateRange"
            value="6months"
            checked={selectedRange === '6months'}
            onChange={() => handleRangeChange('6months')}
          />
          <label htmlFor="range-6months" className="text-sm cursor-pointer flex-1">
            <div className="font-medium">Last 6 months</div>
            <div className="text-xs text-gray-500">{getEstimate('6months')}</div>
          </label>
        </div>

        {/* This year */}
        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200 hover:border-blue-300">
          <Radio
            id="range-thisYear"
            name="dateRange"
            value="thisYear"
            checked={selectedRange === 'thisYear'}
            onChange={() => handleRangeChange('thisYear')}
          />
          <label htmlFor="range-thisYear" className="text-sm cursor-pointer flex-1">
            <div className="font-medium">This year (2025)</div>
            <div className="text-xs text-gray-500">{getEstimate('thisYear')}</div>
          </label>
        </div>
      </div>

      {/* Custom range */}
      <div className="flex items-start space-x-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200 hover:border-blue-300">
        <Radio
          id="range-custom"
          name="dateRange"
          value="custom"
          checked={selectedRange === 'custom'}
          onChange={() => handleRangeChange('custom')}
          className="mt-1"
        />
        <div className="flex-1 space-y-3">
          <label htmlFor="range-custom" className="cursor-pointer">
            <div className="font-medium text-sm">Custom Date Range</div>
            <div className="text-xs text-gray-500">Select specific start and end dates</div>
          </label>

          {showCustom && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-xs text-gray-600 mb-1" htmlFor="customStart">
                  Start Date
                </Label>
                <input
                  id="customStart"
                  type="date"
                  value={customStart || ''}
                  onChange={e => handleCustomDateChange(e.target.value, customEnd)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1" htmlFor="customEnd">
                  End Date
                </Label>
                <input
                  id="customEnd"
                  type="date"
                  value={customEnd || ''}
                  onChange={e => handleCustomDateChange(customStart, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          💡 <strong>Tip:</strong> Use &quot;Last 3 months&quot; for regular syncs. Use custom range to backfill
          specific periods or re-sync orders that didn&apos;t match.
        </p>
      </div>
    </div>
  );
}

export default DateRangeSelector;
