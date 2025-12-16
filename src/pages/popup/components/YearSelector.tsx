import { Label, Select } from 'flowbite-react';
import { useMemo, useEffect } from 'react';

type YearSelectorProps = {
  oldestYear: number | undefined;
  onSelect: (year: string) => void;
};

export default function YearSelector({ oldestYear, onSelect }: YearSelectorProps) {
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (oldestYear === undefined) return [`${currentYear}`];

    const years: string[] = [];
    for (let i = currentYear; i >= oldestYear; i--) {
      years.push(`${i}`);
    }
    return years;
  }, [oldestYear]);

  // Auto-select current year on mount
  useEffect(() => {
    if (years.length > 0) {
      console.log('📅 Auto-selecting year:', years[0]);
      onSelect(years[0]);
    }
  }, [years, onSelect]);

  return (
    <>
      <div className="mb-2 block">
        <Label htmlFor="years" value="Select year" />
      </div>
      <Select
        onChange={e => {
          const value = e.target.value;
          console.log('📅 Year selected:', value);
          onSelect(value);
        }}
        defaultValue={years[0]}>
        {years.map(year => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
        <option value="recent">Last 3 Months</option>
      </Select>
    </>
  );
}
