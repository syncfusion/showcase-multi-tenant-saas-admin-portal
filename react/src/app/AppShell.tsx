import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from 'lucide-react';
import { SidebarComponent } from '@syncfusion/ej2-react-navigations';
import { TooltipComponent, type TooltipEventArgs } from '@syncfusion/ej2-react-popups';
import './app-shell.css';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AppShellProps {
  appName: string;
  appSubtitle?: string;
  logo: ReactNode;
  items: NavItem[];
  currentId: string;
  onNavigate: (id: string, event: MouseEvent<HTMLAnchorElement>) => void;
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  footer?: ReactNode;
  storageKey: string;
  themeStorageKey: string;
  theme: 'light' | 'dark';
  children: ReactNode;
}

const NARROW_QUERY = '(max-width: 1023.98px)';
const SIDEBAR_ID = 'app-shell-sidebar';
const MENU_BUTTON_ID = 'app-shell-menu-button';

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(media.matches);
    media.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('resize', sync); };
  }, []);
  return narrow;
}

function readCollapsed(key: string) {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}

export function AppShell(props: AppShellProps) {
  const { appName, appSubtitle, logo, items, currentId, onNavigate, headerStart, headerEnd, footer, storageKey, theme, children } = props;
  const narrow = useNarrow();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<TooltipComponent>(null);
  const docked = !narrow && collapsed;
  const dockedRef = useRef(docked);
  dockedRef.current = docked;

  useEffect(() => { setAnimate(true); }, []);
  useEffect(() => { if (!narrow) setDrawerOpen(false); }, [narrow]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, String(collapsed)); } catch { /* optional */ }
  }, [collapsed, storageKey]);
  useEffect(() => { if (!docked) tooltipRef.current?.close(); }, [docked]);

  useEffect(() => {
    if (narrow || !animate) return;
    const workspace = workspaceRef.current;
    let done = false;
    const announce = () => {
      if (done) return;
      done = true;
      window.dispatchEvent(new Event('resize'));
    };
    const onEnd = (event: TransitionEvent) => { if (event.target === workspace && event.propertyName === 'margin-left') announce(); };
    workspace?.addEventListener('transitionend', onEnd);
    const fallback = window.setTimeout(announce, 400);
    return () => { workspace?.removeEventListener('transitionend', onEnd); window.clearTimeout(fallback); };
  }, [collapsed, narrow, animate]);

  const closeDrawer = useCallback((returnFocus: boolean) => {
    setDrawerOpen(false);
    if (returnFocus) document.getElementById(MENU_BUTTON_ID)?.focus();
  }, []);

  useEffect(() => {
    if (!narrow || !drawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer(true); };
    const onPointer = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (document.getElementById(SIDEBAR_ID)?.contains(target)) return;
      if (document.getElementById(MENU_BUTTON_ID)?.contains(target)) return;
      closeDrawer(false);
    };
    const focusTimer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`#${SIDEBAR_ID} [aria-current="page"]`)?.focus();
    }, 50);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [narrow, drawerOpen, closeDrawer]);

  function toggle() {
    if (narrow) setDrawerOpen(open => !open);
    else setCollapsed(value => !value);
  }

  function onLinkClick(id: string, event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    onNavigate(id, event);
    if (narrow) closeDrawer(false);
  }

  function beforeTooltip(args: TooltipEventArgs) {
    const label = (args.target as HTMLElement).dataset.label;
    if (!dockedRef.current || !label) { args.cancel = true; return; }
    if (tooltipRef.current) tooltipRef.current.content = label;
  }

  const expanded = narrow ? drawerOpen : !collapsed;
  const toggleLabel = narrow
    ? (drawerOpen ? 'Close navigation' : 'Open navigation')
    : (collapsed ? 'Expand navigation' : 'Collapse navigation');
  const ToggleIcon = narrow ? Menu : collapsed ? PanelLeftOpen : PanelLeftClose;

  const pageTitle = items.find(item => item.id === currentId)?.label ?? appName;

  return (
    <div className="app-shell" data-nav={narrow ? 'drawer' : collapsed ? 'docked' : 'expanded'}>
      <a className="app-shell-skip" href="#app-shell-main">Skip to content</a>
      <SidebarComponent
        key={narrow ? 'narrow' : 'wide'}
        id={SIDEBAR_ID}
        type={narrow ? 'Over' : 'Push'}
        position="Left"
        width="240px"
        enableDock={!narrow}
        dockSize="64px"
        isOpen={narrow ? drawerOpen : !collapsed}
        showBackdrop={narrow}
        closeOnDocumentClick={false}
        enableGestures={narrow}
        animate={animate}
        zIndex={1001}
      >
        <nav className="app-shell-nav" aria-label="Primary">
          <div className="app-shell-brand">
            <span className="app-shell-logo" aria-hidden="true">{logo}</span>
            <span className="app-shell-brand-text">
              <strong>{appName}</strong>
              {appSubtitle ? <small>{appSubtitle}</small> : null}
            </span>
            {narrow ? (
              <button type="button" className="app-shell-icon-button app-shell-close" aria-label="Close navigation" onClick={() => closeDrawer(true)}>
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <TooltipComponent ref={tooltipRef} target=".app-shell-link" position="RightCenter" opensOn="Hover Focus"
            showTipPointer windowCollision beforeRender={beforeTooltip}>
            <ul className="app-shell-links">
              {items.map(item => {
                const Icon = item.icon;
                const current = item.id === currentId;
                return (
                  <li key={item.id}>
                    <a className="app-shell-link" href={item.href} data-label={item.label}
                      aria-current={current ? 'page' : undefined}
                      onClick={e => onLinkClick(item.id, e)}>
                      <span className="app-shell-link-icon"><Icon size={20} aria-hidden="true" /></span>
                      <span className="app-shell-link-label">{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </TooltipComponent>
          {footer ? <div className="app-shell-footer">{footer}</div> : null}
        </nav>
      </SidebarComponent>
      <div className="app-shell-workspace" ref={workspaceRef}>
        <header className="app-shell-header">
          <div className="app-shell-header-start">
            <button type="button" id={MENU_BUTTON_ID} className="app-shell-icon-button" aria-label={toggleLabel} onClick={toggle}>
              <ToggleIcon size={18} aria-hidden="true" />
            </button>
            {headerStart}
            <strong className="app-shell-header-title">{pageTitle}</strong>
          </div>
          <div className="app-shell-header-end">
            {headerEnd}
          </div>
        </header>
        <main id="app-shell-main" className="app-shell-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}