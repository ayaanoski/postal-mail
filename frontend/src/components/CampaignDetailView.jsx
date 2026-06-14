import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import * as XLSX from 'xlsx';

export default function CampaignDetailView({ showToast }) {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importedEmails, setImportedEmails] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [failedPage, setFailedPage] = useState(1);
  const failedPerPage = 20;
  const fileInputRef = React.useRef(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/campaigns/${campaignId}/stats`);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    setFailedPage(1);
  }, [data?.stats?.failedRecipients]);

  const events = data?.stats?.events || [];
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.trim().toLowerCase();
    return events.filter((evt) => evt.recipient?.toLowerCase().includes(q));
  }, [events, searchQuery]);

  const handleDeleteTrackingEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this tracking event?')) return;
    try {
      const token = localStorage.getItem('mailerToken') || '';
      const res = await fetch(`/api/tracking/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Tracking event deleted successfully.');
        await loadStats();
      } else {
        showToast(resData.message || 'Failed to delete tracking event', 'error');
      }
    } catch (err) {
      showToast('Network error deleting tracking event', 'error');
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setTimeout(async () => {
        try {
          let emails = [];
          const ext = file.name.split('.').pop().toLowerCase();
          if (ext === 'csv' || ext === 'txt') {
            const text = evt.target.result;
            if (ext === 'txt') {
              const chunkSize = 50000;
              let idx = 0;
              const allMatches = [];
              const processChunk = () => {
                const chunk = text.slice(idx, idx + chunkSize);
                if (!chunk) {
                  emails = [...new Set(allMatches)];
                  setImportedEmails(emails);
                  setShowImportModal(true);
                  setIsImporting(false);
                  return;
                }
                const matches = chunk.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                if (matches) allMatches.push(...matches);
                idx += chunkSize;
                setTimeout(processChunk, 0);
              };
              processChunk();
              return;
            } else {
              const lines = text.split('\n').filter(Boolean);
              if (lines.length < 2) { showToast?.('CSV file is empty or has no data rows.', 'error'); setIsImporting(false); return; }
              const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
              const emailIdx = header.findIndex((h) => ['email', 'recipient', 'mail', 'to'].includes(h));
              if (emailIdx === -1) { showToast?.('No email/recipient column found in CSV.', 'error'); setIsImporting(false); return; }
              const chunkSize = 5000;
              let lineIdx = 1;
              const allEmails = [];
              const processChunk = () => {
                const end = Math.min(lineIdx + chunkSize, lines.length);
                for (let i = lineIdx; i < end; i++) {
                  const vals = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
                  if (vals[emailIdx] && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals[emailIdx])) {
                    allEmails.push(vals[emailIdx]);
                  }
                }
                lineIdx = end;
                if (lineIdx >= lines.length) {
                  emails = [...new Set(allEmails)];
                  setImportedEmails(emails);
                  setShowImportModal(true);
                  setIsImporting(false);
                  return;
                }
                setTimeout(processChunk, 0);
              };
              processChunk();
              return;
            }
          } else {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            if (json.length === 0) { showToast?.('XLSX file has no data rows.', 'error'); setIsImporting(false); return; }
            const headerKeys = Object.keys(json[0]);
            const emailKey = headerKeys.find((k) => ['email', 'recipient', 'mail', 'to', 'Email', 'Recipient', 'Mail', 'To'].includes(k));
            if (!emailKey) { showToast?.('No email/recipient column found in XLSX.', 'error'); setIsImporting(false); return; }
            const chunkSize = 5000;
            let rowIdx = 0;
            const allEmails = [];
            const processChunk = () => {
              const end = Math.min(rowIdx + chunkSize, json.length);
              for (let i = rowIdx; i < end; i++) {
                const val = ('' + json[i][emailKey]).trim();
                if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                  allEmails.push(val);
                }
              }
              rowIdx = end;
              if (rowIdx >= json.length) {
                emails = [...new Set(allEmails)];
                setImportedEmails(emails);
                setShowImportModal(true);
                setIsImporting(false);
                return;
              }
              setTimeout(processChunk, 0);
            };
            processChunk();
            return;
          }
          emails = [...new Set(emails)];
          if (emails.length === 0) { showToast?.('No valid email addresses found in the file.', 'error'); setIsImporting(false); return; }
          setImportedEmails(emails);
          setShowImportModal(true);
          setIsImporting(false);
        } catch (err) {
          showToast?.('Failed to parse file: ' + err.message, 'error');
          setIsImporting(false);
        }
      }, 50);
    };
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const handleDeleteCampaign = async () => {
    if (!confirm('Are you sure you want to delete this campaign? This will permanently remove the campaign and all its tracking events from the database.')) return;
    try {
      const token = localStorage.getItem('mailerToken') || '';
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Campaign deleted successfully.');
        navigate('/');
      } else {
        showToast(resData.message || 'Failed to delete campaign', 'error');
      }
    } catch (err) {
      showToast('Network error deleting campaign', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin text-[#131416]"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <span className="text-xs font-bold text-fg-muted uppercase tracking-widest">Loading Analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-red-200 rounded-[24px] p-8 max-w-lg mx-auto text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <h3 className="text-base font-bold text-fg mb-1">Failed to Load Campaign Analytics</h3>
        <p className="text-xs text-fg-muted mb-6 leading-relaxed">{error || 'Unable to retrieve tracking data'}</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center justify-center h-10 px-5 bg-[#131416] text-xs font-bold text-white rounded-full hover:bg-accent-hover transition-all cursor-pointer shadow-sm active:scale-98"
          type="button"
        >
          Go Back to Overview
        </button>
      </div>
    );
  }

  const { campaign, stats } = data;

  const totalOpens = stats.totalOpens || 0;
  const uniqueOpens = stats.uniqueOpens || 0;
  const totalClicks = stats.totalClicks || 0;
  const uniqueClicks = stats.uniqueClicks || 0;
  const totalRecipients = stats.totalRecipients || 1;

  // Percentage calculations
  const openPercent = Math.min(Math.round((uniqueOpens / totalRecipients) * 100), 100);
  const clickPercent = Math.min(Math.round((uniqueClicks / totalRecipients) * 100), 100);
  const ctrPercent = uniqueOpens > 0 ? Math.min(Math.round((uniqueClicks / uniqueOpens) * 100), 100) : 0;

  // Failed recipients pagination
  const totalFailedPages = stats.failedRecipients ? Math.max(1, Math.ceil(stats.failedRecipients.length / failedPerPage)) : 1;
  const paginatedFailed = stats.failedRecipients
    ? stats.failedRecipients.slice((failedPage - 1) * failedPerPage, failedPage * failedPerPage)
    : [];


  const handleExportXlsx = () => {
    const rows = filteredEvents.map((evt) => ({
      Recipient: evt.recipient,
      Type: evt.type,
      URL: evt.url || '',
      Timestamp: new Date(evt.timestamp).toLocaleString()
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Tracking Events');
    XLSX.writeFile(wb, `${campaign.name || 'campaign'}_tracking.xlsx`);
    showToast?.('Tracking events exported.');
  };

  const statusStyles = {
    'Draft': 'bg-surface-secondary text-fg-muted border-border-light',
    'Running': 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse',
    'Completed': 'bg-green-50 text-green-700 border-green-100'
  };

  return (
    <div className="flex flex-col gap-6 pb-12 p-14">
      {/* Header section */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-border-light text-fg hover:text-accent hover:border-accent/30 transition-all cursor-pointer shadow-sm"
          type="button"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-fg font-sans leading-none">{campaign.name}</h1>
          <p className="text-xs text-fg-muted mt-1.5 font-medium">Subject: <span className="font-semibold text-fg-secondary">"{campaign.subject}"</span></p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-3.5 py-1.5 border rounded-full ${statusStyles[campaign.status] || 'bg-surface-secondary text-fg'}`}>
            {campaign.status}
          </span>
          <button
            onClick={loadStats}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-border-light text-fg hover:bg-surface-secondary transition-all cursor-pointer shadow-sm"
            type="button"
            title="Refresh statistics"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
          </button>
          <button
            onClick={handleDeleteCampaign}
            className="h-10 px-4 flex items-center justify-center bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm"
            type="button"
            title="Delete Campaign"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Grid: Delivery Progress & Engagement rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Recipients */}
        <div className="bg-white border border-border-light rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Recipients</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-fg">{stats.totalRecipients}</span>
            <span className="text-xs text-fg-muted">total</span>
          </div>
          <div className="mt-4 flex gap-4 text-xs font-semibold text-fg-secondary border-t border-border-light/60 pt-3">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#131416]" />{stats.sent} sent</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />{stats.failed} failed</span>
          </div>
        </div>

        {/* Unique Opens */}
        <div className="bg-white border border-border-light rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Opens</span>
            <span className="text-xs font-bold text-fg-secondary bg-purple-50 px-2 py-0.5 rounded-full">{stats.openRate}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-fg">{uniqueOpens}</span>
            <span className="text-xs text-fg-muted">unique ({totalOpens} total)</span>
          </div>
          <div className="mt-4 border-t border-border-light/60 pt-3">
            <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: `${openPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Unique Clicks */}
        <div className="bg-white border border-border-light rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Clicks</span>
            <span className="text-xs font-bold text-fg-secondary bg-blue-50 px-2 py-0.5 rounded-full">{stats.clickRate}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-fg">{uniqueClicks}</span>
            <span className="text-xs text-fg-muted">unique ({totalClicks} total)</span>
          </div>
          <div className="mt-4 border-t border-border-light/60 pt-3">
            <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${clickPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Click-Through Rate (CTR) */}
        <div className="bg-white border border-border-light rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">CTR (Click-Through Rate)</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-fg">{stats.clickThroughRate}</span>
            <span className="text-xs text-fg-muted">clicks per open</span>
          </div>
          <div className="mt-4 border-t border-border-light/60 pt-3">
            <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
              <div className="h-full bg-[#16a34a] rounded-full" style={{ width: `${ctrPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Click-Through Details (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white border border-border-light rounded-[24px] p-6 md:p-8 shadow-sm flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-extrabold text-fg uppercase tracking-wider">Link Click Tracking</h3>
              <p className="text-[11px] text-fg-muted mt-0.5">Performance of URLs embedded in your email HTML</p>
            </div>

            {stats.urlStats.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl bg-surface-secondary/20">
                <p className="text-xs text-fg-muted italic">No link click events recorded for this campaign.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.urlStats.map((urlStat, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-4 rounded-xl border border-border-light bg-surface-secondary/25">
                    <div className="flex items-center justify-between gap-4">
                      <code className="text-xs font-mono text-fg break-all font-semibold truncate flex-1" title={urlStat.url}>
                        {urlStat.url}
                      </code>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs font-bold">
                        <span className="text-fg">{urlStat.total} clicks</span>
                        <span className="text-fg-muted font-medium">({urlStat.unique} unique)</span>
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full h-1 bg-border-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(Math.round((urlStat.unique / totalRecipients) * 100), 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Real-Time Events Feed (1/3 width) */}
        <div className="bg-white border border-border-light rounded-[24px] p-6 md:p-8 shadow-sm flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-fg uppercase tracking-wider">Tracking Timeline</h3>
                <p className="text-[11px] text-fg-muted mt-0.5">Real-time open & click events stream</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center bg-surface-secondary rounded-full px-3 h-8 text-fg-muted border border-border-light">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-2 flex-shrink-0"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-[11px] text-fg placeholder:text-fg-muted w-28 font-medium"
                  />
                </div>
                {events.length > 0 && (
                  <button
                    onClick={handleExportXlsx}
                    className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold rounded-full bg-[#131416] text-white hover:bg-accent-hover transition-all cursor-pointer"
                    type="button"
                    title="Export to XLSX"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 17 12 23 18 17" /><polyline points="6 1 12 7 18 1" /></svg>
                    Export
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl bg-surface-secondary/20 flex-1 flex items-center justify-center">
              <p className="text-xs text-fg-muted italic">
                {searchQuery ? 'No events match your search.' : 'Waiting for tracking events...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[420px] pr-1">
              {filteredEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="group flex justify-between items-center gap-3 text-xs border-b border-border-light/40 pb-3 last:border-0 last:pb-0">
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${evt.type === 'open' ? 'bg-purple-50 text-purple-600' :
                        evt.type === 'unsubscribe' ? 'bg-red-50 text-red-600' :
                          'bg-blue-50 text-blue-600'
                      }`}>
                      {evt.type === 'open' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      ) : evt.type === 'unsubscribe' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-fg truncate">{evt.recipient}</p>
                      <p className="text-[10px] text-fg-muted mt-0.5 truncate">
                        {evt.type === 'open' ? 'Opened the email' :
                          evt.type === 'unsubscribe' ? 'Unsubscribed from campaign' :
                            `Clicked link: ${evt.url}`}
                      </p>
                      <p className="text-[9px] text-fg-muted mt-1 uppercase tracking-wider font-bold">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrackingEvent(evt.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-fg-muted hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      title="Delete Tracking Event"
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Failed Deliveries Section */}
      {stats.failedRecipients && stats.failedRecipients.length > 0 && (
        <div className="bg-white border border-red-100 rounded-[24px] p-6 md:p-8 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-fg uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Failed Deliveries
              </h3>
              <p className="text-[11px] text-fg-muted mt-0.5">{stats.failedRecipients.length} recipient(s) with delivery errors</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 h-8 text-[11px] font-bold rounded-full bg-white border border-border-light text-fg-secondary hover:bg-surface-secondary transition-all cursor-pointer"
                type="button"
                title="Import XLSX or CSV to extract email addresses"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                Import
              </button>
              <div className="relative group">
                <button
                  className="flex items-center gap-1.5 px-3.5 h-8 text-[11px] font-bold rounded-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-all cursor-pointer"
                  type="button"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 17 12 23 18 17" /><polyline points="6 1 12 7 18 1" /></svg>
                  Export
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-border-light rounded-xl shadow-lg z-10 min-w-[140px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                    <button
                      onClick={() => {
                        const rows = stats.failedRecipients.map((fr) => ({
                          Recipient: fr.email,
                          Status: fr.status,
                          Reason: fr.reason,
                          Timestamp: new Date(fr.timestamp).toLocaleString()
                        }));
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.json_to_sheet(rows);
                        XLSX.utils.book_append_sheet(wb, ws, 'Failed Deliveries');
                        XLSX.writeFile(wb, `${campaign.name || 'campaign'}_failed.xlsx`);
                        showToast?.('Failed deliveries exported as XLSX.');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-fg hover:bg-surface-secondary w-full text-left rounded-t-xl transition-all cursor-pointer"
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>
                      Export as XLSX
                    </button>
                    <button
                      onClick={() => {
                        const header = 'Recipient,Status,Reason,Timestamp';
                        const rows = stats.failedRecipients.map((fr) => {
                          const reason = `"${(fr.reason || '').replace(/"/g, '""')}"`;
                          return `${fr.email},${fr.status},${reason},${new Date(fr.timestamp).toLocaleString()}`;
                        });
                        const csv = [header, ...rows].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${campaign.name || 'campaign'}_failed.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast?.('Failed deliveries exported as CSV.');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-fg hover:bg-surface-secondary w-full text-left rounded-b-xl transition-all cursor-pointer"
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                      Export as CSV
                    </button>
                  </div>
              </div>
            </div>
          </div>
          <div className="border border-red-100 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="bg-red-50/50 border-b border-red-100 text-[10px] font-bold text-red-700 uppercase tracking-wider">
                  <th scope="col" className="text-left px-5 py-3.5">Recipient</th>
                  <th scope="col" className="text-left px-5 py-3.5">Status</th>
                  <th scope="col" className="text-left px-5 py-3.5">Reason</th>
                  <th scope="col" className="text-right px-5 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {paginatedFailed.map((fr, idx) => (
                  <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-fg">{fr.email}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        fr.status === 'bounced'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          fr.status === 'bounced' ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        {fr.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-fg-secondary font-medium max-w-[400px] truncate" title={fr.reason}>
                      {fr.reason}
                    </td>
                    <td className="px-5 py-4 text-right text-fg-muted text-[10px] font-semibold whitespace-nowrap">
                      {new Date(fr.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalFailedPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-semibold text-fg-muted">
                Showing {(failedPage - 1) * failedPerPage + 1}&ndash;{Math.min(failedPage * failedPerPage, stats.failedRecipients.length)} of {stats.failedRecipients.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFailedPage((p) => Math.max(1, p - 1))}
                  disabled={failedPage <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-bold bg-white border border-border-light hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  type="button"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className="text-[10px] font-bold text-fg-muted px-1.5 tabular-nums">
                  {failedPage} / {totalFailedPages}
                </span>
                <button
                  onClick={() => setFailedPage((p) => Math.min(totalFailedPages, p + 1))}
                  disabled={failedPage >= totalFailedPages}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-bold bg-white border border-border-light hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  type="button"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
          </div>
        </div>
      )}
        </div>
      )}

      {showImportModal && importedEmails.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border-light">
              <div>
                <h3 className="text-base font-extrabold text-fg">Imported Emails</h3>
                <p className="text-xs text-fg-muted mt-0.5">{importedEmails.length.toLocaleString()} recipient(s) &middot; ready to send</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary transition-all cursor-pointer" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 p-6">
              <textarea
                readOnly
                value={importedEmails.join('\n')}
                className="w-full h-full resize-none text-xs text-fg font-mono bg-surface-secondary/50 border border-border-light rounded-xl p-4 outline-none focus:ring-1 focus:ring-blue-200"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-6 pt-4 border-t border-border-light">
              <button onClick={() => setShowImportModal(false)} className="h-9 px-5 text-xs font-bold rounded-full bg-white border border-border-light text-fg-secondary hover:bg-surface-secondary transition-all cursor-pointer" type="button">Close</button>
              <button onClick={() => { setShowImportModal(false); navigate('/compose', { state: { importedEmails } }); }} className="h-9 px-5 text-xs font-bold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer shadow-sm flex items-center gap-1.5" type="button">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Compose Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {isImporting && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin text-blue-600"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <span className="text-xs font-bold text-blue-700">Importing emails from file...</span>
        </div>
      )}
    </div>
  );
}
