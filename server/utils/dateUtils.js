/**
 * Formats a JavaScript Date object as a local calendar date string (YYYY-MM-DD).
 * Uses local year/month/day methods rather than toISOString() to avoid UTC timezone drift.
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates that a string is strictly YYYY-MM-DD and represents a real calendar date.
 */
export function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Shifts a YYYY-MM-DD calendar date by deltaDays (positive or negative)
 * using DST-safe pure calendar arithmetic.
 */
export function shiftDateString(dateStr, deltaDays) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns an ascending array of the last `days` calendar date strings ending at `endDateStr`.
 */
export function getLastNDates(endDateStr, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(shiftDateString(endDateStr, -i));
  }
  return result;
}

/**
 * Resolves an optional client-provided local date or falls back to server local date.
 * Throws a 400 error if a malformed date string is supplied.
 */
export function resolveTargetDate(rawDate) {
  if (rawDate === undefined || rawDate === null || rawDate === '') {
    return getLocalDateString();
  }
  if (!isValidDateString(rawDate)) {
    const err = new Error('Invalid date format. Expected a valid YYYY-MM-DD calendar date.');
    err.statusCode = 400;
    throw err;
  }
  return rawDate;
}
