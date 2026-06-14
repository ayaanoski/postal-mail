import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function EmployeeView({ showToast }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPending = async () => {
    try {
      const res = await apiFetch('/users/pending');
      setPendingUsers(res.users || []);
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await apiFetch('/users/employees');
      setEmployees(res.users || []);
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPending(), loadEmployees()]).finally(() => setLoading(false));
  }, []);

  const handleApprove = async (userId) => {
    try {
      await apiFetch(`/users/approve/${userId}`, { method: 'POST' });
      showToast?.('User approved successfully.');
      loadPending();
      loadEmployees();
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  const handleReject = async (userId) => {
    try {
      await apiFetch(`/users/reject/${userId}`, { method: 'POST' });
      showToast?.('User rejected.');
      loadPending();
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Delete "${userName}" and all their campaigns? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      showToast?.(`User "${userName}" deleted.`);
      loadEmployees();
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 p-14">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] p-14">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Employee Management</h1>
      </div>

      <div className="flex bg-surface-secondary rounded-full p-1 w-fit mb-8 border border-border-light">
        <button
          onClick={() => setTab('pending')}
          className={`px-6 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${tab === 'pending'
            ? 'bg-accent text-white shadow-md shadow-accent/10'
            : 'text-fg-muted hover:text-fg'
            }`}
          type="button"
        >
          Pending Approvals {pendingUsers.length > 0 && `(${pendingUsers.length})`}
        </button>
        <button
          onClick={() => setTab('employees')}
          className={`px-6 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${tab === 'employees'
            ? 'bg-accent text-white shadow-md shadow-accent/10'
            : 'text-fg-muted hover:text-fg'
            }`}
          type="button"
        >
          All Employees ({employees.length})
        </button>
      </div>

      {tab === 'pending' && (
        <div>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-16 bg-surface-raised rounded-2xl border border-border-light">
              <div className="w-14 h-14 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="23" y1="21" x2="23" y2="16" />
                  <line x1="20" y1="18" x2="23" y2="16" />
                  <line x1="26" y1="18" x2="23" y2="16" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-fg-muted">No pending approvals</p>
              <p className="text-xs text-fg-muted mt-1">New user registrations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="bg-surface-raised rounded-2xl border border-border-light p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent text-brand-lime font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-fg">{user.name}</div>
                      <div className="text-xs text-fg-muted">{user.email}</div>
                      <div className="text-[11px] text-fg-muted mt-0.5">Registered {new Date(user.createdAt || Date.now()).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(user.id)}
                      className="px-4 py-2 text-xs font-bold rounded-full border border-border text-fg-secondary hover:text-error hover:border-error hover:bg-error-bg transition-all cursor-pointer"
                      type="button"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(user.id)}
                      className="px-4 py-2 text-xs font-bold rounded-full bg-[#131416] text-white hover:bg-accent-hover transition-all cursor-pointer"
                      type="button"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'employees' && (
        <div>
          {employees.length === 0 ? (
            <div className="text-center py-16 bg-surface-raised rounded-2xl border border-border-light">
              <p className="text-sm font-semibold text-fg-muted">No approved employees yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="bg-surface-raised rounded-2xl border border-border-light p-5 flex items-center justify-between hover:border-border transition-all cursor-pointer"
                  onClick={() => navigate(`/employees/${emp.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent text-brand-lime font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-fg">{emp.name}</div>
                      <div className="text-xs text-fg-muted">{emp.email}</div>
                      <div className="text-[11px] text-fg-muted mt-0.5">{emp.campaignCount || 0} campaign(s)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-full border border-border text-fg-secondary hover:text-error hover:border-error hover:bg-error-bg transition-all cursor-pointer"
                      type="button"
                      title="Delete employee"
                    >
                      Delete
                    </button>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}