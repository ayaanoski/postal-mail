import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ServerLinear,
  Logout3Linear,
} from '@solar-icons/react-perf';

export default function Sidebar({
  searchQuery,
  setSearchQuery,
  domains,
  user,
  onLogout,
  showToast,
  sidebarOpen,
  onCloseSidebar
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeView = location.pathname === '/'
    ? 'overview'
    : location.pathname.startsWith('/campaigns')
      ? 'campaigns'
    : location.pathname.startsWith('/domains')
      ? 'domains'
      : location.pathname.startsWith('/compose')
        ? 'compose'
        : location.pathname.startsWith('/events')
          ? 'events'
          : location.pathname.startsWith('/employees')
            ? 'employees'
            : location.pathname.startsWith('/rules')
              ? 'rules'
              : location.pathname.startsWith('/settings')
                ? 'settings'
                : 'overview';

  const activeDomainId = location.pathname.startsWith('/domains/')
    ? location.pathname.split('/')[2]
    : null;

  const handleNavClick = (view) => {
    const path = view === 'overview' ? '/' : `/${view}`;
    navigate(path);
    onCloseSidebar();
  };

  const handleDomainClick = (domain) => {
    navigate(`/domains/${domain._id}`);
    onCloseSidebar();
  };

  const domainItems = domains && domains.length > 0
    ? domains
    : [];

  const userInitial = user && user.name ? user.name.charAt(0).toUpperCase() : 'U';

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetch('/api/users/pending', {
        headers: { Authorization: `Bearer ${localStorage.getItem('mailerToken') || ''}` }
      })
        .then(r => r.json())
        .then(data => setPendingCount(data.users?.length || 0))
        .catch(() => { });
    }
  }, [user]);

  // Main menu items
  const mainMenuNav = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 2 15 22 11 13 2 9 22 2" />
          <line x1="11" y1="13" x2="22" y2="2" />
        </svg>
      )
    },
    {
      id: 'domains',
      label: 'Your Domains',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M2 12h20"></path>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      )
    },
    {
      id: 'events',
      label: 'Live Logs',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5h18v14H3z" />
          <path d="M3 9h18" />
          <path d="M8 5v4" />
        </svg>
      )
    },
    {
      id: 'template',
      label: 'Email Templates',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      )
    },

  ];

  // Preferences items
  const preferencesNav = [
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    }
  ];

  if (user?.role === 'Admin') {
    preferencesNav.push({
      id: 'employees',
      label: 'Employees',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      badge: pendingCount > 0 ? pendingCount : null
    });
  }

  return (
    <aside className={`fixed lg:sticky top-0 left-0 z-30 w-[260px] h-screen bg-[#1e1e1f] flex flex-col flex-shrink-0 border-r border-neutral-800/40 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-20 flex-shrink-0">
        {/* Custom premium logo in reference to TrafficTrace: cyan/blue circle with graph and magnifying glass handle */}
        <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="flex-shrink-0">
            <circle cx="14" cy="14" r="12" fill="#2563eb" />
            <path d="M9 17L12 14L15 16L19 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="19" cy="11" r="2" fill="white" />
            <path d="M17 9L19 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-white font-sans select-none">Mailer</span>
        <button
          onClick={onCloseSidebar}
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all lg:hidden cursor-pointer"
          type="button"
          aria-label="Close menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1.5 scrollbar-thin">
        {/* Main Menu Section */}
        <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-4 mt-2 mb-2 block">
          Main menu
        </div>
        <div className="flex flex-col gap-1">
          {mainMenuNav.map(({ id, label, icon, badge }) => {
            const isActive = activeView === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-left w-full text-[13.5px] font-medium cursor-pointer ${isActive
                  ? 'bg-[#2b2b2d] text-white font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                  }`}
                type="button"
              >
                <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-white'}`}>
                  {icon}
                </span>
                <span className="flex-1">{label}</span>
                {badge != null && badge > 0 && (
                  <span className="text-[11px] font-bold bg-[#ff8243] text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 leading-none">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Preferences Section */}
        <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-4 mt-6 mb-2 block">
          Preferences
        </div>
        <div className="flex flex-col gap-1">
          {preferencesNav.map(({ id, label, icon, badge }) => {
            const isActive = activeView === id;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-left w-full text-[13.5px] font-medium cursor-pointer ${isActive
                  ? 'bg-[#2b2b2d] text-white font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                  }`}
                type="button"
              >
                <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-white'}`}>
                  {icon}
                </span>
                <span className="flex-1">{label}</span>
                {badge != null && badge > 0 && (
                  <span className="text-[11px] font-bold bg-[#ff8243] text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 leading-none">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>


      </nav>



      {/* User Information & Logout */}
      <div className="border-t border-neutral-800/60 p-4 flex items-center gap-3 bg-neutral-900/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-inner">
          {userInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{user ? user.name : 'Not signed in'}</div>
          <div className="text-[11px] text-neutral-400 truncate font-medium">{user ? `${user.email}` : 'Authenticate'}</div>
        </div>
        <button
          onClick={onLogout}
          className="text-neutral-400 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-full transition-all flex-shrink-0 cursor-pointer"
          type="button"
          title="Log out"
        >
          <Logout3Linear size={18} />
        </button>
      </div>
    </aside>
  );
}
