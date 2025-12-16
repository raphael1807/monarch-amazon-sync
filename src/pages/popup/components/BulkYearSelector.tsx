import { useState } from 'react';
import { Button, Checkbox } from 'flowbite-react';
import { FaCalendarAlt } from 'react-icons/fa';

interface BulkYearSelectorProps {
  availableYears: number[];
  onSelect: (years: number[]) => void;
  disabled?: boolean;
}

export function BulkYearSelector({ availableYears, onSelect, disabled }: BulkYearSelectorProps) {
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());

  const toggleYear = (year: number) => {
    const newSelected = new Set(selectedYears);
    if (newSelected.has(year)) {
      newSelected.delete(year);
    } else {
      newSelected.add(year);
    }
    setSelectedYears(newSelected);
  };

  const selectAll = () => {
    setSelectedYears(new Set(availableYears));
  };

  const selectNone = () => {
    setSelectedYears(new Set());
  };

  const handleSubmit = () => {
    const years = Array.from(selectedYears).sort((a, b) => b - a);
    onSelect(years);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 mb-2">
        <FaCalendarAlt className="text-purple-600" />
        <h3 className="font-bold text-gray-800">Select Years to Sync</h3>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button size="xs" color="light" onClick={selectAll} disabled={disabled}>
          Select All
        </Button>
        <Button size="xs" color="light" onClick={selectNone} disabled={disabled}>
          Clear All
        </Button>
      </div>

      {/* Year Checkboxes */}
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded">
        {availableYears.map(year => (
          <div key={year} className="flex items-center gap-2">
            <Checkbox
              id={`year-${year}`}
              checked={selectedYears.has(year)}
              onChange={() => toggleYear(year)}
              disabled={disabled}
            />
            <label
              htmlFor={`year-${year}`}
              className={`text-sm cursor-pointer ${
                selectedYears.has(year) ? 'font-semibold text-purple-700' : 'text-gray-700'
              }`}>
              {year}
            </label>
          </div>
        ))}
      </div>

      {/* Selected Summary */}
      {selectedYears.size > 0 && (
        <div className="p-2 bg-purple-50 border border-purple-200 rounded text-center">
          <span className="text-sm font-medium text-purple-800">
            {selectedYears.size} year{selectedYears.size !== 1 ? 's' : ''} selected
          </span>
          <p className="text-xs text-purple-600 mt-1">
            This will sync:{' '}
            {Array.from(selectedYears)
              .sort((a, b) => b - a)
              .join(', ')}
          </p>
        </div>
      )}

      {/* Sync Button */}
      <Button
        color="success"
        size="lg"
        onClick={handleSubmit}
        disabled={disabled || selectedYears.size === 0}
        className="w-full font-bold">
        🚀 Sync {selectedYears.size} Year{selectedYears.size !== 1 ? 's' : ''}
      </Button>
    </div>
  );
}

export default BulkYearSelector;
