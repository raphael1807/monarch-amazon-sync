import { Label, Select } from 'flowbite-react';
import { useMemo, useState } from 'react';

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

  const [selectedValue, setSelectedValue] = useState<string>(years[0] || '');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    console.log('📅 Year selected:', value || 'Last 3 Months');
    setSelectedValue(value);
    onSelect(value);
  };

  return (
    <>
      <div className="mb-2 block">
        <Label htmlFor="years" value="Select year" />
      </div>
      <Select id="years" value={selectedValue} onChange={handleChange}>
        {years.map(year => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
        <option value="">Last 3 Months</option>
      </Select>
    </>
  );
}
