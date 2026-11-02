import { lazy, Suspense, useCallback, useMemo, type MouseEvent } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Building2, CreditCard, LayoutDashboard, LifeBuoy } from 'lucide-react';
import { AppShell, type NavItem } from './AppShell';
import { LoadingState } from '../components/LoadingState';
import { useTheme } from '../theme/ThemeProvider';

const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard'));
const Tenants = lazy(() => import('../pages/Tenants/Tenants'));
const Support = lazy(() => import('../pages/Support/Support'));
const Subscriptions = lazy(() => import('../pages/Subscriptions/Subscriptions'));

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', href: '/tenants', icon: Building2 },
  { id: 'support', label: 'Support', href: '/support', icon: LifeBuoy },
  { id: 'subscriptions', label: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();

  const currentId = useMemo(() => {
    const path = location.pathname.replace(/\/$/, '') || '/dashboard';
    const match = NAV_ITEMS.find(item => path === item.href || path.startsWith(`${item.href}/`));
    return match?.id ?? 'dashboard';
  }, [location.pathname]);

  const shellItems = useMemo(
    () => NAV_ITEMS.map(item => ({ ...item, href: `${BASE}${item.href}` })),
    [],
  );

  const handleNavigate = useCallback((id: string, event: MouseEvent<HTMLAnchorElement>) => {
    const item = NAV_ITEMS.find(entry => entry.id === id);
    if (!item) return;
    event.preventDefault();
    navigate(item.href);
  }, [navigate]);

  const themeToggle = (
    <button type="button" className="app-shell-icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
      {theme === 'light' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      )}
    </button>
  );

  const pageName = NAV_ITEMS.find(item => item.id === currentId)?.label ?? 'Dashboard';

  return (
    <div data-theme={theme}>
      <AppShell
        appName="Multi-Tenant SaaS"
        appSubtitle="Admin Portal"
        logo={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        items={shellItems}
        currentId={currentId}
        onNavigate={handleNavigate}
        headerEnd={themeToggle}
        storageKey="multi-tenant-saas-admin-nav-collapsed"
        themeStorageKey="multi-tenant-saas-admin-theme"
        theme={theme}
      >
        <Suspense key={currentId} fallback={<LoadingState label={`Loading ${pageName}…`} />}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/support" element={<Support />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </div>
  );
}