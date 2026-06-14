import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function EmployeeDetailView({ showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [empRes, campRes] = await Promise.all([
          apiFetch(`/users/employees/${id}`),
          apiFetch(`/users/employees/${id}/campaigns`)
        ]);
        setEmployee(empRes.user);
        setCampaigns(campRes.campaigns || []);
      } catch (err) {
        showToast?.(err.message, 'error');
        navigate('/employees');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!employee) return null;

  const totalSent = campaigns.reduce((sum, c) => sum + (c.recipients?.filter(r => r.status === 'sent').length || 0), 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.recipients?.filter(r => r.status === 'failed').length || 0), 0);
  const draftCount = campaigns.filter(c => c.status === 'Draft').length;
  const runningCount = campaigns.filter(c => c.status === 'Running').length;
  const completedCount = campaigns.filter(c => c.status === 'Completed').length;

  return (
    <div className="max-w-[1000px]">
      <button
        onClick={() => navigate('/employees')}
        className="flex items-center gap-2 text-xs font-bold text-fg-muted hover:text-fg mb-6 transition-all cursor-pointer"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Employees
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-accent text-brand-lime font-bold flex items-center justify-center text-xl flex-shrink-0">
          {employee.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">{employee.name}</h1>
          <p className="text-sm text-fg-muted">{employee.email}</p>
          <p className="text-[11px] text-fg-muted mt-0.5">{campaigns.length} campaign(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-raised rounded-2xl border border-border-light p-5">
          <div className="text-2xl font-extrabold text-fg">{campaigns.length}</div>
          <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mt-1">Total Campaigns</div>
        </div>
        <div className="bg-surface-raised rounded-2xl border border-border-light p-5">
          <div className="text-2xl font-extrabold text-success">{totalSent}</div>
          <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mt-1">Sent</div>
        </div>
        <div className="bg-surface-raised rounded-2xl border border-border-light p-5">
          <div className="text-2xl font-extrabold text-warning">{runningCount}</div>
          <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mt-1">Running</div>
        </div>
        <div className="bg-surface-raised rounded-2xl border border-border-light p-5">
          <div className="text-2xl font-extrabold text-error">{totalFailed}</div>
          <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mt-1">Failed</div>
        </div>
      </div>

      <h2 className="text-lg font-extrabold tracking-tight text-fg mb-4">Campaigns</h2>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 bg-surface-raised rounded-2xl border border-border-light">
          <p className="text-sm font-semibold text-fg-muted">No campaigns yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const sentCount = campaign.recipients?.filter(r => r.status === 'sent').length || 0;
            const totalCount = campaign.recipients?.length || 0;
            const progress = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

            return (
              <div
                key={campaign._id}
                className="bg-surface-raised rounded-2xl border border-border-light p-5 hover:border-border transition-all cursor-pointer"
                onClick={() => navigate(`/campaigns/${campaign._id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-fg">{campaign.name}</div>
                    <div className="text-xs text-fg-muted mt-0.5">{campaign.subject}</div>
                  </div>
                  <div className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                    campaign.status === 'Completed' ? 'bg-success-muted text-success' :
                    campaign.status === 'Running' ? 'bg-brand-orange-muted text-brand-orange' :
                    'bg-accent-muted text-fg-secondary'
                  }`}>
                    {campaign.status}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-fg-muted font-medium">
                  <span>{totalCount} recipient(s)</span>
                  <span>{sentCount} sent</span>
                  <span>{campaign.senderRotationMode}</span>
                </div>
                {campaign.status === 'Running' && (
                  <div className="mt-3 w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-orange rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}