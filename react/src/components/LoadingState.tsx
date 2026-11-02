import type { ReactNode } from 'react';

export const LoadingState: React.FC<{ label: string; variant?: 'screen' | 'overlay' | 'page' }> = ({ label, variant = 'page' }) => (
  <div className={`app-loading${variant === 'page' ? '' : ` app-loading--${variant}`}`} role="status" aria-live="polite">
    <div className="app-loading__ring" aria-hidden="true" />
    <div>{label}</div>
  </div>
);