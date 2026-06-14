import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────
const IconPulse = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
  </span>
);

const IconDisconnected = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400" />
  </span>
);

const IconReconnecting = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
  </span>
);

const IconSent = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconWarning = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconError = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconArrowDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
  </svg>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    sent: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: <IconSent />,
      label: 'Sent'
    },
    deferred: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: <IconWarning />,
      label: 'Deferred'
    },
    bounced: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: <IconError />,
      label: 'Bounced'
    },
    expired: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: <IconError />,
      label: 'Expired'
    }
  };

  const c = config[status] || config.deferred;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${c.bg} ${c.border} ${c.text}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, highlight }) {
  const colorMap = {
    green: {
      bg: highlight ? 'bg-gradient-to-br from-blue-500 to-blue-900' : 'bg-white',
      text: highlight ? 'text-white' : 'text-emerald-600',
      label: highlight ? 'text-white' : 'text-fg-muted',
      border: highlight ? 'border-blue-500' : 'border-border-light',
      shadow: highlight ? 'shadow-lg shadow-blue-500/20' : 'shadow-sm'
    },
    orange: {
      bg: 'bg-white',
      text: 'text-amber-600',
      label: 'text-fg-muted',
      border: 'border-border-light',
      shadow: 'shadow-sm'
    },
    red: {
      bg: 'bg-white',
      text: 'text-red-600',
      label: 'text-fg-muted',
      border: 'border-border-light',
      shadow: 'shadow-sm'
    },
    blue: {
      bg: 'bg-white',
      text: 'text-blue-600',
      label: 'text-fg-muted',
      border: 'border-border-light',
      shadow: 'shadow-sm'
    }
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-[20px] p-5 border ${c.bg} ${c.border} ${c.shadow} transition-all hover:scale-[1.02]`}>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${c.label} mb-1.5`}>{label}</div>
      <div className={`text-3xl font-extrabold tracking-tight ${c.text}`}>{value.toLocaleString()}</div>
    </div>
  );
}

// ─── Connection Status Indicator ──────────────────────────────────────────────
function ConnectionStatus({ status }) {
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
        <IconPulse />
        Live
      </div>
    );
  }
  if (status === 'reconnecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
        <IconReconnecting />
        Reconnecting…
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
      <IconDisconnected />
      Disconnected
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EventsView({ user, showToast }) {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ sent: 0, deferred: 0, bounced: 0, failed: 0 });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isDeletingEvents, setIsDeletingEvents] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState(null);

  const eventSourceRef = useRef(null);
  const feedRef = useRef(null);
  const isAdmin = user?.role === 'Admin';

  // ── SSE Connection ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('mailerToken') || '';
    if (!token) return;

    const connect = () => {
      const es = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
      eventSourceRef.current = es;

      es.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents(data.events || []);
          setStats(data.stats || { sent: 0, deferred: 0, bounced: 0, failed: 0 });
          setConnectionStatus('connected');
        } catch (err) {
          console.error('Failed to parse init event:', err);
        }
      });

      es.addEventListener('delivery', (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => {
            const next = [...prev, data.event];
            // Keep max 1000 events in UI
            if (next.length > 1000) next.shift();
            return next;
          });
          setStats(data.stats || {});
        } catch (err) {
          console.error('Failed to parse delivery event:', err);
        }
      });

      es.addEventListener('delete', (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => prev.filter((event) => event.id !== data.id));
          setStats(data.stats || {});
        } catch (err) {
          console.error('Failed to parse delete event:', err);
        }
      });

      es.addEventListener('open', () => {
        setConnectionStatus('connected');
      });

      es.addEventListener('error', () => {
        setConnectionStatus('reconnecting');
        es.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      });
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // ── API helpers ───────────────────────────────────────────────────────────
  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('mailerToken') || '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  }, []);

  const handleClearQueue = async () => {
    if (!confirm('Clear all deferred messages from the mail queue? They will NOT be retried.')) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/events/clear-queue', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ mode: 'deferred' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
      } else {
        showToast(data.message || 'Failed to clear queue', 'error');
      }
    } catch (err) {
      showToast('Network error clearing queue', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushing(true);
    try {
      const res = await fetch('/api/events/flush-queue', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
      } else {
        showToast(data.message || 'Failed to flush queue', 'error');
      }
    } catch (err) {
      showToast('Network error flushing queue', 'error');
    } finally {
      setIsFlushing(false);
    }
  };

  const handleExportFailed = () => {
    const token = localStorage.getItem('mailerToken') || '';
    const link = document.createElement('a');
    link.href = `/api/events/export-failed?token=${encodeURIComponent(token)}`;
    link.download = `failed-emails-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleDeleteAllEvents = async () => {
    if (
      !confirm(
        'Are you sure you want to delete all delivery events and tracking data from the database? This cannot be undone.'
      )
    )
      return;
    setIsDeletingEvents(true);
    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'All events deleted successfully.');
        setEvents([]);
        setStats({ sent: 0, deferred: 0, bounced: 0, failed: 0 });
      } else {
        showToast(data.message || 'Failed to delete events', 'error');
      }
    } catch (err) {
      showToast('Network error deleting events', 'error');
    } finally {
      setIsDeletingEvents(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this delivery event?')) return;
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Event deleted successfully.');
        // Optimistically remove from state
        setEvents((prev) => prev.filter((event) => event.id !== id));
      } else {
        showToast(data.message || 'Failed to delete event', 'error');
      }
    } catch (err) {
      showToast('Network error deleting event', 'error');
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredEvents = events.filter((e) => {
    if (filter !== 'all' && e.status !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (e.recipient && e.recipient.toLowerCase().includes(q)) ||
        (e.diagnostic && e.diagnostic.toLowerCase().includes(q)) ||
        (e.relay && e.relay.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const formatTime = (timestamp) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return timestamp;
    }
  };

  const formatDate = (timestamp) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const totalEvents = stats.sent + stats.deferred + stats.bounced + (stats.failed || 0);

  return (
    <div className="space-y-6 p-14">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">Delivery Events</h1>
            <ConnectionStatus status={connectionStatus} />
          </div>
          <p className="text-sm text-fg-muted font-medium">
            Real-time delivery log — monitor sent, deferred, and bounced emails.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDeleteAllEvents}
            disabled={isDeletingEvents}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            type="button"
          >
            <IconTrash />
            {isDeletingEvents ? 'Clearing…' : 'Clear All Logs'}
          </button>
          <button
            onClick={handleExportFailed}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-bold bg-[#131416] text-white hover:bg-accent-hover transition-all cursor-pointer shadow-md shadow-accent/10"
            type="button"
          >
            <IconDownload />
            Export Failed
          </button>
        </div>
      </div>

      {/* ── Stats Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sent" value={stats.sent} color="green" highlight />
        <StatCard label="Deferred" value={stats.deferred} color="green" highlight />
        <StatCard label="Bounced" value={stats.bounced} color="green" highlight />
        <StatCard label="Total Events" value={totalEvents} color="green" highlight />
      </div>

      {/* ── Filter & Search Bar ──────────────────────────────────────── */}
      <div className="bg-white rounded-[24px] border border-border-light p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: 'All' },
            { id: 'sent', label: 'Sent' },
            { id: 'deferred', label: 'Deferred' },
            { id: 'bounced', label: 'Bounced' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${filter === id
                ? 'bg-[#131416] text-white shadow-md shadow-accent/10'
                : 'bg-surface-secondary text-fg-muted hover:text-fg hover:bg-surface'
                }`}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-fg-muted">
            <IconSearch />
          </div>
          <input
            type="text"
            placeholder="Search by email, relay, or diagnostic…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium"
          />
        </div>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer border flex-shrink-0 ${autoScroll
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-surface-secondary border-border-light text-fg-muted hover:text-fg'
            }`}
          type="button"
        >
          <IconArrowDown />
          Auto-scroll {autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* ── Event Feed ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-[24px] border border-border-light shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[80px_1fr_100px_1fr_80px_1fr_40px] gap-3 px-5 py-3 bg-surface-secondary border-b border-border-light text-[11px] font-bold uppercase tracking-wider text-fg-muted hidden lg:grid">
          <div>Time</div>
          <div>Recipient</div>
          <div>Status</div>
          <div>Relay</div>
          <div>Delay</div>
          <div>Diagnostic</div>
          <div className="text-right"></div>
        </div>

        {/* Event Rows */}
        <div
          ref={feedRef}
          className="max-h-[520px] overflow-y-auto divide-y divide-border-light"
          onScroll={(e) => {
            const el = e.target;
            const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            if (!isAtBottom && autoScroll) setAutoScroll(false);
          }}
        >
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-fg-muted">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-40">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <p className="text-sm font-semibold mb-1">No delivery events yet</p>
              <p className="text-xs">Events will appear here in real-time as emails are processed through Brevo SMTP.</p>
            </div>
          ) : (
            filteredEvents.map((event, i) => (
              <div
                key={event.id || i}
                className={`group px-5 py-3 transition-all hover:bg-surface-secondary/50 cursor-pointer ${i === filteredEvents.length - 1 ? 'animate-[slideIn_0.3s_ease-out]' : ''
                  }`}
                onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
              >
                {/* Desktop row */}
                <div className="hidden lg:grid grid-cols-[80px_1fr_100px_1fr_80px_1fr_40px] gap-3 items-center">
                  <div className="text-xs font-mono text-fg-muted">
                    <div>{formatTime(event.timestamp)}</div>
                    <div className="text-[10px] opacity-60">{formatDate(event.timestamp)}</div>
                  </div>
                  <div className="text-sm font-semibold text-fg truncate">
                    <div>{event.recipient}</div>
                    {event.sender && (
                      <div className="text-[10px] text-fg-muted font-normal mt-0.5 truncate">
                        from <span className="font-mono">{event.sender}</span>
                      </div>
                    )}
                  </div>
                  <div><StatusBadge status={event.status} /></div>
                  <div className="text-xs text-fg-muted truncate font-medium">{event.relay || '—'}</div>
                  <div className="text-xs font-mono text-fg-secondary">{event.delay}s</div>
                  <div className="text-xs text-fg-muted truncate">{event.diagnostic || '—'}</div>
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-fg-muted hover:text-red-600 hover:bg-red-50 transition-all lg:opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Delete Event"
                      type="button"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                {/* Mobile row */}
                <div className="lg:hidden flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-fg truncate mr-2">{event.recipient}</div>
                        {event.sender && (
                          <div className="text-[10px] text-fg-muted font-normal mt-0.5 truncate">
                            from <span className="font-mono">{event.sender}</span>
                          </div>
                        )}
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-fg-muted">
                      <span className="font-mono">{formatTime(event.timestamp)}</span>
                      <span>·</span>
                      <span className="truncate">{event.relay || '—'}</span>
                      <span>·</span>
                      <span className="font-mono">{event.delay}s</span>
                    </div>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-fg-muted hover:text-red-600 active:bg-red-50 cursor-pointer"
                      title="Delete Event"
                      type="button"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedEvent === event.id && (
                  <div className="mt-3 p-3 bg-surface-secondary rounded-[16px] text-xs space-y-1.5">
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="font-bold text-fg-secondary">Queue ID</span>
                      <span className="font-mono text-fg">{event.queueId}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="font-bold text-fg-secondary">DSN Code</span>
                      <span className="font-mono text-fg">{event.dsn}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="font-bold text-fg-secondary">Relay</span>
                      <span className="font-mono text-fg break-all">{event.relay}</span>
                    </div>
                    {event.sender && (
                      <div className="grid grid-cols-[100px_1fr] gap-1">
                        <span className="font-bold text-fg-secondary">Sender</span>
                        <span className="font-mono text-fg">{event.sender}</span>
                      </div>
                    )}
                    {event.diagnostic && (
                      <div className="grid grid-cols-[100px_1fr] gap-1">
                        <span className="font-bold text-fg-secondary">Diagnostic</span>
                        <span className="text-fg break-all">{event.diagnostic}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {filteredEvents.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border-light bg-surface-secondary/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-fg-muted">
              Showing {filteredEvents.length} of {events.length} events
            </span>
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#131416] text-white hover:bg-accent-hover transition-all cursor-pointer"
                type="button"
              >
                <IconArrowDown />
                Jump to latest
              </button>
            )}
          </div>
        )}
      </div>

      {/* Slide-in animation keyframe */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
