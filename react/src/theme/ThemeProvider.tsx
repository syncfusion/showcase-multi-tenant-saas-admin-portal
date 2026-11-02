/* Theme provider — light and dark. `ready` flips when the stylesheet link loads or fails.
   The startup frame stays up until that event. A theme switch loads the next bundle
   beside the current one and removes the old link only after the new one has loaded. */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'multi-tenant-saas-admin-theme';
const EJ2_VERSION = '35.1.37';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
  ready: false,
});

export function themeStylesheet(theme: Theme): string {
  return `https://cdn.syncfusion.com/ej2/${EJ2_VERSION}/tailwind3${theme === 'dark' ? '-dark' : ''}.css`;
}

function readSaved(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* storage blocked */ }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function sameHref(a: string, b: string): boolean {
  try {
    return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
  } catch {
    return a === b;
  }
}

function isSettled(link: HTMLLinkElement): boolean {
  return link.dataset.loaded === 'true' || link.dataset.loaded === 'error';
}

/** Resolves once the link has loaded or failed. Safe if the event already fired. */
function watchLink(link: HTMLLinkElement, onReady: () => void): () => void {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    onReady();
  };
  if (isSettled(link) || performance.getEntriesByName(link.href).length > 0) {
    finish();
    return () => {};
  }
  const onLoad = () => finish();
  const onError = () => finish();
  link.addEventListener('load', onLoad);
  link.addEventListener('error', onError);
  if (isSettled(link) || performance.getEntriesByName(link.href).length > 0) finish();
  return () => {
    link.removeEventListener('load', onLoad);
    link.removeEventListener('error', onError);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readSaved);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    let cancelled = false;
    const wanted = themeStylesheet(theme);
    const current = document.getElementById('syncfusion-theme') as HTMLLinkElement | null;
    const mark = () => { if (!cancelled) setReady(true); };

    if (current && sameHref(current.href, wanted)) {
      const stop = watchLink(current, mark);
      return () => { cancelled = true; stop(); };
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = wanted;
    link.dataset.syncfusionTheme = 'next';
    const adopt = (status: 'true' | 'error') => {
      if (cancelled) {
        link.remove();
        return;
      }
      document.querySelectorAll<HTMLLinkElement>('link#syncfusion-theme, link[data-syncfusion-theme="next"]').forEach((node) => {
        if (node !== link) node.remove();
      });
      link.id = 'syncfusion-theme';
      delete link.dataset.syncfusionTheme;
      link.dataset.loaded = status;
      setReady(true);
    };
    const onLoad = () => adopt('true');
    const onError = () => adopt('error');
    link.addEventListener('load', onLoad);
    link.addEventListener('error', onError);
    document.head.appendChild(link);

    return () => {
      cancelled = true;
      link.removeEventListener('load', onLoad);
      link.removeEventListener('error', onError);
      if (link.id !== 'syncfusion-theme') link.remove();
    };
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
