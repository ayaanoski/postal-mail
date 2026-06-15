import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function SettingsView({ showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null); // 'form' or config ID
  const [deleting, setDeleting] = useState(null); // config ID
  const [configs, setConfigs] = useState([]);
  const [usingGlobal, setUsingGlobal] = useState(true);
  const [testResult, setTestResult] = useState(null); // { status, message, target }

  const [showForm, setShowForm] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null); // config ID or null (for create)

  // Form states
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('brevo');
  const [smtpHost, setSmtpHost] = useState('smtp-relay.brevo.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [vpsApiUrl, setVpsApiUrl] = useState('');
  const [useCustomVpsHost, setUseCustomVpsHost] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/smtp-config');
      setConfigs(res.configs || []);
      setUsingGlobal(res.usingGlobal);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    setVpsApiUrl('');
    setUseCustomVpsHost(false);
    if (newProvider === 'brevo') {
      setSmtpHost('smtp-relay.brevo.com');
      setSmtpPort(587);
      setSmtpUser('');
    } else if (newProvider === 'sparkpost') {
      setSmtpHost('smtp.sparkpostmail.com');
      setSmtpPort(587);
      setSmtpUser('SMTP_Injection');
    } else if (newProvider === 'vps') {
      setSmtpHost('mail.mailer-us.com');
      setSmtpPort(587);
      setSmtpUser('');
    } else {
      setSmtpHost('');
      setSmtpPort(587);
      setSmtpUser('');
    }
  };

  const openAddForm = () => {
    setName('');
    setProvider('brevo');
    setSmtpHost('smtp-relay.brevo.com');
    setSmtpPort(587);
    setSmtpUser('');
    setSmtpPass('');
    setIsActive(true);
    setSelectedConfig(null);
    setTestResult(null);
    setShowPassword(false);
    setVpsApiUrl('');
    setUseCustomVpsHost(false);
    setShowForm(true);
  };

  const openEditForm = (config) => {
    setSelectedConfig(config.id);
    setName(config.name || '');
    setProvider(config.provider || 'custom');
    setSmtpHost(config.smtpHost || '');
    setSmtpPort(config.smtpPort || 587);
    setSmtpUser(config.smtpUser || '');
    setSmtpPass(config.smtpPass || '');
    setIsActive(config.isActive !== false);
    setTestResult(null);
    setShowPassword(false);
    setVpsApiUrl(config.vpsApiUrl || '');
    setUseCustomVpsHost(config.provider === 'vps' && config.smtpHost !== 'mail.mailer-us.com');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: name || `${provider} (${smtpHost})`,
        provider,
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        isActive,
        vpsApiUrl: provider === 'vps' ? vpsApiUrl : undefined
      };
      if (smtpPass) body.smtpPass = smtpPass;

      let res;
      if (selectedConfig) {
        res = await apiFetch(`/smtp-config/${selectedConfig}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
      } else {
        res = await apiFetch('/smtp-config', {
          method: 'POST',
          body: JSON.stringify(body)
        });
      }

      showToast(res.message || 'SMTP configuration saved.');
      setSmtpPass('');
      setShowForm(false);
      setSelectedConfig(null);
      loadConfig();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (configId = null) => {
    const target = configId || 'form';
    setTesting(target);
    setTestResult(null);
    try {
      let body;
      if (configId) {
        body = { id: configId };
      } else {
        body = { smtpHost, smtpPort: Number(smtpPort), smtpUser, provider, vpsApiUrl };
        if (smtpPass) body.smtpPass = smtpPass;
      }

      const res = await apiFetch('/smtp-config/test', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setTestResult({ status: 'success', message: res.message, target });
      showToast('SMTP connection verified successfully.');
      loadConfig();
    } catch (err) {
      setTestResult({ status: 'failed', message: err.message, target });
      showToast(err.message, 'error');
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (configId) => {
    if (!confirm('Remove this SMTP configuration?')) return;
    setDeleting(configId);
    try {
      const res = await apiFetch(`/smtp-config/${configId}`, { method: 'DELETE' });
      showToast(res.message || 'SMTP configuration removed.');
      if (selectedConfig === configId) {
        setShowForm(false);
        setSelectedConfig(null);
      }
      loadConfig();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-14">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-fg tracking-tight">SMTP Settings</h1>
        <p className="text-sm text-fg-secondary mt-1 font-medium">
          Configure multiple personal SMTP servers for rotative campaign delivery.
        </p>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${usingGlobal
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${usingGlobal ? 'bg-amber-400' : 'bg-emerald-500'
          }`} />
        <div className="flex-1">
          <div className="text-sm font-bold">
            {usingGlobal
              ? 'Using Global Server Configuration'
              : 'Using Personal SMTP Rotation Pool'}
          </div>
          <div className="text-xs mt-0.5 opacity-80 font-medium">
            {usingGlobal
              ? 'No active custom profiles found. Campaigns route through global server relays. Add one below to use.'
              : `Active personal SMTP profiles are enabled. The system will rotate campaigns randomly across all active accounts.`}
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.5fr] gap-8">
        {/* Left Column: Accounts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-fg">SMTP Accounts</h2>
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 h-8.5 px-4 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all cursor-pointer shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add SMTP
            </button>
          </div>

          {configs.length === 0 ? (
            <div className="bg-white border border-border-light rounded-2xl p-8 text-center text-fg-secondary">
              <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                  <line x1="6" y1="6" x2="6.01" y2="6"></line>
                  <line x1="6" y1="18" x2="6.01" y2="18"></line>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-fg">No custom SMTP configured</h3>
              <p className="text-xs text-fg-muted mt-1.5 leading-relaxed font-medium">
                Create personal SMTP profiles to send from your own Brevo, SparkPost, VPS (Postal), Desktop, or custom relays.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => {
                const isSelected = selectedConfig === config.id;
                return (
                  <div
                    key={config.id}
                    className={`bg-white border rounded-2xl p-4.5 transition-all shadow-sm ${
                      isSelected ? 'border-fg ring-2 ring-accent/5' : 'border-border-light hover:border-fg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Icon mapping */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          config.provider === 'brevo'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : config.provider === 'sparkpost'
                            ? 'bg-amber-50 text-brand-orange border border-amber-100'
                            : config.provider === 'vps'
                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                            : config.provider === 'azure'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-slate-50 text-slate-700 border border-slate-100'
                        }`}>
                          {config.provider === 'brevo' && 'B'}
                          {config.provider === 'sparkpost' && 'S'}
                          {config.provider === 'vps' && 'V'}
                          {config.provider === 'custom' && 'C'}
                          {config.provider === 'azure' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                              <path d="M11.95 2L2 19.46h6.77L11.95 14H17L11.95 2zM18 14.1L12.9 22H22L18 14.1z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-fg flex items-center gap-2">
                            {config.name}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              config.isActive
                                ? 'bg-brand-lime-muted text-fg'
                                : 'bg-surface-secondary text-fg-muted'
                            }`}>
                              {config.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-fg-secondary mt-0.5">
                            {config.smtpUser} • {config.smtpHost}:{config.smtpPort}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inline last tested status */}
                    {config.lastTestedAt && (
                      <div className="text-[10px] text-fg-muted font-bold mt-3 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          config.lastTestResult === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        Tested: {new Date(config.lastTestedAt).toLocaleDateString()} —{' '}
                        <span className={config.lastTestResult === 'success' ? 'text-emerald-600' : 'text-red-500'}>
                          {config.lastTestResult === 'success' ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                    )}

                    {/* Test Result under specific config card */}
                    {testResult && testResult.target === config.id && (
                      <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border ${
                        testResult.status === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        {testResult.message}
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="flex items-center justify-between border-t border-border-light mt-3.5 pt-3">
                      {config.isHardcoded ? (
                        <span className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider pl-1 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                          Managed by System
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditForm(config)}
                          className="text-[11px] font-extrabold text-fg-secondary hover:text-fg transition-all cursor-pointer"
                        >
                          Edit settings
                        </button>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleTest(config.id)}
                          disabled={testing === config.id}
                          className="inline-flex items-center text-[11px] font-extrabold text-fg-secondary hover:text-fg transition-all cursor-pointer disabled:opacity-50"
                        >
                          {testing === config.id ? 'Testing...' : 'Test'}
                        </button>
                        {!config.isHardcoded && (
                          <button
                            type="button"
                            onClick={() => handleDelete(config.id)}
                            disabled={deleting === config.id}
                            className="text-[11px] font-extrabold text-red-500 hover:text-red-700 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {deleting === config.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detail Form Panel */}
        <div className="space-y-4">
          {showForm ? (
            <form onSubmit={handleSave} className="bg-white border border-border-light rounded-2xl shadow-sm overflow-hidden animate-slideDown">
              <div className="px-6 py-5 border-b border-border-light bg-surface-secondary/30 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-fg">
                    {selectedConfig ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
                  </h2>
                  <p className="text-xs text-fg-muted mt-0.5 font-medium">
                    Set credentials for personal email routing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-7 h-7 rounded-full bg-surface-secondary flex items-center justify-center text-fg hover:bg-border transition-all cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="px-6 py-6 space-y-4">
                {/* Account Name */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Account Name / Label</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium"
                    type="text"
                    placeholder="e.g. SparkPost - High Volume"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </label>

                {/* Provider presets */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">SMTP Provider</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'brevo', label: 'Brevo' },
                      { id: 'sparkpost', label: 'SparkPost' },
                      { id: 'vps', label: 'VPS (Postal)' },
                      { id: 'custom', label: 'Custom' }
                    ].map((prov) => (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => handleProviderChange(prov.id)}
                        className={`h-11 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
                          provider === prov.id
                            ? 'bg-[#131416] text-white border-fg shadow-md'
                            : 'bg-white text-fg-secondary border-border-light hover:bg-surface-secondary'
                        }`}
                      >
                        {prov.label}
                      </button>
                    ))}
                  </div>
                  {provider === 'vps' && (
                    <span className="text-[10px] text-purple-600 font-bold pl-1 leading-normal mt-1">
                      Self-hosted Postal SMTP server. Optionally configure the HTTP API URL below for higher throughput.
                    </span>
                  )}
                </div>

                {/* Host & Port */}
                <div className="grid grid-cols-[1.8fr_1fr] gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-fg-secondary pl-1 flex items-center gap-2">
                      Host
                      {provider === 'vps' && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomVpsHost(!useCustomVpsHost);
                            if (!useCustomVpsHost) {
                              setSmtpHost('');
                            } else {
                              setSmtpHost('mail.mailer-us.com');
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border transition-all cursor-pointer ${
                            useCustomVpsHost
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${useCustomVpsHost ? 'bg-purple-500' : 'bg-slate-400'}`} />
                          {useCustomVpsHost ? 'Custom Host' : 'Default'}
                        </button>
                      )}
                    </span>
                    <input
                      className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium"
                      type="text"
                      placeholder={provider === 'vps' ? 'mail.mailer-us.com' : 'smtp.example.com'}
                      value={smtpHost}
                      onChange={e => setSmtpHost(e.target.value)}
                      disabled={provider !== 'custom' && provider !== 'vps'}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-fg-secondary pl-1">Port</span>
                    <input
                      className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium"
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={e => setSmtpPort(Number(e.target.value))}
                      disabled={provider !== 'custom' && provider !== 'vps'}
                      required
                    />
                  </label>
                </div>

                {/* Username */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">SMTP Username</span>
                  <input
                    className={`w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium ${
                      provider === 'sparkpost' ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                    type="text"
                    placeholder={provider === 'vps' ? 'Postal SMTP username (or API key)' : 'your-username'}
                    value={smtpUser}
                    onChange={e => setSmtpUser(e.target.value)}
                    disabled={provider === 'sparkpost'}
                    required
                  />
                  {provider === 'sparkpost' && (
                    <span className="text-[10px] text-brand-orange font-bold pl-1 leading-normal">
                      SparkPost SMTP requires the username to be exactly "SMTP_Injection".
                    </span>
                  )}
                  {provider === 'vps' && (
                    <span className="text-[10px] text-purple-600 font-bold pl-1 leading-normal">
                      For Postal SMTP, use the format <code>api-key@server-name</code> or your Postal SMTP username.
                    </span>
                  )}
                </label>

                {/* VPS HTTP API URL (only for VPS provider) */}
                {provider === 'vps' && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-fg-secondary pl-1">
                      Postal HTTP API URL <span className="text-fg-muted font-medium">(optional)</span>
                    </span>
                    <input
                      className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium"
                      type="text"
                      placeholder="https://postal.your-server.com"
                      value={vpsApiUrl}
                      onChange={e => setVpsApiUrl(e.target.value)}
                    />
                    <span className="text-[10px] text-fg-muted font-bold pl-1 leading-normal">
                      When set, the system will send via Postal HTTP API instead of SMTP for higher throughput. The SMTP password is used as the API key.
                    </span>
                  </label>
                )}

                {/* Password */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">
                    SMTP Password
                    {selectedConfig && (
                      <span className="text-fg-muted font-medium ml-1.5">(leave empty to keep current)</span>
                    )}
                  </span>
                  <div className="relative">
                    <input
                      className="w-full h-11 pl-4.5 pr-12 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all font-medium"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={selectedConfig ? '••••••••' : provider === 'sparkpost' ? 'Enter API Key' : 'your-password'}
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      required={!selectedConfig}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors focus:outline-none cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>

                {/* Active Toggle */}
                <div className="flex items-center justify-between px-1 py-1.5">
                  <div>
                    <div className="text-sm font-bold text-fg">Enable Profile</div>
                    <div className="text-xs text-fg-muted font-medium mt-0.5">When active, this SMTP is added to the campaign rotation pool.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 cursor-pointer ${isActive ? 'bg-[#131416]' : 'bg-gray-200'
                      }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                  </button>
                </div>

                {/* Test Connection Form Results */}
                {testResult && testResult.target === 'form' && (
                  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold border ${testResult.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${testResult.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                    {testResult.message}
                  </div>
                )}
              </div>

              <div className="px-6 py-5 border-t border-border-light bg-surface-secondary/20 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center h-10 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10"
                >
                  {saving ? 'Saving...' : selectedConfig ? 'Update Account' : 'Save Account'}
                </button>

                <button
                  type="button"
                  onClick={() => handleTest()}
                  disabled={testing === 'form' || !smtpUser}
                  className="inline-flex items-center justify-center h-10 px-6 rounded-full text-xs font-bold bg-white border border-border text-fg hover:bg-surface-secondary transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {testing === 'form' ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-fg-muted border-t-transparent rounded-full animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-surface-secondary/30 border border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 text-fg-muted">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-fg">Configure Account Details</h3>
              <p className="text-xs text-fg-muted mt-2 max-w-[280px] leading-relaxed font-medium">
                Select an account on the left to edit its details, or create a new SMTP server to populate the sender pool.
              </p>
              <button
                type="button"
                onClick={openAddForm}
                className="mt-5 inline-flex items-center gap-1.5 h-9.5 px-5 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all cursor-pointer shadow-md"
              >
                Create SMTP profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
