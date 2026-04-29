/**
 * Date/Time utilities with Malaysia timezone (Asia/Kuala_Lumpur) support.
 * All display timestamps should use these functions for consistency.
 */

export const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

/**
 * Format date and time in Malaysia timezone
 * Example: "15/01/2026, 16:30:00"
 */
export function formatMYDateTime(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-MY', {
    timeZone: MALAYSIA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format date only in Malaysia timezone
 * Example: "15/01/2026"
 */
export function formatMYDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-MY', {
    timeZone: MALAYSIA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format time only in Malaysia timezone
 * Example: "16:30"
 */
export function formatMYTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-MY', {
    timeZone: MALAYSIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  });
}

/**
 * Format time with seconds in Malaysia timezone
 * Example: "16:30:45"
 */
export function formatMYTimeWithSeconds(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-MY', {
    timeZone: MALAYSIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format time with milliseconds in Malaysia timezone
 * Example: "16:30:45.123"
 */
export function formatMYTimeWithMs(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const time = d.toLocaleTimeString('en-MY', {
    timeZone: MALAYSIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${time}.${ms}`;
}

/**
 * Format date in short format
 * Example: "15 Jan"
 */
export function formatMYDateShort(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-MY', {
    timeZone: MALAYSIA_TZ,
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format datetime in short format
 * Example: "15 Jan, 16:30"
 */
export function formatMYDateTimeShort(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-MY', {
    timeZone: MALAYSIA_TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return formatMYDateShort(d);
}

/**
 * Get current time in Malaysia timezone as a formatted string
 */
export function getCurrentMYTime(): string {
  return formatMYTimeWithSeconds(new Date());
}

/**
 * Get current date in Malaysia timezone as a formatted string
 */
export function getCurrentMYDate(): string {
  return formatMYDate(new Date());
}

/**
 * Get current datetime in Malaysia timezone as a formatted string
 */
export function getCurrentMYDateTime(): string {
  return formatMYDateTime(new Date());
}

/**
 * Format date/time that is already in the correct timezone (no conversion).
 * Use this for dates from SQL Server that are already in Malaysia timezone.
 * Example: "15/01/2026, 16:30:00"
 */
export function formatLocalDateTime(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format date/time (already in correct timezone) in short format.
 * Example: "15 Jan, 16:30"
 */
export function formatLocalDateTimeShort(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format ISO timestamp without timezone conversion.
 * Replaces T with space and removes milliseconds.
 * Use for dates already in the correct timezone (e.g., SQL Server dates).
 * Example: "2026-01-15T16:45:57.777Z" -> "2026-01-15 16:45:57"
 */
export function formatTimestampNoConvert(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return '-';

  const str = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();

  // Match: 2026-01-15T16:45:57.777Z -> 2026-01-15 16:45:57
  const match = str.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (!match) return '-';

  return `${match[1]} ${match[2]}`;
}
