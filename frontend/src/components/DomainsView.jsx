import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

const buildSpfRecord = (provider) => {
  if (provider === 'vps') return 'v=spf1 a mx include:spf.mail.mailer-us.com ~all';
  if (provider === 'sparkpost') return 'v=spf1 include:sparkpostmail.com ~all';
  if (provider === 'brevo') return 'v=spf1 include:spf.brevo.com ~all';
  if (provider === 'azure') return 'v=spf1 include:spf.smtp2go.com ~all';
  return 'v=spf1 a mx ~all';
};
const buildDmarcRecord = (domain) => `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; pct=100`;

export default function DomainsView({
  domains,
  onRefresh,
  onAddDomain,
  onImportBrevo,
  onImportSparkpost,
  onImportVps,
  onImportAzure,
  onDeleteDomain,
  user
}) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    domainName: '',
    senderEmail: '',
    senderName: '',
    dailyLimit: '',
    provider: 'custom'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyingDomains, setVerifyingDomains] = useState({});
  const [generatingDkim, setGeneratingDkim] = useState({});
  const [dkimResult, setDkimResult] = useState({});
  const [expandedDomainId, setExpandedDomainId] = useState(null);
  const [testEmailInputs, setTestEmailInputs] = useState({});
  const [sendingTest, setSendingTest] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importApiKey, setImportApiKey] = useState('');
  const [importSource, setImportSource] = useState('brevo'); // 'brevo' or 'sparkpost' or 'vps'
  const [importVpsUrl, setImportVpsUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [transportMode, setTransportMode] = useState('brevo');
  const [isImportingAzure, setIsImportingAzure] = useState(false);

  const handleImportAzureClick = async () => {
    setIsImportingAzure(true);
    try {
      await onImportAzure();
    } catch {
      // Toast errors are handled in App.jsx
    } finally {
      setIsImportingAzure(false);
    }
  };

  const [showTestModal, setShowTestModal] = useState(false);
  const [testModalDomain, setTestModalDomain] = useState(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestModal, setIsSendingTestModal] = useState(false);
  const [testModalSuccess, setTestModalSuccess] = useState(false);
  const [testModalError, setTestModalError] = useState(null);

  const handleOpenTestModal = (domain) => {
    setTestModalDomain(domain);
    setTestEmailAddress(domain.senderEmail || '');
    setIsSendingTestModal(false);
    setTestModalSuccess(false);
    setTestModalError(null);
    setShowTestModal(true);
  };

  const handleModalSendTest = async (e) => {
    if (e) e.preventDefault();
    if (!testModalDomain || !testEmailAddress || isSendingTestModal) return;

    setIsSendingTestModal(true);
    setTestModalError(null);
    try {
      await apiFetch(`/domains/${testModalDomain._id}/test-send`, {
        method: 'POST',
        body: JSON.stringify({ recipientEmail: testEmailAddress })
      });
      setTestModalSuccess(true);
    } catch (err) {
      setTestModalError(err.message || 'Failed to send test email. Please check your domain configuration and SMTP setup.');
    } finally {
      setIsSendingTestModal(false);
    }
  };


  useEffect(() => {
    apiFetch('/config')
      .then((res) => {
        if (res.transportMode) {
          setTransportMode(res.transportMode);
        }
      })
      .catch(() => { });
  }, []);

  const canAddDomain = !!user;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'domainName' && value.trim()) {
        const atIndex = prev.senderEmail.indexOf('@');
        if (atIndex !== -1) {
          const currentDomain = prev.senderEmail.slice(atIndex + 1);
          if (currentDomain.toLowerCase() !== value.trim().toLowerCase()) {
            next.senderEmail = `${prev.senderEmail.slice(0, atIndex)}@${value.trim()}`;
          }
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAddDomain) return;

    setIsSubmitting(true);
    try {
      await onAddDomain({
        ...formData,
        dailyLimit: Number(formData.dailyLimit)
      });
      setFormData({
        domainName: '',
        senderEmail: '',
        senderName: '',
        dailyLimit: '',
        provider: 'custom'
      });
      setShowAddModal(false);
    } catch {
      // Handled in caller toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importApiKey || isImporting) return;
    setIsImporting(true);
    try {
      if (importSource === 'brevo') {
        await onImportBrevo(importApiKey);
      } else if (importSource === 'sparkpost') {
        await onImportSparkpost(importApiKey);
      } else if (importSource === 'vps') {
        await onImportVps({ serverUrl: importVpsUrl, apiKey: importApiKey });
      }
      setImportApiKey('');
      setImportVpsUrl('');
      setShowImportModal(false);
    } catch {
      // Handled in caller toast
    } finally {
      setIsImporting(false);
    }
  };

  const handleVerify = async (domainId) => {
    setVerifyingDomains((prev) => ({ ...prev, [domainId]: true }));
    try {
      await apiFetch(`/domains/${domainId}/verify`, { method: 'POST' });
      onRefresh();
    } catch {
      // Handled by apiFetch
    } finally {
      setVerifyingDomains((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  const handleGenerateDkim = async (domainId) => {
    setGeneratingDkim((prev) => ({ ...prev, [domainId]: true }));
    try {
      const res = await apiFetch(`/domains/${domainId}/dkim/generate`, { method: 'POST' });
      setDkimResult((prev) => ({ ...prev, [domainId]: res }));
      onRefresh();
    } catch {
      // Handled by apiFetch
    } finally {
      setGeneratingDkim((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  const handleSendTest = async (domainId) => {
    const recipientEmail = testEmailInputs[domainId];
    if (!recipientEmail) return;

    setSendingTest((prev) => ({ ...prev, [domainId]: true }));
    try {
      await apiFetch(`/domains/${domainId}/test-send`, {
        method: 'POST',
        body: JSON.stringify({ recipientEmail })
      });
      setTestEmailInputs((prev) => ({ ...prev, [domainId]: '' }));
    } catch {
      // Handled by apiFetch
    } finally {
      setSendingTest((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  const copyToClipboard = useCallback(async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard not available
    }
  }, []);

  const toggleExpanded = (domainId) => {
    setExpandedDomainId((prev) => prev === domainId ? null : domainId);
  };

  const statusStyles = {
    'Active': 'bg-success/10 text-success border-success/20',
    'Pending Verification': 'bg-warning/10 text-warning border-warning/20',
    'Disabled': 'bg-error/10 text-error border-error/20',
  };

  const verificationIcon = (exists) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className={exists ? 'text-green-600' : 'text-fg-muted'}
    >
      {exists
        ? <polyline points="20 6 9 17 4 12" />
        : <line x1="18" y1="6" x2="6" y2="18" />
      }
    </svg>
  );

  const handleDownloadZoneFile = (domain) => {
    const spfRecord = buildSpfRecord();
    const dmarcRecord = buildDmarcRecord(domain.domainName);

    let content = `; DNS zone file records for ${domain.domainName}\n`;
    content += `; Generated by Mailer-US on ${new Date().toLocaleDateString()}\n\n`;

    content += `@ 14400 IN TXT "${spfRecord}"\n`;
    content += `_dmarc 14400 IN TXT "${dmarcRecord.replace(/;/g, '\\;')}"\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${domain.domainName}-dns-zone.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const SetupGuideModal = () => {
    if (!showHelp) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-[24px] shadow-xl border border-border-light max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-fg">Domain Setup Guide</h2>
            <button
              onClick={() => setShowHelp(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary transition-all cursor-pointer"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <ol className="flex flex-col gap-5 list-none ml-0">
            {[
              {
                step: '1',
                title: 'Add your domain',
                desc: 'Enter your domain name (e.g. yourcompany.com), a sender email address, display name, and daily email limit. Click "Add Domain".'
              },
              {
                step: '2',
                title: 'Get your DNS records',
                desc: 'After adding, click "DNS Config" on the domain card. This shows the SPF, DKIM, and DMARC records you need to add.'
              },
              {
                step: '3',
                title: 'Generate DKIM keys',
                desc: 'Inside DNS Config, click "Generate DKIM Keys". The system creates a unique key pair. Copy the generated DKIM record.'
              },
              {
                step: '4',
                title: 'Add records to your DNS provider',
                desc: 'Go to your domain registrar or DNS hosting (Cloudflare, Namecheap, GoDaddy, etc.) and add each record shown — SPF, DKIM, and DMARC — as TXT records. Use the "Copy" button for each.'
              },
              {
                step: '5',
                title: 'Verify DNS',
                desc: 'DNS changes can take minutes to hours to propagate. Click "Verify DNS" to check if your records are live. Green checkmarks mean the record is detected.'
              },
              {
                step: '6',
                title: 'Send a test email',
                desc: 'In the "Test Delivery" section inside DNS Config, enter your email address and click "Send Test". If you receive the email, your domain is fully configured and ready for campaigns.'
              },
              {
                step: '7',
                title: 'Start sending campaigns',
                desc: 'Your domain status will show "Active". You can now select it when creating campaigns. Monitor daily usage from the domain card.'
              }
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-extrabold flex items-center justify-center mt-0.5">
                  {step}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-fg">{title}</span>
                  <span className="text-xs text-fg-muted leading-relaxed">{desc}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="bg-surface-secondary/60 rounded-2xl p-4 border border-border-light flex flex-col gap-2">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider">Tips</h4>
            <ul className="text-xs text-fg-muted leading-relaxed flex flex-col gap-1.5 list-disc ml-4">
              <li>DNS changes may take up to 48 hours to fully propagate, but often complete in minutes.</li>
              <li>You need at least SPF + DKIM + MX records for good deliverability.</li>
              <li>DMARC helps prevent spoofing — start with "p=quarantine" and tighten later.</li>
              <li>Click the domain name or "Settings" to edit sender info or change the domain status.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const AddDomainModal = () => {
    if (!showAddModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-[24px] shadow-xl border border-border-light max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-fg font-sans leading-none">Add Sending Domain</h3>
              <p className="text-xs text-fg-muted mt-1.5 font-medium">
                Register a domain you control. Outgoing mail rotates through active verified nodes.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary transition-all cursor-pointer flex-shrink-0"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-fg-secondary pl-1">Domain Name</span>
                <input
                  className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                  name="domainName"
                  type="text"
                  placeholder="vinsmoke.org"
                  value={formData.domainName}
                  onChange={handleChange}
                  disabled={!canAddDomain || isSubmitting}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-fg-secondary pl-1">Sender Email</span>
                <input
                  className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                  name="senderEmail"
                  type="email"
                  placeholder="info@vinsmoke.org"
                  value={formData.senderEmail}
                  onChange={handleChange}
                  disabled={!canAddDomain || isSubmitting}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-fg-secondary pl-1">Sender Display Name</span>
                <input
                  className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                  name="senderName"
                  type="text"
                  placeholder="Vin Support"
                  value={formData.senderName}
                  onChange={handleChange}
                  disabled={!canAddDomain || isSubmitting}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-fg-secondary pl-1">Daily Email Limit</span>
                <input
                  className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                  name="dailyLimit"
                  type="number"
                  min="1"
                  placeholder="1000"
                  value={formData.dailyLimit}
                  onChange={handleChange}
                  disabled={!canAddDomain || isSubmitting}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-fg-secondary pl-1">SMTP Provider</span>
                <select
                  className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium cursor-pointer"
                  name="provider"
                  value={formData.provider || 'custom'}
                  onChange={handleChange}
                  disabled={!canAddDomain || isSubmitting}
                  required
                >
                  <option value="azure">Azure Email Service</option>
                  <option value="brevo">Brevo</option>
                  <option value="sparkpost">SparkPost</option>
                  <option value="vps">VPS (Postal)</option>
                  <option value="custom">Custom SMTP / Direct Sending</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-white border border-border-light text-fg-secondary hover:bg-surface-secondary transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canAddDomain || isSubmitting}
                className="inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10"
              >
                {isSubmitting ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ImportModal = () => {
    if (!showImportModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-[24px] shadow-xl border border-border-light max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-fg font-sans leading-none">
                Import from {importSource === 'brevo' ? 'Brevo' : 'SparkPost'}
              </h3>
              <p className="text-xs text-fg-muted mt-1.5 font-medium">
                Auto-sync sending domains directly from your {importSource === 'brevo' ? 'Brevo' : 'SparkPost'} account.
              </p>
            </div>
            <button
              onClick={() => setShowImportModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary transition-all cursor-pointer flex-shrink-0"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Provider selector tabs */}
          <div className="flex bg-surface-secondary rounded-full p-1 border border-border-light">
            <button
              type="button"
              onClick={() => { setImportSource('brevo'); setImportApiKey(''); setImportVpsUrl(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${importSource === 'brevo'
                ? 'bg-[#131416] text-white shadow-sm'
                : 'text-fg-secondary hover:text-fg'
                }`}
            >
              Brevo
            </button>
            <button
              type="button"
              onClick={() => { setImportSource('sparkpost'); setImportApiKey(''); setImportVpsUrl(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${importSource === 'sparkpost'
                ? 'bg-[#131416] text-white shadow-sm'
                : 'text-fg-secondary hover:text-fg'
                }`}
            >
              SparkPost
            </button>
            <button
              type="button"
              onClick={() => { setImportSource('vps'); setImportApiKey(''); setImportVpsUrl(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${importSource === 'vps'
                ? 'bg-[#131416] text-white shadow-sm'
                : 'text-fg-secondary hover:text-fg'
                }`}
            >
              VPS (Postal)
            </button>
          </div>

          <form onSubmit={handleImportSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              {importSource === 'brevo' ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">Brevo API Key (v3)</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    name="importApiKey"
                    type="password"
                    placeholder="xkeysib-..."
                    value={importApiKey}
                    onChange={(e) => setImportApiKey(e.target.value)}
                    disabled={isImporting}
                    required
                  />
                  <span className="text-[10px] text-fg-muted pl-1 leading-normal mt-1">
                    You can generate this key in your Brevo Console under <strong>SMTP & API &gt; API Keys</strong>. It is only used to sync senders and is never saved.
                  </span>
                </label>
              ) : importSource === 'sparkpost' ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-fg-secondary pl-1">SparkPost API Key</span>
                  <input
                    className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                    name="importApiKey"
                    type="password"
                    placeholder="Enter SparkPost API Key"
                    value={importApiKey}
                    onChange={(e) => setImportApiKey(e.target.value)}
                    disabled={isImporting}
                    required
                  />
                  <span className="text-[10px] text-fg-muted pl-1 leading-normal mt-1">
                    Enter your SparkPost API Key. Ensure it has the <strong>Sending Domains: Read</strong> permission enabled. It is only used to sync domains and is never saved.
                  </span>
                </label>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-fg-secondary pl-1">Postal Server URL</span>
                    <input
                      className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                      name="importVpsUrl"
                      type="text"
                      placeholder="https://postal.your-server.com"
                      value={importVpsUrl}
                      onChange={(e) => setImportVpsUrl(e.target.value)}
                      disabled={isImporting}
                      required
                    />
                    <span className="text-[10px] text-fg-muted pl-1 leading-normal mt-1">
                      The base URL of your self-hosted Postal server.
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-fg-secondary pl-1">Postal API Key</span>
                    <input
                      className="w-full h-11 px-4.5 bg-surface-secondary border border-transparent rounded-full outline-none text-sm text-fg placeholder:text-fg-muted focus:border-border focus:bg-white focus:ring-2 focus:ring-accent/5 transition-all disabled:opacity-50 font-medium"
                      name="importApiKey"
                      type="password"
                      placeholder="Your Postal API key"
                      value={importApiKey}
                      onChange={(e) => setImportApiKey(e.target.value)}
                      disabled={isImporting}
                      required
                    />
                    <span className="text-[10px] text-fg-muted pl-1 leading-normal mt-1">
                      Your Postal root API key or server API key. Used to fetch configured domains from the Postal server.
                    </span>
                  </label>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-white border border-border-light text-fg-secondary hover:bg-surface-secondary transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isImporting || !importApiKey}
                className="inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10"
              >
                {isImporting ? 'Syncing...' : 'Fetch and Import'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const TestEmailModal = () => {
    if (!showTestModal || !testModalDomain) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTestModal(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-[28px] shadow-2xl border border-border-light max-w-md w-full overflow-hidden p-8 flex flex-col gap-6 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={() => setShowTestModal(false)}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-secondary text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {!testModalSuccess ? (
            <form onSubmit={handleModalSendTest} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Test Sending Domain</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Send a verification message through <strong className="text-slate-800">{testModalDomain.domainName}</strong> to check if DNS records and SMTP accounts are working correctly.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700 pl-1">Recipient Email Address</span>
                  <input
                    className="w-full h-11 px-4.5 bg-slate-50 border border-slate-200 rounded-full outline-none text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:bg-white transition-all font-medium shadow-inner"
                    type="email"
                    placeholder="recipient@example.com"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    required
                    disabled={isSendingTestModal}
                  />
                </label>

                {testModalError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-700 leading-relaxed flex gap-2">
                    <svg className="flex-shrink-0 w-4 h-4 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{testModalError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 transition-all cursor-pointer"
                  disabled={isSendingTestModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTestModal || !testEmailAddress}
                  className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-accent/10"
                >
                  {isSendingTestModal ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <span>Send Test</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center py-4 gap-6 animate-scale-up">
              {/* Success Circular Checkmark Animation Container */}
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-500 mb-2">
                <svg className="w-10 h-10 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-25" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-extrabold text-slate-900 leading-tight">Email Sent Successfully!</h3>
                <p className="text-xs text-slate-500 font-medium max-w-xs leading-relaxed">
                  The test message has been routed through <strong className="text-slate-800">{testModalDomain.domainName}</strong> (via {testModalDomain.provider || 'custom'}) to <strong className="text-slate-800">{testEmailAddress}</strong>.
                </p>
              </div>

              <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-150/60 w-full flex items-start gap-2.5 text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 flex-shrink-0 mt-0.5 animate-pulse">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-emerald-950">Testing is Successful!</span>
                  <span className="text-[10px] text-emerald-700 leading-normal">
                    This confirms the SMTP credentials match the domain sender configuration and SPF/DKIM policies align.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="w-full inline-flex items-center justify-center h-11 px-6 rounded-full text-xs font-bold bg-[#131416] hover:bg-accent-hover text-white transition-all cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SetupGuideModal />
      <AddDomainModal />
      <ImportModal />
      <TestEmailModal />
      <section className="flex flex-col gap-8 p-14 max-w-[1240px] mx-auto font-sans text-fg">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">Sending Domains</h1>
            <p className="text-xs text-slate-400 mt-2 font-medium">Verify your sending domains to optimize inbox placement and deliverability.</p>
          </div>
          <div className="flex items-center gap-2.5">
            {canAddDomain && (
              <>
                <button
                  onClick={() => { setImportSource('brevo'); setShowImportModal(true); }}
                  className="inline-flex items-center justify-center gap-2 px-5 h-10 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-2xl shadow-sm hover:bg-slate-50 transition-all cursor-pointer active:scale-98"
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Provider</span>
                </button>


                <button
                  onClick={handleImportAzureClick}
                  disabled={isImportingAzure}
                  className="inline-flex items-center justify-center gap-2 px-5 h-10 bg-blue-500 border border-slate-200 text-xs font-bold text-white -slate-700 rounded-2xl shadow-sm hover:bg-slate-50 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  type="button"
                >
                  {isImportingAzure ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-1" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Azure</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 h-10 bg-[#131416] text-xs font-bold text-white rounded-2xl shadow-md hover:bg-accent-hover hover:shadow-lg transition-all cursor-pointer active:scale-98"
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add Domain</span>
                </button>
              </>
            )}
            <button
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center justify-center h-10 w-10 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 rounded-2xl shadow-sm hover:border-slate-350 transition-all cursor-pointer flex-shrink-0"
              type="button"
              title="Setup Guide"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="9.09" y1="9" x2="9.12" y2="9.01" /><path d="M12 16h.01" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /></svg>
            </button>
            <button
              onClick={onRefresh}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-2xl shadow-sm hover:bg-slate-50 transition-all cursor-pointer flex-shrink-0"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        {domains.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 select-none animate-fadeIn">
            {[
              { label: 'Total Domains', value: domains.length, desc: 'Configured hosts', color: 'text-white', bg: 'bg-gradient-to-br from-blue-500 to-blue-900' },
              { label: 'Active Domains', value: domains.filter(d => d.status === 'Active').length, desc: 'Fully authenticated', color: 'text-white', bg: 'bg-gradient-to-br from-blue-500 to-blue-900' },
              { label: 'Pending setup', value: domains.filter(d => d.status === 'Pending Verification').length, desc: 'Awaiting DNS verification', color: 'text-white', bg: 'bg-gradient-to-br from-blue-500 to-blue-900' },
              { label: 'Total SMTP Sent', value: domains.reduce((acc, d) => acc + (d.totalEmailsSent || 0), 0).toLocaleString(), desc: 'All-time relays', color: 'text-white', bg: 'bg-gradient-to-br from-blue-500 to-blue-900' }
            ].map((stat, idx) => (
              <div key={idx} className={`rounded-[22px] p-5 py-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between  ${stat.bg}`}>
                <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">{stat.label}</span>
                <div className="flex flex-col mt-2">
                  <span className={`text-2xl font-black leading-none tracking-tight ${stat.color}`}>{stat.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="w-full flex flex-col gap-6">
          {/* Domains List */}
          {domains.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-[24px] bg-white shadow-sm flex flex-col items-center justify-center gap-4 max-w-xl mx-auto w-full">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-450">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-bold text-slate-800">No Domains Added Yet</p>
                <p className="text-xs text-slate-400 max-w-[280px]">Add a verified sending domain to get campaigns operational.</p>
              </div>
              {canAddDomain && (
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  <button
                    onClick={() => { setImportSource('brevo'); setShowImportModal(true); }}
                    className="inline-flex items-center justify-center h-10 px-5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-full shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                    type="button"
                  >
                    Import Senders from Brevo
                  </button>
                  <button
                    onClick={() => { setImportSource('sparkpost'); setShowImportModal(true); }}
                    className="inline-flex items-center justify-center h-10 px-5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-full shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                    type="button"
                  >
                    Import Senders from SparkPost
                  </button>
                  <button
                    onClick={() => { setImportSource('vps'); setShowImportModal(true); }}
                    className="inline-flex items-center justify-center h-10 px-5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-full shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                    type="button"
                  >
                    Import from VPS (Postal)
                  </button>
                  <button
                    onClick={handleImportAzureClick}
                    disabled={isImportingAzure}
                    className="inline-flex items-center justify-center h-10 px-5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-full shadow-sm hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                    type="button"
                  >
                    {isImportingAzure ? 'Syncing Azure...' : 'Import Senders from Azure'}
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center justify-center h-10 px-5 bg-[#131416] text-xs font-bold text-white rounded-full shadow-md hover:bg-accent-hover transition-all cursor-pointer"
                    type="button"
                  >
                    Add Your First Domain
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-6 w-1/4">Domain</th>
                      <th className="py-3 px-4 w-28">Provider</th>
                      <th className="py-3 px-4 w-32">Status</th>
                      <th className="py-3 px-4 w-52">Daily Usage</th>
                      <th className="py-3 px-4 w-24">Total Sent</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  {domains.map((domain) => {
                    const usage = domain.dailyUsage || 0;
                    const limit = domain.dailyLimit || 1;
                    const usagePercent = Math.min(Math.round((usage / limit) * 100), 100);
                    const status = domain.status;
                    const isVerifying = verifyingDomains[domain._id];
                    const isExpanded = expandedDomainId === domain._id;

                    let statusBadgeStyle = 'bg-slate-50 text-slate-400 border-slate-200';
                    let statusDotStyle = 'bg-slate-350';
                    if (status === 'Active') {
                      statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100/85 shadow-sm shadow-emerald-500/5';
                      statusDotStyle = 'bg-emerald-500';
                    } else if (status === 'Pending Verification') {
                      statusBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-100/85 shadow-sm shadow-amber-500/5';
                      statusDotStyle = 'bg-amber-500';
                    } else if (status === 'Disabled') {
                      statusBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-100/85';
                      statusDotStyle = 'bg-rose-500';
                    }

                    return (
                      <tbody key={domain._id} className="divide-y divide-slate-100 border-b border-slate-100 last:border-0 bg-white">
                        <tr className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-4.5 px-6 font-sans">
                            <div className="flex items-center gap-2">
                              <span
                                onClick={() => navigate(`/domains/${domain._id}`)}
                                className="text-sm font-extrabold text-slate-800 hover:text-blue-600 transition-colors hover:underline cursor-pointer"
                              >
                                {domain.domainName}
                              </span>
                              {domain.verified && (
                                <span className="inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  <span>Verified</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium mt-1 truncate max-w-[200px]" title={`${domain.senderName} <${domain.senderEmail}>`}>
                              {domain.senderName} &middot; <span className="font-mono">{domain.senderEmail}</span>
                            </div>
                          </td>

                          <td className="py-4.5 px-4">
                            <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase border ${domain.provider === 'brevo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : domain.provider === 'sparkpost'
                                ? 'bg-amber-50 text-brand-orange border-amber-100'
                                : domain.provider === 'vps'
                                  ? 'bg-purple-50 text-purple-700 border-purple-100'
                                  : domain.provider === 'azure'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : 'bg-slate-50 text-slate-700 border-slate-100'
                              }`}>
                              {domain.provider || 'custom'}
                            </span>
                          </td>

                          <td className="py-4.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${statusBadgeStyle}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyle}`} />
                              {status}
                            </span>
                          </td>



                          <td className="py-4.5 px-4">
                            <div className="flex flex-col gap-1 w-full max-w-[150px]">
                              <div className="h-2.5 bg-slate-300 rounded-full overflow-hidden ">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 90
                                    ? 'bg-red-500'
                                    : usagePercent >= 70
                                      ? 'bg-orange-500'
                                      : 'bg-blue-500'
                                    }`}
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold leading-none mt-1">
                                {usage.toLocaleString()} / {limit.toLocaleString()}
                              </span>
                            </div>
                          </td>

                          <td className="py-4.5 px-4">
                            <span className="text-xs font-bold text-slate-700">{domain.totalEmailsSent?.toLocaleString() || 0}</span>
                          </td>

                          <td className="py-4.5 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleVerify(domain._id)}
                                disabled={isVerifying}
                                className="inline-flex items-center justify-center h-8.5 px-3 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-650 hover:bg-slate-50 transition-all disabled:opacity-50 cursor-pointer active:scale-95 shadow-sm"
                                type="button"
                                title="Verify DNS Records"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`${isVerifying ? 'animate-spin' : ''}`}>
                                  <polyline points="23 4 23 10 17 10" />
                                  <polyline points="1 20 1 14 7 14" />
                                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                </svg>
                              </button>

                              <button
                                onClick={() => handleOpenTestModal(domain)}
                                className="inline-flex items-center justify-center gap-1 h-8.5 px-3 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-650 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all cursor-pointer active:scale-95 shadow-sm"
                                type="button"
                                title="Send Test Email"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="22" y1="2" x2="11" y2="13" />
                                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                                <span className="text-[10px]">Test</span>
                              </button>

                              <button
                                onClick={() => toggleExpanded(domain._id)}
                                className={`inline-flex items-center justify-center h-8.5 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm ${isExpanded
                                  ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-900/90'
                                  : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                                  }`}
                                type="button"
                                title="DNS Records Accordion"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                  className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>

                              <button
                                onClick={() => navigate(`/domains/${domain._id}`)}
                                className="inline-flex items-center justify-center h-8.5 w-8.5 border border-slate-200 rounded-xl bg-white text-slate-450 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer active:scale-95 shadow-sm"
                                type="button"
                                title="Edit Settings"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="3" />
                                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                              </button>

                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete ${domain.domainName}? This action cannot be undone.`)) {
                                    onDeleteDomain(domain._id);
                                  }
                                }}
                                className="inline-flex items-center justify-center h-8.5 w-8.5 border border-slate-200 rounded-xl bg-white text-slate-450 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-250 transition-all cursor-pointer active:scale-95 shadow-sm"
                                type="button"
                                title="Delete Domain"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/20">
                            <td colSpan="7" className="p-6 border-t border-slate-100">
                              <DnsSetupTable
                                domain={domain}
                                dkimResult={dkimResult}
                                generatingDkim={generatingDkim}
                                handleGenerateDkim={handleGenerateDkim}
                                handleDownloadZoneFile={handleDownloadZoneFile}
                                testEmailInputs={testEmailInputs}
                                setTestEmailInputs={setTestEmailInputs}
                                handleSendTest={handleSendTest}
                                sendingTest={sendingTest}
                                copiedField={copiedField}
                                copyToClipboard={copyToClipboard}
                                transportMode={transportMode}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

const DnsSetupTable = ({
  domain,
  dkimResult,
  generatingDkim,
  handleGenerateDkim,
  handleDownloadZoneFile,
  testEmailInputs,
  setTestEmailInputs,
  handleSendTest,
  sendingTest,
  copiedField,
  copyToClipboard,
  transportMode
}) => {
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  const provider = domain.provider || 'custom';
  const isBrevo = provider === 'brevo';
  const isSparkPost = provider === 'sparkpost';

  const spfRecord = buildSpfRecord(provider);
  const dmarcRecord = buildDmarcRecord(domain.domainName);

  const dkimSelector = isBrevo
    ? 'mailin'
    : isSparkPost
      ? 'sparkpost'
      : (provider === 'vps' ? 'postal-xxxx' : (domain.dkimSelector || 'default'));

  const dkimRecord = isBrevo
    ? 'Configure and copy DKIM key from your Brevo Dashboard'
    : isSparkPost
      ? 'Refer to SparkPost Sending Domains dashboard'
      : provider === 'vps'
        ? 'Copy the exact DKIM record from your Postal Web Interface -> Domains'
        : (domain.dkimPublicKey
          ? `v=DKIM1; k=rsa; p=${domain.dkimPublicKey}`
          : 'Generate DKIM keys below');

  const dkimHostname = `${dkimSelector}._domainkey`;
  const hasDkim = !isBrevo && !isSparkPost && provider !== 'vps' && !!domain.dkimPublicKey;

  const v = domain.verificationDetails;

  const dnsRecords = [
    {
      id: 'spf',
      type: 'TXT',
      name: '@',
      value: spfRecord,
      description: isBrevo
        ? 'Sender Policy Framework — authorizes Brevo to send emails on behalf of your domain'
        : isSparkPost
          ? 'Sender Policy Framework — authorizes SparkPost to send emails on behalf of your domain'
          : provider === 'azure'
            ? 'Sender Policy Framework — authorizes Azure Email Service to send emails on behalf of your domain'
            : 'Sender Policy Framework — authorizes Mailer to send emails on behalf of your domain',
      verified: v?.spf?.exists,
      liveValue: v?.spf?.record
    },
    {
      id: 'dkim',
      type: 'TXT',
      name: dkimHostname,
      value: dkimRecord,
      description: isBrevo
        ? 'DKIM is automatically handled by Brevo. Add the unique mailin._domainkey TXT record from your Brevo Console.'
        : isSparkPost
          ? 'DKIM is managed by SparkPost. Refer to your SparkPost dashboard (Configuration > Sending Domains) to copy the exact DKIM record details.'
          : provider === 'vps'
            ? 'DKIM is managed by Postal. Copy the exact DKIM TXT record provided in the Postal web interface.'
            : 'DomainKeys Identified Mail — cryptographic signature to verify sender authenticity',
      verified: v?.dkim?.exists,
      liveValue: v?.dkim?.record,
      needsGeneration: !isBrevo && !isSparkPost && provider !== 'vps' && !domain.dkimPublicKey
    },
    {
      id: 'dmarc',
      type: 'TXT',
      name: `_dmarc.${domain.domainName}`,
      value: dmarcRecord,
      description: 'Domain-based Message Authentication — instructs providers what to do with failed authentication',
      verified: v?.dmarc?.exists,
      liveValue: v?.dmarc?.record
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header Panel with Action */}
      <div className="flex items-center justify-between flex-wrap gap-2" onClick={e => e.stopPropagation()}>
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">DNS Records Setup</h4>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Configure these records at your DNS host (Cloudflare, Namecheap, etc.)</span>
        </div>
        {hasDkim && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDownloadZoneFile(domain); }}
            className="inline-flex items-center gap-1.5 h-7 px-3.5 rounded-full text-[10px] font-bold bg-[#131416] text-white hover:bg-accent-hover transition-all cursor-pointer shadow-sm active:scale-95"
            type="button"
            title="Download zone file for easy import"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            <span>Zone File</span>
          </button>
        )}
      </div>

      {/* Accordion Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3 px-4 w-12 text-center font-bold">Status</th>
                <th className="py-3 px-4 w-28 font-bold">Type</th>
                <th className="py-3 px-4 w-1/4 font-bold">Host</th>
                <th className="py-3 px-4 font-bold">Value</th>
                <th className="py-3 px-4 w-12 font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dnsRecords.map((record) => {
                const isExpanded = expandedRecordId === record.id;
                return (
                  <React.Fragment key={record.id}>
                    <tr
                      onClick={(e) => { e.stopPropagation(); setExpandedRecordId(isExpanded ? null : record.id); }}
                      className="hover:bg-slate-50/20 transition-colors cursor-pointer select-none"
                    >
                      {/* Status indicator */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          {record.verified ? (
                            <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center" title="Verified">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center" title="Pending Verification">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type/Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-slate-50 text-slate-500 border border-slate-200/60">
                            {record.type}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800">
                            {record.id.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Hostname */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 max-w-[170px]" onClick={e => e.stopPropagation()}>
                          <code className="text-[10px] font-mono text-slate-700 bg-slate-50 rounded px-1.5 py-0.5 border border-slate-200 truncate" title={record.name}>
                            {record.name}
                          </code>
                          {!record.needsGeneration && (
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(record.name, `${record.id}-host-${domain._id}`); }}
                              className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                              type="button"
                              title="Copy Host"
                            >
                              {copiedField === `${record.id}-host-${domain._id}` ? (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-600"><polyline points="20 6 9 17 4 12" /></svg>
                              ) : (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Record value */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 max-w-xs" onClick={e => e.stopPropagation()}>
                          {record.needsGeneration ? (
                            <span className="text-[10px] text-amber-600 font-semibold bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-100 animate-pulse">
                              DKIM keys required
                            </span>
                          ) : (
                            <>
                              <code className="text-[10px] font-mono text-slate-700 bg-slate-50 rounded px-1.5 py-0.5 border border-slate-200 truncate flex-1" title={record.value}>
                                {record.value}
                              </code>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(record.value, `${record.id}-value-${domain._id}`); }}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer flex-shrink-0"
                                type="button"
                                title="Copy Value"
                              >
                                {copiedField === `${record.id}-value-${domain._id}` ? (
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-600"><polyline points="20 6 9 17 4 12" /></svg>
                                ) : (
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Caret */}
                      <td className="py-3.5 px-4 text-right">
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expand details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 border-t border-slate-100">
                        <td colSpan="5" className="p-5">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-sans">Description</span>
                              <p className="text-xs text-slate-650 font-medium leading-relaxed font-sans">{record.description}</p>
                            </div>

                            {record.needsGeneration ? (
                              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/50 flex items-center justify-between flex-wrap gap-3" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                  <span>Generate DKIM keys to activate this record.</span>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleGenerateDkim(domain._id); }}
                                  disabled={generatingDkim[domain._id]}
                                  className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-bold bg-[#131416] text-white hover:bg-accent-hover transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
                                  type="button"
                                >
                                  {generatingDkim[domain._id] ? 'Generating...' : 'Generate DKIM Keys'}
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" onClick={e => e.stopPropagation()}>
                                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wider font-sans">Expected Value</span>
                                      <button
                                        onClick={() => copyToClipboard(record.value, `${record.id}-expected-${domain._id}`)}
                                        className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-800 hover:bg-slate-105 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 transition-all cursor-pointer"
                                        type="button"
                                      >
                                        {copiedField === `${record.id}-expected-${domain._id}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <code className="text-[10.5px] font-mono text-slate-700 break-all leading-relaxed select-all">
                                      {record.value}
                                    </code>
                                  </div>
                                </div>

                                <div className={`rounded-2xl p-4 border shadow-sm ${record.verified
                                  ? 'bg-emerald-50/20 border-emerald-200/60 text-emerald-900'
                                  : 'bg-amber-50/20 border-amber-200/60 text-amber-900'
                                  }`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider font-sans">
                                      Current DNS Value
                                    </span>
                                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${record.verified
                                      ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200/30'
                                      : 'bg-amber-100/70 text-amber-850 border border-amber-200/30'
                                      }`}>
                                      {record.verified ? 'Match' : 'Mismatch'}
                                    </span>
                                  </div>

                                  {record.liveValue ? (
                                    <code className="text-[10.5px] font-mono block break-all leading-relaxed">
                                      {record.liveValue}
                                    </code>
                                  ) : (
                                    <p className="text-[10.5px] italic text-slate-400 font-sans">No resolved records found.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Delivery */}
      {domain.verified && (
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">Test Delivery</h4>
          <div className="flex gap-2 animate-fade-in">
            <input
              className="flex-1 h-9 px-4.5 bg-slate-50 border border-slate-200 rounded-full outline-none text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:bg-white transition-all font-medium font-sans shadow-inner"
              type="email"
              placeholder="recipient@example.com"
              value={testEmailInputs[domain._id] || ''}
              onChange={(e) => {
                e.stopPropagation();
                setTestEmailInputs((prev) => ({ ...prev, [domain._id]: e.target.value }));
              }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleSendTest(domain._id); }}
              disabled={sendingTest[domain._id] || !testEmailInputs[domain._id]}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-xs font-bold bg-[#131416] text-white hover:bg-accent-hover hover:shadow-md transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
              type="button"
            >
              {sendingTest[domain._id] ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              )}
              <span>Send Test</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
