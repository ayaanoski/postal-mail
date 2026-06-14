import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import DomainsView from './components/DomainsView';
import DomainDetailView from './components/DomainDetailView';
import ComposeView from './components/ComposeView';
import EventsView from './components/EventsView';
import CampaignDetailView from './components/CampaignDetailView';
import SeedsView from './components/SeedsView';
import EmployeeView from './components/EmployeeView';
import EmployeeDetailView from './components/EmployeeDetailView';
import RulesView from './components/RulesView';
import SettingsView from './components/SettingsView';
import {
  apiFetch,
  getLocalSession,
  saveSession,
  deleteLocalSession,
  setLogoutCallback
} from './utils/api';

function AppContent() {
  const [session, setSession] = useState(getLocalSession());
  const [searchQuery, setSearchQuery] = useState('');
  const [domains, setDomains] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overviewStats, setOverviewStats] = useState(null);

  const [authTab, setAuthTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const [toast, setToast] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setLogoutCallback(() => {
      setSession({ token: '', user: null });
      showToast('Session expired. Please log in again.', 'error');
      navigate('/login');
    });
  }, [navigate]);

  const loadDomains = async () => {
    try {
      const res = await apiFetch('/domains');
      setDomains(res.domains || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await apiFetch('/campaigns');
      setCampaigns(res.campaigns || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const loadOverviewStats = async () => {
    try {
      const res = await apiFetch('/stats/overview');
      setOverviewStats(res);
    } catch {
      // Fail silently
    }
  };

  const loadDashboard = () => {
    loadDomains();
    loadCampaigns();
    loadOverviewStats();
  };

  useEffect(() => {
    if (session.token) {
      loadDashboard();
    } else {
      setDomains([]);
      setCampaigns([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      saveSession(res.token, res.user);
      setSession({ token: res.token, user: res.user });
      setLoginEmail('');
      setLoginPassword('');
      showToast('Logged in successfully.');
      navigate('/');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword
        })
      });

      if (res.token) {
        saveSession(res.token, res.user);
        setSession({ token: res.token, user: res.user });
        showToast('Account created successfully.');
        navigate('/');
      } else {
        showToast('Account created! Please wait for admin approval.', 'pending');
        setAuthTab('login');
      }

      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    deleteLocalSession();
    setSession({ token: '', user: null });
    showToast('Logged out successfully.');
    navigate('/login');
  };

  const handleAddDomain = async (domainData) => {
    try {
      await apiFetch('/domains', {
        method: 'POST',
        body: JSON.stringify(domainData)
      });
      showToast('Sending domain added.');
      loadDomains();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleImportBrevo = async (apiKey) => {
    try {
      const res = await apiFetch('/domains/import-brevo', {
        method: 'POST',
        body: JSON.stringify({ apiKey })
      });
      showToast(res.message || 'Domains imported from Brevo.');
      loadDomains();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleImportSparkpost = async (apiKey) => {
    try {
      const res = await apiFetch('/domains/import-sparkpost', {
        method: 'POST',
        body: JSON.stringify({ apiKey })
      });
      showToast(res.message || 'Domains imported from SparkPost.');
      loadDomains();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleImportVps = async ({ serverUrl, apiKey }) => {
    try {
      const res = await apiFetch('/domains/import-vps', {
        method: 'POST',
        body: JSON.stringify({ serverUrl, apiKey })
      });
      showToast(res.message || `Domains imported from VPS Postal server.`);
      if (res.errors && res.errors.length > 0) {
        console.warn('VPS import errors:', res.errors);
      }
      loadDomains();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteDomain = async (domainId) => {
    try {
      await apiFetch(`/domains/${domainId}`, {
        method: 'DELETE'
      });
      showToast('Sending domain deleted.');
      loadDomains();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleSaveCampaign = async (campaignData) => {
    try {
      await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData)
      });
      showToast('Campaign draft saved.');
      loadDashboard();
      navigate('/');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleLaunchCampaign = async (campaignId) => {
    try {
      const res = await apiFetch(`/campaigns/${campaignId}/launch`, {
        method: 'POST'
      });
      showToast(`${res.message}. ${res.queuedJobs} email job(s) queued.`);
      loadCampaigns();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const isSignedIn = Boolean(session.token && session.user);

  if (!isSignedIn) {
    return (
      <div className="min-h-screen grid place-items-center bg-surface p-4 sm:p-6 font-sans">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] max-w-[960px] w-full rounded-[32px] overflow-hidden bg-white shadow-xl border border-border-light">
          {/* Left panel (Charcoal with lime highlights) */}
          <article className="bg-[#131416] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center gap-2.5 mb-8">
                <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                  <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="transform rotate-12">
                    <circle cx="17" cy="17" r="15" fill="#ffffff" />
                    <path d="M17 17 L17 2 A 15 15 0 0 1 32 17 Z" fill="#c4f772" />
                  </svg>
                </div>
                <span className="text-xl font-bold tracking-tight text-white">Mailer</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 leading-tight font-sans">
                Self-Hosted Campaign Delivery.
              </h2>
              <p className="text-sm text-fg-muted leading-relaxed mb-8 max-w-sm font-semibold">
                Configure verified domains, rotate rotating senders, and monitor status dashboards from one place.
              </p>

              <div className="flex flex-col gap-3.5">
                {[
                  'Multi-domain rotate routing key protection',
                  'High-density BullMQ asynchronous job control',
                  'Live status analytics and visual indicators'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-xs font-bold text-fg-muted">
                    <div className="w-5 h-5 rounded-full bg-brand-lime flex items-center justify-center text-[#131416] flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mt-10">Trusted by Operations Teams</p>
          </article>

          {/* Right panel (White with clean forms) */}
          <article className="p-8 sm:p-12 flex flex-col justify-center bg-white">
            <div className="flex bg-surface-secondary rounded-full p-1 w-fit mb-8 border border-border-light">
              <button
                onClick={() => setAuthTab('login')}
                className={`px-6 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${authTab === 'login'
                  ? 'bg-[#131416] text-white shadow-md shadow-accent/10'
                  : 'text-fg-muted hover:text-fg'
                  }`}
                type="button"
              >
                Log In
              </button>
              <button
                onClick={() => setAuthTab('register')}
                className={`px-6 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${authTab === 'register'
                  ? 'bg-[#131416] text-white shadow-md shadow-accent/10'
                  : 'text-fg-muted hover:text-fg'
                  }`}
                type="button"
              >
                Register
              </button>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Email Address</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isAuthSubmitting}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Password</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isAuthSubmitting}
                    required
                  />
                </label>

                <button
                  className="w-full inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10 mt-3"
                  type="submit"
                  disabled={isAuthSubmitting}
                >
                  {isAuthSubmitting ? 'Logging in...' : 'Log In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Full Name</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    type="text"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={isAuthSubmitting}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Email Address</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={isAuthSubmitting}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Password</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    minLength={6}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={isAuthSubmitting}
                    required
                  />
                </label>

                <button
                  className="w-full inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10 mt-3"
                  type="submit"
                  disabled={isAuthSubmitting}
                >
                  {isAuthSubmitting ? 'Registering...' : 'Create Account'}
                </button>
                <p className="text-[10px] font-bold text-fg-muted text-center mt-2.5 uppercase tracking-wider">First registered user is configured as Admin.</p>
              </form>
            )}
          </article>
        </div>

        <Routes>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>

        {toast && (
          <ToastNotification toast={toast} />
        )}
      </div>
    );
  }

  // Determine activeView for navigation state in sidebar/FAB
  const activeView = location.pathname === '/'
    ? 'overview'
    : location.pathname.startsWith('/domains')
      ? 'domains'
      : location.pathname.startsWith('/compose')
        ? 'compose'
        : location.pathname.startsWith('/events')
          ? 'events'
          : location.pathname.startsWith('/seeds')
            ? 'seeds'
            : location.pathname.startsWith('/employees')
              ? 'employees'
              : location.pathname.startsWith('/rules')
                ? 'rules'
                : location.pathname.startsWith('/settings')
                  ? 'settings'
                  : 'overview';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-200  via-white to-white flex font-sans">
      <Sidebar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        domains={domains}
        user={session.user}
        onLogout={handleLogout}
        showToast={showToast}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <header className="h-16 border-b border-border-light bg-white flex items-center gap-3 px-5 lg:hidden flex-shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-fg-secondary hover:text-fg hover:bg-surface-secondary transition-all cursor-pointer"
            type="button"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 34 34" fill="none" className="transform rotate-12 flex-shrink-0">
              <circle cx="17" cy="17" r="15" fill="#131416" />
              <path d="M17 17 L17 2 A 15 15 0 0 1 32 17 Z" fill="#c4f772" />
            </svg>
            <span className="text-base font-extrabold tracking-tight text-fg">Mailer</span>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 lg:p-0">
          <div className=" mx-auto">
            <Routes>
              <Route
                path="/"
                element={
                  <DashboardView
                    campaigns={campaigns}
                    domains={domains}
                    onRefresh={loadDashboard}
                    onLaunch={handleLaunchCampaign}
                    searchQuery={searchQuery}
                    overviewStats={overviewStats}
                    showToast={showToast}
                    user={session.user}
                  />
                }
              />
              <Route
                path="/domains"
                element={
                  <DomainsView
                    domains={domains}
                    onRefresh={loadDomains}
                    onAddDomain={handleAddDomain}
                    onImportBrevo={handleImportBrevo}
                    onImportSparkpost={handleImportSparkpost}
                    onImportVps={handleImportVps}
                    onDeleteDomain={handleDeleteDomain}
                    user={session.user}
                  />
                }
              />
              <Route
                path="/domains/:id"
                element={
                  <DomainDetailView
                    onRefresh={loadDomains}
                    onDeleteDomain={handleDeleteDomain}
                  />
                }
              />
              <Route
                path="/compose"
                element={
                  <ComposeView
                    domains={domains}
                    onSaveCampaign={handleSaveCampaign}
                  />
                }
              />
              <Route
                path="/events"
                element={
                  <EventsView
                    user={session.user}
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/seeds"
                element={
                  <SeedsView
                    user={session.user}
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/employees"
                element={
                  <EmployeeView
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/employees/:id"
                element={
                  <EmployeeDetailView
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/rules"
                element={
                  <RulesView
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <SettingsView
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/campaigns/:id"
                element={
                  <CampaignDetailView
                    showToast={showToast}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      {activeView !== 'compose' && (
        <button
          onClick={() => navigate('/compose')}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#131416] hover:bg-accent-hover text-white shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer border border-[#ffffff]/10"
          type="button"
          aria-label="Compose Campaign"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {toast && (
        <ToastNotification toast={toast} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function ToastNotification({ toast }) {
  const isError = toast.type === 'error';
  const isPending = toast.type === 'pending';
  return (
    <div
      className={`fixed right-6 bottom-6 flex items-center gap-3 px-5 py-3 rounded-full shadow-lg text-xs font-bold z-50 border transition-all ${isError
        ? 'bg-red-50 text-red-700 border-red-200'
        : isPending
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-[#131416] text-white border-[#ffffff]/10 shadow-accent/10'
        }`}
      role="status"
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isError ? 'bg-red-500' : isPending ? 'bg-amber-400' : 'bg-brand-lime'}`} />
      <span>{toast.message}</span>
    </div>
  );
}
