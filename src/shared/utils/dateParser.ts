// Parse French dates from Amazon.ca

const FRENCH_MONTHS: { [key: string]: number } = {
  janvier: 0,
  février: 1,
  fevrier: 1, // without accent
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7, // without accent
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11, // without accent
};

/**
 * Parse French date format from Amazon.ca
 * Examples: "7 décembre 2025", "28 novembre 2025"
 * Returns ISO date string (YYYY-MM-DD) or null if parsing fails
 */
export function parseFrenchDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    // Parse French format first: "7 décembre 2025"
    const parts = dateStr.trim().toLowerCase().split(/\s+/);

    if (parts.length >= 3) {
      const day = parseInt(parts[0]);
      const monthName = parts[1];
      const year = parseInt(parts[2]);

      const month = FRENCH_MONTHS[monthName];

      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        const date = new Date(year, month, day);
        const result = date.toISOString().split('T')[0];
        console.log(`✓ Parsed French date: "${dateStr}" → ${result}`);
        return result;
      }
    }

    // Try standard formats as fallback
    const standardDate = new Date(dateStr);
    if (!isNaN(standardDate.getTime())) {
      const result = standardDate.toISOString().split('T')[0];
      console.log(`✓ Parsed standard date: "${dateStr}" → ${result}`);
      return result;
    }

    console.warn('❌ Could not parse date:', dateStr);
    return null;
  } catch (e) {
    console.error('Error parsing date:', dateStr, e);
    return null;
  }
}

/**
 * Convert French date to timestamp for comparison
 */
export function parseFrenchDateToTimestamp(dateStr: string): number | null {
  const isoDate = parseFrenchDate(dateStr);
  if (!isoDate) return null;
  return new Date(isoDate).getTime();
}

export default parseFrenchDate;
