import { FormEvent, useEffect, useState } from 'react';
import POSWorkspace from './components/POSWorkspace';
import ShiftWorkspace from './components/ShiftWorkspace';
import RetailSalesWorkspace from './components/RetailSalesWorkspace';
import BarTicketsWorkspace from './components/BarTicketsWorkspace';
import BarServiceWorkspace from './components/BarServiceWorkspace';
import InventoryWorkspace from './components/InventoryWorkspace';
import InventoryReconciliationWorkspace from './components/InventoryReconciliationWorkspace';
import OrganisationWorkspace from './components/OrganisationWorkspace';
import CatalogueWorkspace from './components/CatalogueWorkspace';
import BarMenuWorkspace from './components/BarMenuWorkspace';
import ProcurementWorkspace from './components/ProcurementWorkspace';
import OfflineDeviceWorkspace from './components/OfflineDeviceWorkspace';
import OfflineReconciliationWorkspace from './components/OfflineReconciliationWorkspace';
import ExciseComplianceWorkspace from './components/ExciseComplianceWorkspace';
import TaxPricingWorkspace from './components/TaxPricingWorkspace';
import FinanceAutomationWorkspace from './components/FinanceAutomationWorkspace';
import TradePortalWorkspace from './components/TradePortalWorkspace';
import ReportsWorkspace from './components/ReportsWorkspace';
import { APP_VERSION } from './config/version';
import { PermissionProvider } from './ActionGuard';
import {
  LayoutDashboard, Store, Wine, Package, Building2, Truck, Users,
  BarChart3, ShieldCheck, Settings, CircleHelp, Menu, Bell, Search,
  ArrowUpRight, Activity, Boxes, ReceiptText, ClipboardCheck, LogOut,
  LockKeyhole, Mail, AlertCircle
} from 'lucide-react';

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'Retail POS', icon: Store, group: 'Operations' },
  { label: 'Bar POS', icon: Wine, group: 'Operations' },
  { label: 'Shift Management', icon: ClipboardCheck, group: 'Operations' },
  { label: 'Sales & Refunds', icon: ReceiptText, group: 'Operations' },
  { label: 'Bar Tickets & Refunds', icon: Wine, group: 'Operations' },
  { label: 'Bar Menu & Recipes', icon: Wine, group: 'Operations' },
  { label: 'Tables & KOT', icon: ClipboardCheck, group: 'Operations' },
  { label: 'Inventory Control', icon: Boxes, group: 'Operations' },
  { label: 'Organisation & Team', icon: Users, group: 'Administration' },
  { label: 'Products', icon: Package, group: 'Operations' },
  { label: 'Inventory', icon: Boxes, group: 'Operations' },
  { label: 'Procurement', icon: Truck, group: 'Operations' },
  { label: 'Offline & Devices', icon: Activity, group: 'Operations' },
  { label: 'Offline Reconciliation', icon: ClipboardCheck, group: 'Operations' },
  { label: 'Brands', icon: Building2, group: 'Ecosystem' },
  { label: 'Distributors', icon: Truck, group: 'Ecosystem' },
  { label: 'Trade Partners', icon: Users, group: 'Ecosystem' },
  { label: 'Reports', icon: BarChart3, group: 'Insights' },
  { label: 'Compliance', icon: ShieldCheck, group: 'Administration' },
  { label: 'Tax & Pricing', icon: ReceiptText, group: 'Administration' },
  { label: 'Finance & Accounting', icon: BarChart3, group: 'Administration' },
  { label: 'Settings', icon: Settings, group: 'Administration' }
];

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const navigationPermissions: Record<string, string[]> = {
  'Retail POS': ['retail:billing', 'retail:sell', 'retail:manage'],
  'Bar POS': ['bar:billing', 'bar:sell', 'bar:manage'],
  'Shift Management': ['shift:read', 'shift:manage'],
  'Sales & Refunds': ['retail:read', 'retail:billing', 'retail:refund'],
  'Bar Tickets & Refunds': ['bar:read', 'bar:billing', 'bar:refund'],
  'Bar Menu & Recipes': ['catalogue:read', 'catalogue:manage'],
  'Tables & KOT': ['bar:read', 'bar:sell', 'bar:manage'],
  'Inventory Control': ['inventory:read', 'inventory:manage', 'inventory:adjust'],
  'Organisation & Team': ['organisation:read', 'organisation:manage', 'user:read', 'user:manage'],
  'Products': ['catalogue:read', 'catalogue:manage'],
  'Inventory': ['inventory:read', 'inventory:manage'],
  'Procurement': ['procurement:read', 'procurement:manage'],
  'Offline & Devices': ['device:read', 'device:manage'],
  'Offline Reconciliation': ['offline:read', 'offline:review', 'offline:manage', 'offline:ledger-read'],
  'Brands': ['brand:read', 'brand:manage'],
  'Distributors': ['distributor:read', 'distributor:manage', 'distribution:manage'],
  'Trade Partners': ['trade:read', 'trade:manage', 'trade:visit'],
  'Reports': ['reports:read', 'analytics:read', 'brand:analytics:read'],
  'Compliance': ['excise:read', 'excise:evaluate', 'licence:read', 'licence:manage'],
  'Tax & Pricing': ['tax:read', 'tax:manage-prices', 'tax:manage-products'],
  'Finance & Accounting': ['finance:read', 'finance:view', 'finance:manage'],
  'Settings': ['platform:manage', 'organisation:manage', 'user:manage', 'ops:manage']
};

type AuthUser = { userId?: string; email: string; displayName: string; isPlatformAdmin?: boolean; organisationId?: string | null; roleCode?: string | null; permissions?: string[] };
function canAccess(label: string, user: AuthUser): boolean {
  if (label === 'Overview') return true;
  const required = navigationPermissions[label] ?? [];
  const granted = new Set(user.permissions ?? []);
  return required.some((permission) => granted.has(permission));
}


function App() {
  const [active, setActive] = useState('Overview');
  const [apiStatus, setApiStatus] = useState('Checking');
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('acp_access_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/health/live`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(() => setApiStatus('Connected'))
      .catch(() => setApiStatus('Unavailable'));
  }, []);

  useEffect(() => {
    if (!token) { setAuthChecked(true); return; }
    setAuthChecked(false);
    fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired');
        const payload = await response.json();
        setUser(payload.data);
      })
      .catch(() => {
        sessionStorage.removeItem('acp_access_token');
        setToken(null);
      })
      .finally(() => setAuthChecked(true));
  }, [token]);

  const logout = async () => {
    if (token) {
      try { await fetch(`${API}/api/v1/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch { /* local logout still proceeds */ }
    }
    sessionStorage.removeItem('acp_access_token');
    setToken(null);
    setUser(null);
  };

  if (!authChecked) return <div className="auth-loading">Loading secure workspace…</div>;
  if (!token || !user) return <Login apiStatus={apiStatus} onLogin={(newToken, profile) => {
    setAuthChecked(false);
    sessionStorage.setItem('acp_access_token', newToken);
    setToken(newToken);
    setUser(profile);
  }}/>;

  const allowedNavigation = navigation.filter((item) => canAccess(item.label, user));
  const groups = [...new Set(allowedNavigation.map((item) => item.group))];
  const activeAllowed = allowedNavigation.some((item) => item.label === active);
  const setActiveAllowed = (label: string) => { if (canAccess(label, user)) setActive(label); };

  return (
    <PermissionProvider permissions={user.permissions ?? []}>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>AlcoSphere</strong><small>Commerce platform</small></div></div>
        <div className="workspace-switch"><span className="workspace-dot"/> {user.organisationId ? 'Organisation workspace' : 'Platform workspace'} <span className="chevron">⌄</span></div>
        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {allowedNavigation.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => setActiveAllowed(item.label)}>
                  <Icon size={17}/><span>{item.label}</span>
                </button>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="help-link"><CircleHelp size={17}/> Help & documentation</div><div className="user"><div className="avatar">{(user.displayName ?? 'U').slice(0,2).toUpperCase()}</div><div><strong>{user.displayName}</strong><small>{user.email}</small></div><button className="logout-icon" title="Sign out" onClick={logout}><LogOut size={16}/></button></div></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">Platform <span>/</span> {active}</div>
          <div className="top-actions"><div className="search"><Search size={15}/><span>Search modules...</span><kbd>⌘ K</kbd></div><button className="icon-button"><Bell size={18}/></button><div className="api-pill online"><span/> API {apiStatus}</div></div>
        </header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow">PLATFORM WORKSPACE</div><h1>{active === 'Overview' ? 'Business overview' : active}</h1><p>Retail operations, peg-based bar management and brand connectivity.</p></div><div className="heading-actions"><span className="api-pill online"><span/> Authenticated</span><button className="primary-button" onClick={() => setActive('Products')}>Explore product setup <ArrowUpRight size={16}/></button></div></div>
          {!activeAllowed ? (
            <div className="notice" role="alert"><LockKeyhole size={17}/><div><strong>Access restricted</strong><span>Your account does not have permission to open this workspace. Contact your organisation administrator if access is required.</span></div></div>
          ) : active === 'Retail POS' || active === 'Bar POS' ? (
            <POSWorkspace mode={active === 'Retail POS' ? 'RETAIL' : 'BAR'} token={token!}/>
          ) : active === 'Shift Management' ? (
            <ShiftWorkspace token={token!}/>
          ) : active === 'Sales & Refunds' ? (
            <RetailSalesWorkspace token={token!}/>
          ) : active === 'Bar Tickets & Refunds' ? (
            <BarTicketsWorkspace token={token!}/>
          ) : active === 'Tables & KOT' ? (
            <BarServiceWorkspace token={token!}/>
          ) : active === 'Inventory Control' ? (
            <>
              <InventoryWorkspace token={token!}/>
              <InventoryReconciliationWorkspace token={token!}/>
            </>
          ) : active === 'Organisation & Team' ? (
            <OrganisationWorkspace token={token!}/>
          ) : active === 'Procurement' ? (
            <ProcurementWorkspace token={token!}/>
          ) : active === 'Offline & Devices' ? (
            <OfflineDeviceWorkspace/>
          ) : active === 'Offline Reconciliation' ? (
            <OfflineReconciliationWorkspace token={token!}/>
          ) : active === 'Compliance' ? (
            <ExciseComplianceWorkspace token={token!}/>
          ) : active === 'Tax & Pricing' ? (
            <TaxPricingWorkspace token={token!}/>
          ) : active === 'Finance & Accounting' ? (
            <FinanceAutomationWorkspace token={token!}/>
          ) : active === 'Reports' ? (
            <ReportsWorkspace token={token!}/>
          ) : active === 'Trade Partners' || active === 'Brands' || active === 'Distributors' ? (
            <TradePortalWorkspace token={token!}/>
          ) : active === 'Products' ? (
            <CatalogueWorkspace token={token!}/>
          ) : active === 'Bar Menu & Recipes' ? (
            <BarMenuWorkspace token={token!}/>
          ) : (
            <>
          <div className="notice"><Activity size={17}/><div><strong>Foundation build — development workspace</strong><span>Authentication is enabled. Business transactions and stock operations are not yet active.</span></div></div>
          <section className="stats">
            <Stat icon={<Store/>} label="Retail outlets" value="Not configured" note="Organisation setup pending"/>
            <Stat icon={<Wine/>} label="Bar outlets" value="Not configured" note="Licence verification pending"/>
            <Stat icon={<Building2/>} label="Brands connected" value="Not configured" note="Brand portal planned"/>
            <Stat icon={<Truck/>} label="Distributors" value="Not configured" note="Distributor portal planned"/>
          </section>
          <section className="two-col">
            <div className="panel"><div className="panel-head"><div><h2>Operating models</h2><p>Outlet capability profiles — subject to licence validation</p></div><ClipboardCheck size={19}/></div><div className="mode-list">
              <Mode icon={<Store/>} title="Retail-only" desc="Packaged bottle sales, barcode billing and retail inventory."/>
              <Mode icon={<Wine/>} title="Bar-only" desc="Peg and bottle sales, open-bottle stock and shift reconciliation."/>
              <Mode icon={<Boxes/>} title="Hybrid" desc="Separate retail and on-premise workflows under approved outlet permissions."/>
            </div></div>
            <div className="panel"><div className="panel-head"><div><h2>Implementation progress</h2><p>Authentication and access foundation</p></div><span className="tag">P03</span></div><div className="progress-wrap"><div className="progress-copy"><strong>Identity foundation</strong><span>Initial auth flow</span></div><div className="progress-track"><div className="progress-fill auth-progress"/></div><div className="progress-foot"><span>Login, session and permission foundation</span><strong>Implemented scaffold</strong></div></div><div className="todo"><div><ReceiptText size={16}/> Retail and bar transaction engines <span>Planned</span></div><div><Boxes size={16}/> Inventory movement ledger <span>Planned</span></div><div><ShieldCheck size={16}/> Tenant membership enforcement <span>Foundation added</span></div></div></div>
          </section>
          <section className="panel modules"><div className="panel-head"><div><h2>Product modules</h2><p>Navigation shell for the planned platform</p></div></div><div className="module-grid">
            <Module icon={<Store/>} title="Retail operations" text="Packaged POS, purchases, stock and cash closing" status="Planned"/>
            <Module icon={<Wine/>} title="Bar operations" text="Peg measures, bottle tracking and shift controls" status="Planned"/>
            <Module icon={<Building2/>} title="Brand portal" text="Products, trade programmes and performance" status="Planned"/>
            <Module icon={<Truck/>} title="Distributor portal" text="Territories, sales execution and outlet network" status="Planned"/>
          </div></section>
            </>
          )}
          <footer>AlcoSphere Foundation · v{APP_VERSION} · Local development only</footer>
        </div>
      </main>
    </div>
    </PermissionProvider>
  );
}

function Login({ apiStatus, onLogin }: { apiStatus: string; onLogin: (token: string, user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Sign-in failed');
      onLogin(payload.data.accessToken, payload.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally { setBusy(false); }
  }

  return <div className="login-page">
    <div className="login-brand"><div className="brand-mark">A</div><div><strong>AlcoSphere</strong><small>Alcohol commerce platform</small></div></div>
    <div className="login-card">
      <div className="login-icon"><LockKeyhole size={21}/></div>
      <div className="eyebrow">SECURE WORKSPACE</div>
      <h1>Welcome back</h1><p>Sign in to manage retail, bar and brand operations.</p>
      <form onSubmit={submit}>
        <label htmlFor="login-email">Email address</label><div className="login-input"><Mail size={16}/><input id="login-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"/></div>
        <label htmlFor="login-password">Password</label><div className="login-input"><LockKeyhole size={16}/><input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"/></div>
        {error && <div className="login-error"><AlertCircle size={15}/>{error}</div>}
        <button className="login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="login-foot">API status: {apiStatus}. Initial administrator must be provisioned using the one-time bootstrap endpoint.</div>
    </div>
    <div className="login-legal">Development environment · No live transactions enabled</div>
  </div>;
}

function Stat({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}) {
  return <div className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span></div><strong>{value}</strong><small>{note}</small></div>;
}
function Mode({icon,title,desc}:{icon:React.ReactNode;title:string;desc:string}) {
  return <div className="mode-row"><span className="mode-icon">{icon}</span><div><strong>{title}</strong><p>{desc}</p></div><span className="mode-status">Profile</span></div>;
}
function Module({icon,title,text,status}:{icon:React.ReactNode;title:string;text:string;status:string}) {
  return <div className="module-card"><span className="module-icon">{icon}</span><strong>{title}</strong><p>{text}</p><span className="tag">{status}</span></div>;
}
export default App;
