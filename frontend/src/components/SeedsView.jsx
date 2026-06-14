import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function SeedsView({ user, showToast }) {
  const [seeds, setSeeds] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const canEdit = user && user.role === 'Admin';

  const loadSeeds = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/seeds');
      setSeeds(res.seeds || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSeeds(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    try {
      await apiFetch('/seeds', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() })
      });
      showToast('Seed recipient added');
      setNewEmail('');
      setNewName('');
      loadSeeds();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkImport = async () => {
    const emails = bulkInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (emails.length === 0) return;
    try {
      const res = await apiFetch('/seeds/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ emails })
      });
      showToast(res.message);
      setBulkInput('');
      setShowBulk(false);
      loadSeeds();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggle = async (id) => {
    try {
      await apiFetch(`/seeds/${id}/toggle`, { method: 'POST' });
      loadSeeds();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this seed recipient?')) return;
    try {
      await apiFetch(`/seeds/${id}`, { method: 'DELETE' });
      showToast('Seed recipient removed');
      loadSeeds();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const activeCount = seeds.filter(s => s.isActive).length;

  return (
    <section className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg leading-none">Seed Recipients</h1>
          <p className="text-xs text-fg-muted mt-1.5 font-medium">
            {activeCount} active · Guaranteed open/click accounts to accelerate warmup
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="inline-flex items-center justify-center h-10 px-4.5 bg-[#131416] text-xs font-bold text-white rounded-full shadow-md hover:bg-accent-hover transition-all cursor-pointer"
            type="button"
          >
            {showBulk ? 'Single Add' : 'Bulk Import'}
          </button>
        )}
      </div>

      {canEdit && (
        <div className="bg-white border border-border-light rounded-[24px] p-6 shadow-sm">
          {showBulk ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Bulk Import</h3>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="alice@test.com&#10;bob@test.com&#10;carol@test.com"
                className="w-full p-3 bg-surface-secondary border border-border-light rounded-xl outline-none text-xs font-semibold focus:border-border transition-all resize-y min-h-[100px] shadow-sm font-sans"
              />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-fg-muted">One email per line</span>
                <button
                  onClick={handleBulkImport}
                  className="inline-flex items-center justify-center h-9 px-5 bg-[#131416] text-xs font-bold text-white rounded-full hover:bg-accent-hover transition-all cursor-pointer"
                  type="button"
                >
                  Import Seeds
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="flex items-end gap-3">
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Email</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="testaccount@gmail.com"
                  className="w-full h-10 px-3 bg-surface-secondary border border-border-light rounded-full outline-none text-xs font-semibold text-fg focus:border-border transition-all"
                  required
                />
              </label>
              <label className="flex-1 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Name (optional)</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Test User"
                  className="w-full h-10 px-3 bg-surface-secondary border border-border-light rounded-full outline-none text-xs font-semibold text-fg focus:border-border transition-all"
                />
              </label>
              <button
                type="submit"
                className="h-10 px-5 bg-[#131416] text-xs font-bold text-white rounded-full hover:bg-accent-hover transition-all cursor-pointer shadow-sm"
              >
                Add
              </button>
            </form>
          )}
        </div>
      )}

      <div className="bg-white border border-border-light rounded-[24px] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-fg-muted">Loading...</div>
        ) : seeds.length === 0 ? (
          <div className="p-12 text-center text-xs text-fg-muted border border-dashed border-border rounded-[24px] bg-surface-secondary/20">
            No seed recipients yet. Add test accounts that will open and click your warmup emails.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary border-b border-border-light">
                  <th className="text-left px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Name</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Status</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Opens</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Clicks</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-fg-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {seeds.map((seed) => (
                  <tr key={seed._id} className="hover:bg-surface-secondary/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-fg">{seed.email}</td>
                    <td className="px-6 py-4 text-fg-secondary">{seed.name || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${
                        seed.isActive ? 'bg-green-50 text-green-700' : 'bg-surface-secondary text-fg-muted'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${seed.isActive ? 'bg-green-500' : 'bg-fg-muted'}`} />
                        {seed.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-fg">{seed.openCount || 0}</td>
                    <td className="px-6 py-4 text-center font-semibold text-fg">{seed.clickCount || 0}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleToggle(seed._id)}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                seed.isActive
                                  ? 'bg-white border-border-light text-fg-secondary hover:bg-surface-secondary'
                                  : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                              }`}
                              type="button"
                            >
                              {seed.isActive ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDelete(seed._id)}
                              className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                              type="button"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
