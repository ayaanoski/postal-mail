import { useNavigate } from 'react-router-dom';

export default function CampaignCard({ campaign, onLaunch }) {
  const navigate = useNavigate();

  const getRecipientStats = (c) =>
    c.recipients.reduce(
      (stats, recipient) => {
        if (stats[recipient.status] !== undefined) {
          stats[recipient.status] += 1;
        }
        return stats;
      },
      { pending: 0, sent: 0, failed: 0 }
    );

  const getProgress = (c) => {
    const stats = getRecipientStats(c);
    const total = c.recipients.length;
    return total === 0 ? 0 : Math.round(((stats.sent + stats.failed) / total) * 100);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const stats = getRecipientStats(campaign);
  const total = campaign.recipients.length;
  const progress = getProgress(campaign);
  const isDraft = campaign.status === 'Draft';
  const hasFailed = stats.failed > 0;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Running':
        return {
          pillClass: 'bg-blue-50/80 text-blue-600 border-blue-100/70',
          labelText: 'In Progress',
          borderColor: 'border-l-blue-500',
          dot: (
            <span className="relative flex h-1.5 w-1.5 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
          )
        };
      case 'Completed':
        return {
          pillClass: 'bg-emerald-50/80 text-emerald-600 border-emerald-100/70',
          labelText: 'Completed',
          borderColor: 'border-l-emerald-500',
          dot: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        };
      case 'Draft':
      default:
        return {
          pillClass: 'bg-slate-50/80 text-slate-500 border-slate-200/60',
          labelText: 'Draft',
          borderColor: 'border-l-slate-300',
          dot: <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
        };
    }
  };

  const statusCfg = getStatusConfig(campaign.status);

  return (
    <article
      onClick={() => navigate(`/campaigns/${campaign._id}`)}
      className={`bg-white  rounded-2xl p-5 flex flex-col gap-3.5 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 cursor-pointer hover:border-slate-200/80 relative overflow-hidden group ${statusCfg.borderColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1 flex-1 leading-snug">
          {campaign.name}
        </h3>

      </div>

      <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed ">
        {campaign.subject || <span className="italic text-slate-300">No subject specified</span>}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-slate-100/80">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {total} {total === 1 ? 'recipient' : 'recipients'}
        </span>

        {campaign.senderRotationMode && (
          <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-slate-100/80 capitalize">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {campaign.senderRotationMode.replace('-', ' ')}
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-col gap-2">
        <div className="flex justify-between items-baseline text-[10px] font-bold tracking-wide uppercase">
          {isDraft ? (
            <span className="text-slate-400">Ready to send</span>
          ) : (
            <span className={campaign.status === 'Completed' ? "text-emerald-600" : "text-blue-600"}>
              {progress}% Sent
            </span>
          )}

          <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5 font-mono">
            {isDraft ? (
              <span>{total} total</span>
            ) : (
              <>
                <span className="text-slate-700 font-bold">{stats.sent}</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-400 font-bold">{total} sent</span>
                {hasFailed && (
                  <>
                    <span className="text-slate-300">&middot;</span>
                    <span className="text-red-500 font-bold">{stats.failed} failed</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="h-1.5 bg-slate-100/80 rounded-full overflow-hidden shadow-inner relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${campaign.status === 'Running'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 animate-pulse'
              : campaign.status === 'Completed'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                : 'bg-slate-200'
              }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 gap-2 mt-1">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 whitespace-nowrap flex-shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400/80 flex-shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{formatDate(campaign.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {campaign.status === 'Draft' && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/compose', { state: { editCampaign: campaign } }); }}
              className="h-7 px-2 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 text-slate-600 hover:text-blue-700 text-[10px] font-semibold rounded-lg transition-all duration-150 cursor-pointer shadow-sm flex items-center justify-center gap-1 hover:-translate-y-0.5 active:translate-y-0"
              type="button"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Edit
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/compose', { state: { duplicateCampaign: campaign } }); }}
            className="h-7 px-2 bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 text-slate-600 hover:text-indigo-700 text-[10px] font-semibold rounded-lg transition-all duration-150 cursor-pointer shadow-sm flex items-center justify-center gap-1 hover:-translate-y-0.5 active:translate-y-0"
            type="button"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate
          </button>
          {campaign.status === 'Draft' && (
            <button
              onClick={(e) => { e.stopPropagation(); onLaunch(campaign._id); }}
              className="h-7 px-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-semibold rounded-lg transition-all duration-150 active:scale-95 cursor-pointer shadow-[0_4px_10px_rgba(59,130,246,0.2)] hover:shadow-[0_6px_14px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1"
              type="button"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              Launch
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

