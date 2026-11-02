// en-US formatting module

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fixed = (digits: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const money = (value: number): string => usd.format(value);
export const count = (value: number): string => whole.format(value);

export const percent = (ratio: number, digits = 1): string =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: digits }).format(ratio);

export function compactMoney(value: number): string {
  const sign = value < 0 ? '-' : '', absolute = Math.abs(value);
  if (absolute >= 1e9) return `${sign}$${fixed(absolute >= 1e10 ? 0 : 1).format(absolute / 1e9)}B`;
  if (absolute >= 1e6) return `${sign}$${fixed(absolute < 1e7 ? 2 : absolute < 1e8 ? 1 : 0).format(absolute / 1e6)}M`;
  return money(value);
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const monthLabel = (month: string): string => monthFormat.format(new Date(`${month}-01T00:00:00Z`));
export const dateLabel = (date: Date): string => dayFormat.format(date);

export const DATE_FORMAT = 'MM/dd/yyyy';
export const SYNCFUSION_FORMATS = { money: 'C0', count: 'N0', percent: 'P1' } as const;