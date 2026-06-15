import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function DashboardView({
  campaigns,
  domains = [],
  onRefresh,
  onLaunch,
  searchQuery,
  overviewStats,
  showToast,
  user
}) {
  const navigate = useNavigate();
  const [layoutMode, setLayoutMode] = useState('kanban');
  const [localSearch, setLocalSearch] = useState('');
  const [completedPage, setCompletedPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);
  const perPage = 10;

  // Sub-navigation tab: 'dashboard', 'leads', 'analytics', 'senders'
  const [activeSubTab, setActiveSubTab] = useState('dashboard');
  const [sentTimeframe, setSentTimeframe] = useState('month');

  const getRecipientStats = (campaign) =>
    campaign.recipients.reduce(
      (stats, recipient) => {
        if (stats[recipient.status] !== undefined) {
          stats[recipient.status] += 1;
        }
        return stats;
      },
      { pending: 0, sent: 0, failed: 0 }
    );

  const summary = campaigns.reduce(
    (totals, campaign) => {
      totals.total += 1;
      if (totals[campaign.status] !== undefined) {
        totals[campaign.status] += 1;
      }
      totals.sent += getRecipientStats(campaign).sent;
      return totals;
    },
    { total: 0, Draft: 0, Running: 0, Completed: 0, sent: 0 }
  );

  const filteredCampaigns = campaigns.filter((campaign) => {
    const query = searchQuery.toLowerCase();
    const name = campaign.name ? campaign.name.toLowerCase() : '';
    const subject = campaign.subject ? campaign.subject.toLowerCase() : '';
    return name.includes(query) || subject.includes(query);
  });

  const localFiltered = filteredCampaigns.filter((c) => {
    if (!localSearch.trim()) return true;
    return c.name?.toLowerCase().includes(localSearch.trim().toLowerCase());
  });

  const columns = {
    Draft: localFiltered.filter((c) => c.status === 'Draft'),
    Running: localFiltered.filter((c) => c.status === 'Running'),
    Completed: localFiltered.filter((c) => c.status === 'Completed')
  };

  const paginatedCompleted = columns.Completed.slice(0, completedPage * perPage);
  const totalCompletedPages = Math.max(1, Math.ceil(columns.Completed.length / perPage));

  const paginatedTable = localFiltered.slice(0, tablePage * perPage);
  const totalTablePages = Math.max(1, Math.ceil(localFiltered.length / perPage));

  const Pagination = ({ page, setPage, total, label }) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            type="button"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="text-[10px] font-bold text-slate-600 px-1.5 tabular-nums">
            {page} / {total}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            disabled={page >= total}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            type="button"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
    );
  };

  const statusConfig = {
    Draft: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600 border-slate-200' },
    Running: { dot: 'bg-blue-600', bg: 'bg-blue-50/70', text: 'text-blue-600 border-blue-100' },
    Completed: { dot: 'bg-cyan-500', bg: 'bg-cyan-50/70', text: 'text-cyan-600 border-cyan-100' }
  };

  const getProgress = (campaign) => {
    const stats = getRecipientStats(campaign);
    const total = campaign.recipients.length;
    return total === 0 ? 0 : Math.round(((stats.sent + stats.failed) / total) * 100);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Dynamic datasets based on actual campaign and domain status
  const realMonthlySent = (() => {
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];
    const now = new Date();

    // Build last 12 months array
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const isCurrent = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      result.push({
        monthKey: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthsShort[d.getMonth()],
        count: 0,
        height: '0%',
        isCurrent
      });
    }

    // Populate counts
    campaigns.forEach((campaign) => {
      if (!campaign.createdAt) return;
      const date = new Date(campaign.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const found = result.find((r) => r.monthKey === key);
      if (found) {
        found.count += getRecipientStats(campaign).sent;
      }
    });

    const maxCount = Math.max(...result.map((d) => d.count), 0);
    return result.map((d) => ({
      month: d.month,
      count: d.count,
      isCurrent: d.isCurrent,
      height: maxCount > 0 && d.count > 0 ? `${Math.max(5, Math.round((d.count / maxCount) * 100))}%` : '0%'
    }));
  })();

  const realLeads = campaigns.flatMap((campaign) => {
    return (campaign.recipients || []).map((recipient) => {
      let statusLabel = 'Scheduled';
      if (campaign.status === 'Draft') {
        statusLabel = 'Scheduled';
      } else {
        if (recipient.status === 'sent') {
          statusLabel = 'Success';
        } else if (recipient.status === 'failed') {
          statusLabel = 'Bounced';
        } else {
          statusLabel = 'Scheduled';
        }
      }

      return {
        id: recipient._id || Math.random().toString(),
        name: recipient.name || recipient.email.split('@')[0],
        email: recipient.email,
        campaign: campaign.name,
        status: statusLabel,
        date: campaign.createdAt || new Date()
      };
    });
  });

  const sortedLeads = [...realLeads].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredLeads = sortedLeads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.campaign.toLowerCase().includes(q)
    );
  });

  const paginatedLeads = filteredLeads.slice((leadsPage - 1) * perPage, leadsPage * perPage);
  const totalLeadsPages = Math.max(1, Math.ceil(filteredLeads.length / perPage));

  const realSenders = domains.map((domain, index) => {
    const warmPercent = domain.status === 'Active'
      ? `${Math.min(100, Math.max(10, Math.round((domain.totalEmailsSent / 500) * 100)))}%`
      : '0%';

    return {
      id: domain._id || index,
      email: domain.senderEmail,
      domain: domain.domainName,
      limit: `${domain.dailyLimit || 500}/day`,
      sent: domain.dailyUsage || 0,
      status: domain.status,
      warmedUp: warmPercent
    };
  });

  return (
    <section className="flex flex-col gap-8 pb-12 font-sans text-fg">

      {/* 1. TOP SUB-NAVBAR */}


      {activeSubTab === 'dashboard' && (
        <>
          {/* 2. HERO/BANNER AREA (Blue Gradient) */}
          <div className="rounded[28px] p-8 md:pt-16 h-[30rem] relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-700 to-blue-900 border border-blue-900/40 shadow-xl flex flex-col md:flex-row  justify-between gap-8">
            {/* Background glowing meshes */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-blue-500/10 via-blue-500/10 to-transparent rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-blue-600/5 rounded-full filter blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-lg text-center md:text-left flex flex-col items-center md:items-start">
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Hi, {user?.name || 'Anthony'} 👋
              </h1>
              <p className="text-slate-300 text-sm mt-3.5 leading-relaxed max-w-sm font-medium">
                Create a campaign to promote your business more widely and reach potential markets throughout the world!
              </p>
              <button
                onClick={() => navigate('/compose')}
                className="mt-7 inline-flex items-center justify-center gap-2 px-6 h-12 bg-white text-blue-950 hover:bg-blue-50 text-xs font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer group"
                type="button"
              >
                <span>Start Campaign</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:translate-x-1">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>

            {/* Right Graphic mimicking screenshot */}
            <div className="relative w-full -mt- md:w-[420px] h-[180px] flex items-center justify-center flex-shrink-0 select-none">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 w-[320px] shadow-2xl relative z-10">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between bg-white rounded-xl p-2 shadow-sm border border-slate-100/10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">AW</div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800">Anthony Wille</span>
                        <span className="text-[8px] font-medium text-slate-400">Campaign</span>
                      </div>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-100">Success</span>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-xl p-2 shadow-sm border border-slate-100/10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">JM</div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800">Jerome Mich</span>
                        <span className="text-[8px] font-medium text-slate-400">Private</span>
                      </div>
                    </div>
                    <span className="bg-amber-50 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-amber-100">Scheduled</span>
                  </div>
                </div>
              </div>

              {/* Floating Badges */}
              <div className="absolute left-[20px] top-[15px] z-20 bg-white text-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-slate-100 flex items-center gap-1.5 hover:scale-105 transition-all">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-600"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                <span>Leads</span>
              </div>

              <div className="absolute left-[30px] bottom-[15px] z-20 bg-white text-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-slate-100 flex items-center gap-1.5 hover:scale-105 transition-all">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-600"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                <span>Senders</span>
              </div>

              <div className="absolute right-[10px] top-[35px] z-20 bg-slate-950 text-white rounded-2xl p-3 shadow-2xl border border-slate-800 flex flex-col items-center justify-center hover:scale-105 transition-all animate-bounce duration-[4000ms]">
                <span className="text-xl font-black text-blue-400 leading-none">12x</span>
                <span className="text-[7px] font-bold text-slate-400 mt-1 uppercase tracking-wider">More effective</span>
              </div>
            </div>
          </div>

          {/* 3. METRICS AND CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch px-10 -mt-48 relative z-10">

            {/* Card 1: Emails sent (7 columns) */}
            <div className="lg:col-span-7 bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-[360px] hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Emails sent</span>
                  <div className="flex bg-slate-50 rounded-2xl p-0.5 border border-slate-100">
                    <button
                      onClick={() => setSentTimeframe('month')}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                        sentTimeframe === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      type="button"
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => setSentTimeframe('all')}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                        sentTimeframe === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      type="button"
                    >
                      All Time
                    </button>
                  </div>
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-3">
                  {sentTimeframe === 'month'
                    ? (realMonthlySent.find((m) => m.isCurrent)?.count || 0).toLocaleString()
                    : summary.sent.toLocaleString()}
                </h2>
              </div>

              {/* Monthly Bar Chart */}
              <div className="flex items-end justify-between gap-2 h-[190px] pt-4 select-none">
                {realMonthlySent.map((bar) => {
                  return (
                    <div key={bar.month} className="flex-1 flex flex-col items-center group relative">
                      <div className="w-full bg-slate-100 hover:bg-slate-150 rounded-full h-[180px] flex items-end overflow-hidden transition-colors cursor-pointer">
                        <div
                          className={`w-full rounded-full transition-all duration-700 ease-out ${
                            bar.isCurrent
                              ? 'bg-gradient-to-t from-brand-orange to-orange-400 group-hover:from-brand-orange-hover group-hover:to-amber-300'
                              : 'bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-500 group-hover:to-cyan-300'
                          }`}
                          style={{ height: bar.height }}
                        />
                      </div>

                      {/* Tooltip */}
                      <span className="absolute -top-6 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                        {bar.count} sent {bar.isCurrent && '(This Month)'}
                      </span>

                      <span className={`text-[9px] font-bold uppercase mt-2 transition-colors duration-300 ${bar.isCurrent ? 'text-brand-orange font-black' : 'text-slate-400'}`}>
                        {bar.month}
                        {bar.isCurrent && ' •'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Prospect engagement (5 columns) */}
            <div className="lg:col-span-5 bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-[360px] hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prospect engagement</span>

              </div>

              <div className="grid grid-cols-3 grid-rows-2 gap-px bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden mt-4 h-full select-none">
                {[
                  { label: 'Unique Opens', count: overviewStats?.totalUniqueOpens !== undefined ? overviewStats.totalUniqueOpens.toLocaleString() : '0', rate: `Avg: ${overviewStats?.averageOpenRate || '0.0%'}` },
                  { label: 'Unique Clicks', count: overviewStats?.totalUniqueClicks !== undefined ? overviewStats.totalUniqueClicks.toLocaleString() : '0', rate: `Avg: ${overviewStats?.averageClickRate || '0.0%'}` },
                  { label: 'Unsubscribed', count: overviewStats?.totalUnsubscribes !== undefined ? overviewStats.totalUnsubscribes.toLocaleString() : '0', rate: `Avg: ${overviewStats?.averageUnsubscribeRate || '0.0%'}` },
                  { label: 'Total Sent', count: overviewStats?.totalSent !== undefined ? overviewStats.totalSent.toLocaleString() : '0', rate: 'SMTP Relayed' },
                  { label: 'Total Failed', count: overviewStats?.totalFailed !== undefined ? overviewStats.totalFailed.toLocaleString() : '0', rate: overviewStats?.totalSent ? `${((overviewStats.totalFailed / (overviewStats.totalSent + overviewStats.totalFailed || 1)) * 100).toFixed(1)}% bounce` : '0.0% bounce' },
                  { label: 'Campaigns', count: overviewStats?.totalCampaigns !== undefined ? overviewStats.totalCampaigns.toLocaleString() : '0', rate: 'Created' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-4.5 flex flex-col justify-center gap-1 hover:bg-slate-50/50 transition-colors">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                    <div className="flex flex-col mt-0.5">
                      <span className="text-base font-black text-slate-800 leading-none">{item.count}</span>
                      <span className="text-[9px] font-bold text-slate-400 mt-1">{item.rate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 6. MOCK LEADS SUB-VIEW */}
      {activeSubTab === 'leads' && (
        <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 flex flex-col gap-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Leads & Contacts</h2>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">Manage prospective recipients and list conversions</p>
            </div>
            <button
              onClick={() => navigate('/compose')}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/15 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Lead
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-xs min-w-[700px] bg-white">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th scope="col" className="px-5 py-3.5 text-left font-bold">Contact Name</th>
                  <th scope="col" className="px-5 py-3.5 text-left font-bold">Email Address</th>
                  <th scope="col" className="px-5 py-3.5 text-left font-bold">Campaign</th>
                  <th scope="col" className="px-5 py-3.5 text-left font-bold">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-left font-bold">Added Date</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-slate-400 py-12 font-semibold bg-white">
                      No leads found
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 font-bold text-[10px] text-slate-600 flex items-center justify-center">
                          {lead.name.charAt(0)}
                        </div>
                        {lead.name}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-500">{lead.email}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{lead.campaign}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${lead.status === 'Success'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : lead.status === 'Scheduled'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                          <span className={`w-1 h-1 rounded-full ${lead.status === 'Success'
                            ? 'bg-emerald-500'
                            : lead.status === 'Scheduled'
                              ? 'bg-blue-500'
                              : 'bg-rose-500'
                            }`} />
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 font-semibold">{formatDate(lead.date)}</td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => navigate('/compose')} className="text-slate-400 hover:text-slate-700 font-bold px-2 py-1 text-[10px] hover:bg-slate-100 rounded-lg cursor-pointer transition-colors" type="button">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {totalLeadsPages > 1 && (
              <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100">
                <Pagination page={leadsPage} setPage={setLeadsPage} total={totalLeadsPages} label={`Leads: Showing ${paginatedLeads.length} of ${filteredLeads.length}`} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MOCK ANALYTICS SUB-VIEW */}
      {activeSubTab === 'analytics' && (
        <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 flex flex-col gap-6 animate-fadeIn select-none">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Campaign Analytics Deep Dive</h2>
            <p className="text-slate-400 text-xs mt-1.5 font-medium">Conversion pipelines, click heatmaps, and funnel analytics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              {
                title: 'Delivery Success',
                val: overviewStats?.totalSent ? `${((overviewStats.totalSent / (overviewStats.totalSent + overviewStats.totalFailed || 1)) * 100).toFixed(1)}%` : '100%',
                desc: 'Successful SMTP relays',
                color: 'text-emerald-600'
              },
              { title: 'Avg. Open Rate', val: overviewStats?.averageOpenRate || '0.0%', desc: 'Recipient pixel triggers', color: 'text-blue-600' },
              { title: 'Avg. Click Rate', val: overviewStats?.averageClickRate || '0.0%', desc: 'Redirect links clicked', color: 'text-cyan-500' },
              { title: 'Unsubscribe Rate', val: overviewStats?.averageUnsubscribeRate || '0.0%', desc: 'Recipient opt-outs', color: 'text-slate-500' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.title}</span>
                <h3 className={`text-2xl font-black mt-2 leading-none ${stat.color}`}>{stat.val}</h3>
                <p className="text-[10px] font-medium text-slate-400 mt-2">{stat.desc}</p>
              </div>
            ))}
          </div>

          <div className="border border-slate-100 rounded-2xl p-6 flex flex-col gap-5 mt-3">
            <h3 className="text-sm font-bold text-slate-800">Conversion Funnel Visualizer</h3>
            <div className="flex flex-col gap-4.5 pt-3">
              {(() => {
                const processedCount = (overviewStats?.totalSent || 0) + (overviewStats?.totalFailed || 0);
                const deliveredCount = overviewStats?.totalSent || 0;
                const uniqueOpensCount = overviewStats?.totalUniqueOpens || 0;
                const uniqueClicksCount = overviewStats?.totalUniqueClicks || 0;
                const unsubscribesCount = overviewStats?.totalUnsubscribes || 0;

                const deliveredPct = processedCount > 0 ? ((deliveredCount / processedCount) * 100).toFixed(1) + '%' : '100%';
                const openPct = deliveredCount > 0 ? ((uniqueOpensCount / deliveredCount) * 100).toFixed(1) + '%' : '0.0%';
                const clickPct = uniqueOpensCount > 0 ? ((uniqueClicksCount / uniqueOpensCount) * 100).toFixed(1) + '%' : '0.0%';
                const unsubPct = deliveredCount > 0 ? ((unsubscribesCount / deliveredCount) * 100).toFixed(1) + '%' : '0.0%';

                const funnelSteps = [
                  { step: '1. Emails Processed', count: `${processedCount.toLocaleString()} processed`, pct: '100%', width: '100%', bg: 'bg-slate-950' },
                  { step: '2. Inbox Delivered', count: `${deliveredCount.toLocaleString()} delivered`, pct: deliveredPct, width: deliveredPct, bg: 'bg-blue-900' },
                  { step: '3. Unique Opens', count: `${uniqueOpensCount.toLocaleString()} opens`, pct: openPct, width: openPct, bg: 'bg-blue-600' },
                  { step: '4. Link Clicks', count: `${uniqueClicksCount.toLocaleString()} clicks`, pct: clickPct, width: clickPct, bg: 'bg-cyan-400' },
                  { step: '5. Unsubscribed', count: `${unsubscribesCount.toLocaleString()} unsubscribed`, pct: unsubPct, width: unsubPct, bg: 'bg-emerald-400' }
                ];

                return funnelSteps.map((step, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold">
                    <div className="w-[180px] text-slate-700">{step.step}</div>
                    <div className="flex-1 bg-slate-50 rounded-lg h-7 overflow-hidden border border-slate-100 flex items-center relative">
                      <div className={`h-full ${step.bg} transition-all duration-1000 ease-out`} style={{ width: step.width }} />
                      <span className="absolute left-3 text-[10px] font-bold text-white mix-blend-difference">{step.count}</span>
                    </div>
                    <div className="w-[50px] text-right text-slate-800 font-extrabold">{step.pct}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 8. MOCK SENDERS SUB-VIEW */}
      {activeSubTab === 'senders' && (
        <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 flex flex-col gap-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Active Senders & Warmup Rotators</h2>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">Domain SMTP load status, health meters, and volume rotators</p>
            </div>
            <button onClick={() => navigate('/domains')} className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all" type="button">
              Configure Rotator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
            {realSenders.length === 0 ? (
              <div className="col-span-2 text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-white/40">
                <p className="text-slate-400 text-xs font-medium">No sending domains configured yet.</p>
                <button
                  onClick={() => navigate('/domains')}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  type="button"
                >
                  Configure Domains
                </button>
              </div>
            ) : (
              realSenders.map((sender) => (
                <div key={sender.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between gap-4.5 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                        @
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-slate-800 leading-normal">{sender.email}</span>
                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">SMTP: {sender.domain}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sender.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>{sender.status}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-b border-slate-50 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div>
                      <span>Warmup factor</span>
                      <span className="block text-slate-800 font-extrabold text-xs mt-1">{sender.warmedUp}</span>
                    </div>
                    <div className="text-center">
                      <span>Limit quota</span>
                      <span className="block text-slate-800 font-extrabold text-xs mt-1">{sender.limit}</span>
                    </div>
                    <div className="text-right">
                      <span>Sent today</span>
                      <span className="block text-blue-600 font-extrabold text-xs mt-1">{sender.sent} mails</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                      <span>Warmup Progress</span>
                      <span>{sender.warmedUp}</span>
                    </div>
                    <div className="h-1.5 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: sender.warmedUp }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </section>
  );
}
