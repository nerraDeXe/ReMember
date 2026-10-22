const MAX_RANGE_MONTHS = 120;

function monthIndex(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 1) return null;
  return year * 12 + Number(value.slice(5, 7)) - 1;
}

function formatMonth(index) {
  const year = String(Math.floor(index / 12)).padStart(4, '0');
  const month = String(index % 12 + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function defaultAnalyticsRange(now = new Date()) {
  const endIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return {
    startMonth: formatMonth(Math.max(12, endIndex - 5)),
    endMonth: formatMonth(endIndex),
  };
}

export function validateAnalyticsRange(startMonth, endMonth, now = new Date()) {
  if (!startMonth || !endMonth) return 'Choose both a start month and an end month.';

  const startIndex = monthIndex(startMonth);
  const endIndex = monthIndex(endMonth);
  if (startIndex === null || endIndex === null) return 'Enter valid months in YYYY-MM format.';
  if (startIndex > endIndex) return 'Start month must be on or before end month.';

  const currentIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (endIndex > currentIndex) return 'Choose months up to the current month.';
  if (endIndex - startIndex + 1 > MAX_RANGE_MONTHS) return 'Choose a range of 10 years or less (120 months).';
  return '';
}
