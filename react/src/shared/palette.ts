// Series colours for Syncfusion charts.
export type AppTheme = 'light' | 'dark';
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface Palette {
  success: string;
  warning: string;
  danger: string;
  info: string;
  neutral: string;
  reference: string;
  series: [string, string, string, string, string, string, string, string];
}

const PALETTES: Record<AppTheme, Palette> = {
  light: {
    success: '#027a48', warning: '#b54708', danger: '#b42318', info: '#175cd3', neutral: '#667085', reference: '#667085',
    series: ['#3b82f6', '#0d9488', '#a21caf', '#334155', '#0369a1', '#0891b2', '#a855f7', '#4f46e5'],
  },
  dark: {
    success: '#86efac', warning: '#fbbf24', danger: '#fca5a5', info: '#93c5fd', neutral: '#94a3b8', reference: '#94a3b8',
    series: ['#3b82f6', '#2dd4bf', '#e879f9', '#64748b', '#0ea5e9', '#22d3ee', '#a855f7', '#6366f1'],
  },
};

export const palette = (theme: AppTheme): Palette => PALETTES[theme];

export const markerTones: Palette = PALETTES.light;

export const chartTheme = (theme: AppTheme): 'Tailwind3' | 'Tailwind3Dark' =>
  theme === 'dark' ? 'Tailwind3Dark' : 'Tailwind3';

export interface Band { min?: number; tone: Tone; label?: string }
export function bandFor(value: number, bands: Band[]): Band {
  return bands.find(band => band.min === undefined || value >= band.min) ?? bands[bands.length - 1];
}

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-[var(--color-sf-fg-success-primary)]',
  warning: 'text-[var(--color-sf-fg-warning-primary)]',
  danger: 'text-[var(--color-sf-fg-danger-primary)]',
  info: 'text-[var(--color-sf-fg-info-primary)]',
  neutral: 'text-[var(--color-sf-fg-neutral-primary)]',
};

export const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-[var(--color-sf-bg-success-primary)] text-[var(--color-sf-fg-success-primary)]',
  warning: 'bg-[var(--color-sf-bg-warning-primary)] text-[var(--color-sf-fg-warning-primary)]',
  danger: 'bg-[var(--color-sf-bg-danger-primary)] text-[var(--color-sf-fg-danger-primary)]',
  info: 'bg-[var(--color-sf-bg-info-primary)] text-[var(--color-sf-fg-info-primary)]',
  neutral: 'bg-[var(--color-sf-bg-neutral-primary)] text-[var(--color-sf-fg-neutral-primary)]',
};