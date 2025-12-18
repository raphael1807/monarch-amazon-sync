import { DateRangeOption } from '../storages/appStorage';

export function calculateDateRange(
  rangeType: DateRangeOption,
  customStart?: string,
  customEnd?: string,
): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(); // Default to now

  switch (rangeType) {
    case '7days':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      break;

    case '30days':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      break;

    case '3months':
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      startDate.setDate(startDate.getDate() - 8); // Extra buffer
      break;

    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1); // Jan 1
      endDate = new Date(now.getFullYear(), 11, 31); // Dec 31
      break;

    case 'lastYear':
      startDate = new Date(now.getFullYear() - 1, 0, 1); // Jan 1 last year
      endDate = new Date(now.getFullYear() - 1, 11, 31); // Dec 31 last year
      break;

    case 'custom':
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      } else {
        // Fallback to 3 months if custom dates not set
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
      }
      break;

    default:
      // Default to 3 months
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
  }

  return { startDate, endDate };
}
