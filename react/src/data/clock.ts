// Fixture clocks. Each series keeps its original gaps and is shifted onto the
// calendar date when the app opens. Anchors are the latest dates already in the
// JSON, so the files themselves stay a fixed scenario.

export const MS_PER_DAY = 86_400_000;

/** Billing months end in June 2026. */
export const BILLING_ANCHOR = { year: 2026, month: 6 } as const;

/** Invoice months end in September 2025. */
export const INVOICE_ANCHOR = { year: 2025, month: 9 } as const;

/** Newest tenant createdAt in the fixtures is February 2026. */
export const TENANT_CREATED_ANCHOR = { year: 2026, month: 2 } as const;

/** Gantt marker, scheduler, and ticket SLA clock in the fixtures. */
export const TIMELINE_ANCHOR = '2025-09-29T08:00:00.000Z';

/** Newest user lastActive in the fixtures. */
export const USER_ACTIVITY_ANCHOR = '2025-06-15T00:00:00.000Z';

export function localTodayUtc(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole months from an anchor month (1–12) to the local month of `now`. */
export function monthDelta(anchorYear: number, anchorMonth: number, now = new Date()): number {
  return (now.getFullYear() - anchorYear) * 12 + (now.getMonth() + 1 - anchorMonth);
}

/** Whole days from an anchor instant's UTC date to the local calendar date of `now`. */
export function dayDelta(anchorIso: string, now = new Date()): number {
  const anchor = new Date(anchorIso);
  const anchorDay = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  return Math.round((localTodayUtc(now) - anchorDay) / MS_PER_DAY);
}

export function shiftMonthKey(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Shift a YYYY-MM-DD or ISO timestamp by whole months. Day-of-month is clamped. Time is kept. */
export function shiftIsoByMonths(iso: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(iso);
  if (!match) return shiftMonthKey(iso.slice(0, 7), delta);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const cursor = new Date(Date.UTC(year, month - 1 + delta, 1));
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  const y = cursor.getUTCFullYear();
  const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
  const d = String(clamped).padStart(2, '0');
  return `${y}-${m}-${d}${match[4]}`;
}

export function shiftIsoByDays(iso: string, days: number): string {
  const dateOnly = !iso.includes('T');
  const parsed = Date.parse(dateOnly ? `${iso.slice(0, 10)}T00:00:00.000Z` : iso);
  const next = new Date(parsed + days * MS_PER_DAY);
  if (dateOnly) return next.toISOString().slice(0, 10);
  return next.toISOString();
}

/** Fixture timeline "now", moved onto today's calendar date. Clock time stays 08:00Z. */
export function scenarioNow(now = new Date()): Date {
  return new Date(Date.parse(TIMELINE_ANCHOR) + dayDelta(TIMELINE_ANCHOR, now) * MS_PER_DAY);
}

/** Place a fixture event on the same offset from today as it had from the timeline anchor. */
export function placeOnTimeline(eventIso: string, now = new Date()): Date {
  const offset = Date.parse(eventIso) - Date.parse(TIMELINE_ANCHOR);
  return new Date(scenarioNow(now).getTime() + offset);
}

export function isoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Quarter after the one that contains `now`. October 2026 → Q1 2027. */
export function nextQuarterLabel(now = new Date()): string {
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const next = quarter === 4 ? 1 : quarter + 1;
  const year = quarter === 4 ? now.getFullYear() + 1 : now.getFullYear();
  return `Q${next} ${year}`;
}
