import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CampaignCard from './CampaignCard';

export default function CampaignsView({
  campaigns = [],
  onRefresh,
  onLaunch,
  searchQuery = '',
  user
}) {
  const navigate = useNavigate();
  const [layoutMode, setLayoutMode] = useState('kanban');
  const [localSearch, setLocalSearch] = useState('');
  const [completedPage, setCompletedPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const perPage = 10;

  const statusConfig = {
    Draft: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600 border-slate-200' },
    Running: { dot: 'bg-blue-600', bg: 'bg-blue-50/70', text: 'text-blue-600 border-blue-100' },
    Completed: { dot: 'bg-cyan-500', bg: 'bg-cyan-50/70', text: 'text-cyan-600 border-cyan-100' }
  };



  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

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

  return (
    <section className="flex flex-col gap-6 bg-gradient-to-br from-blue-500 to-blue-800 font-sans text-fg">
      <div className="flex flex-col px-14 pt-10 sm:flex-row sm:items-center justify-between gap-4 ">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Campaigns</h2>
          <p className="text-slate-100 text-xs mt-1.5 font-medium">Manage, edit, duplicate, and launch your email outbound campaigns.</p>
        </div>
        <button
          onClick={() => navigate('/compose')}
          className="h-10 px-5 bg-white hover:bg-blue-700 text-blue-600 text-xs font-bold rounded-xl shadow-md shadow-blue-500/15 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95"
          type="button"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Start Campaign
        </button>
      </div>

      <div className="bg-white p-6 rounded-tr-[28px] rounded-tl-[28px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-extrabold text-slate-800 leading-none">Campaign Details</h3>
            <button
              onClick={onRefresh}
              className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-100 hover:text-blue-600 transition-all cursor-pointer shadow-sm"
              type="button"
              title="Refresh Campaigns"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-50 rounded-2xl h-10 text-slate-500 w-[200px] sm:w-[240px] shadow-inner">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-3 mr-2 flex-shrink-0 text-slate-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 w-full font-medium pr-3"
                type="text"
                placeholder="Search campaigns..."
                value={localSearch}
                onChange={(e) => { setLocalSearch(e.target.value); setCompletedPage(1); setTablePage(1); }}
              />
            </div>

            <div className="flex bg-slate-50 rounded-2xl p-0.5 border border-slate-100">
              <button
                onClick={() => setLayoutMode('table')}
                className={`text-[10px] font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${layoutMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                type="button"
              >
                Table
              </button>
              <button
                onClick={() => setLayoutMode('kanban')}
                className={`text-[10px] font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${layoutMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                type="button"
              >
                Kanban
              </button>
            </div>
          </div>
        </div>

        {layoutMode === 'kanban' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {Object.entries(columns).map(([colName, colItems]) => {
              const cfg = statusConfig[colName];
              return (
                <div key={colName} className="bg-slate-100 border border-slate-100 rounded-2xl p-4 min-h-[600px] max-h-[600px] overflow-y-auto flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold  ${colName === 'Completed'
                        ? 'bg-green-200 text-emerald-700 border-emerald-100'
                        : colName === 'Running'
                          ? 'bg-blue-200 text-blue-700 border-blue-100'
                          : 'bg-slate-200 text-slate-600 border-slate-300/40'
                        }`}>
                        {colName === 'Running' ? 'In Progress' : colName}
                      </span>
                      <span className="bg-slate-200/60 text-slate-700 text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full">
                        {colItems.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 flex-1">
                    {colItems.length === 0 ? (
                      <p className="text-center text-slate-400 text-xs py-12 border border-dashed border-slate-200 rounded-2xl bg-white/40 font-medium">
                        No {colName.toLowerCase()} campaigns
                      </p>
                    ) : colName === 'Completed' ? (
                      <>
                        {paginatedCompleted.map((campaign) => (
                          <CampaignCard
                            key={campaign._id}
                            campaign={campaign}
                            onLaunch={onLaunch}
                          />
                        ))}
                        <Pagination page={completedPage} setPage={setCompletedPage} total={totalCompletedPages} label={`Completed: ${Math.min(paginatedCompleted.length, completedPage * perPage)} of ${columns.Completed.length}`} />
                      </>
                    ) : (
                      colItems.map((campaign) => (
                        <CampaignCard
                          key={campaign._id}
                          campaign={campaign}
                          onLaunch={onLaunch}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto shadow-inner">
            <table className="w-full text-xs min-w-[700px] bg-white">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th scope="col" className="text-left px-5 py-3.5 font-bold">Name</th>
                  <th scope="col" className="text-left px-5 py-3.5 font-bold">Subject</th>
                  <th scope="col" className="text-left px-5 py-3.5 font-bold">Status</th>
                  <th scope="col" className="text-left px-5 py-3.5 font-bold">Recipients</th>
                  <th scope="col" className="text-left px-5 py-3.5 font-bold">Created</th>
                  <th scope="col" className="text-right px-5 py-3.5 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {localFiltered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-slate-400 py-12 font-semibold bg-white">
                      No campaigns found
                    </td>
                  </tr>
                ) : (
                  paginatedTable.map((campaign) => {
                    const cfg = statusConfig[campaign.status] || statusConfig.Draft;
                    return (
                      <tr
                        key={campaign._id}
                        onClick={() => navigate(`/campaigns/${campaign._id}`)}
                        className="hover:bg-slate-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 font-bold text-slate-850 truncate max-w-[180px]">{campaign.name}</td>
                        <td className="px-5 py-4 text-slate-500 truncate max-w-[260px] font-medium">{campaign.subject}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">{campaign.recipients.length}</td>
                        <td className="px-5 py-4 text-slate-400 font-semibold">{formatDate(campaign.createdAt)}</td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-2">
                            {campaign.status === 'Draft' && (
                              <button
                                onClick={() => navigate('/compose', { state: { editCampaign: campaign } })}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                                type="button"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => navigate('/compose', { state: { duplicateCampaign: campaign } })}
                              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                              type="button"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Duplicate
                            </button>
                            {campaign.status === 'Draft' && (
                              <button
                                onClick={() => onLaunch(campaign._id)}
                                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                                type="button"
                              >
                                Launch
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {totalTablePages > 1 && (
              <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100">
                <Pagination page={tablePage} setPage={setTablePage} total={totalTablePages} label={`Campaigns: Showing ${paginatedTable.length} of ${localFiltered.length}`} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
