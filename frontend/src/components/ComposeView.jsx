import { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MagnifierLinear } from '@solar-icons/react-perf';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ComposeView({
  domains,
  onSaveCampaign
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(location.state?.editCampaign);
  const initialCampaign = location.state?.editCampaign || location.state?.duplicateCampaign;
  const initialEmails = location.state?.importedEmails;

  const parseEmailsToRecipients = (emails) =>
    emails.map((email) => ({ name: '', email: email.trim(), status: 'pending' }));

  const [importedRecipients, setImportedRecipients] = useState(
    initialEmails ? parseEmailsToRecipients(initialEmails) : []
  );

  const [formData, setFormData] = useState({
    name: initialCampaign ? (isEdit ? initialCampaign.name : `${initialCampaign.name} (Copy)`) : '',
    subject: initialCampaign ? initialCampaign.subject : '',
    htmlContent: initialCampaign ? initialCampaign.htmlContent : `Hi {{name}},<br/><br/>I hope this message finds you well. I came across your profile and was impressed by your work at your company.<br/><br/>I wanted to share a resource that I think you'll find valuable. It covers some insights on [topic] that many professionals in your field have found useful.<br/><br/>You can check it out here: <a href="https://yourdomain.com/resource">https://yourdomain.com/resource</a><br/><br/>Let me know if you have any questions — happy to help.<br/><br/>Best regards,<br/><br/><strong>Your Name</strong><br/>Your Title<br/>Your Company`,
    recipients: initialEmails?.length > 0
      ? initialEmails.join('\n')
      : (initialCampaign ? initialCampaign.recipients.map(r => r.name ? `${r.name}, ${r.email}` : r.email).join('\n') : ''),
    senderRotationMode: initialCampaign ? initialCampaign.senderRotationMode : 'Fixed',
    delayType: initialCampaign ? (initialCampaign.delaySettings?.type || 'fixed') : 'fixed',
    fixedValue: initialCampaign ? String(initialCampaign.delaySettings?.fixedValue ?? '0') : '0',
    min: initialCampaign ? String(initialCampaign.delaySettings?.min ?? '0') : '0',
    max: initialCampaign ? String(initialCampaign.delaySettings?.max ?? '0') : '0'
  });

  const [selectedDomains, setSelectedDomains] = useState(() => {
    if (initialCampaign && initialCampaign.selectedDomains) {
      return initialCampaign.selectedDomains.map(d => d._id || d);
    }
    return [];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState(initialCampaign?.attachments || []);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'preview'
  const [isVisual, setIsVisual] = useState(true); // visual editor vs HTML source code
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRecipientsModalOpen, setIsRecipientsModalOpen] = useState(false);
  const [modalRecipients, setModalRecipients] = useState('');
  const modalTextareaRef = useRef(null);

  // Left sidebar collapse controls
  const [openSections, setOpenSections] = useState({
    recipients: true,
    domains: false,
    delivery: false,
    attachments: false
  });

  // Custom UI dropdown open controls
  const [isFromListOpen, setIsFromListOpen] = useState(false);
  const [isVariableDropdownOpen, setIsVariableDropdownOpen] = useState(false);
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);

  // Additional header fields
  const [showHeaderFields, setShowHeaderFields] = useState({
    replyTo: false,
    bcc: false,
    custom: false
  });
  const [replyToEmail, setReplyToEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [customHeaderKey, setCustomHeaderKey] = useState('');
  const [customHeaderValue, setCustomHeaderValue] = useState('');
  const [activeCustomHeaders, setActiveCustomHeaders] = useState([]);

  const fileInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const editorRef = useRef(null);
  const textareaRef = useRef(null);

  const activeDomains = domains.filter((d) => d.status === 'Active');

  // If no domains are configured, show a mockup sender so the UI looks exactly like the screenshot
  const displayDomains = activeDomains.length > 0
    ? activeDomains
    : [{ _id: 'mock-1', domainName: 'yourdomain.com', senderEmail: 'info@yourdomain.com', status: 'Active' }];

  // Automatically select the first domain if none selected
  useEffect(() => {
    if (selectedDomains.length === 0 && displayDomains.length > 0) {
      setSelectedDomains([displayDomains[0]._id]);
    }
  }, [domains]);

  const selectedFromDomain = displayDomains.find(d => selectedDomains.includes(d._id)) || displayDomains[0];

  // Sync contentEditable content only when switching editor mode
  useEffect(() => {
    if (isVisual && editorRef.current) {
      if (editorRef.current.innerHTML !== formData.htmlContent) {
        editorRef.current.innerHTML = formData.htmlContent;
      }
    }
  }, [isVisual]);

  // Sync modal recipients when opening modal
  useEffect(() => {
    if (isRecipientsModalOpen) {
      setModalRecipients(formData.recipients);
    }
  }, [isRecipientsModalOpen, formData.recipients]);

  // Handle keys (Escape to close, Cmd/Ctrl + Enter to save)
  useEffect(() => {
    if (!isRecipientsModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsRecipientsModalOpen(false);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFormData((prev) => ({ ...prev, recipients: modalRecipients }));
        setHasUnsavedChanges(true);
        setIsRecipientsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecipientsModalOpen, modalRecipients]);

  // Autofocus input in modal
  useEffect(() => {
    if (isRecipientsModalOpen) {
      const timer = setTimeout(() => {
        if (modalTextareaRef.current) {
          modalTextareaRef.current.focus();
          const length = modalTextareaRef.current.value.length;
          modalTextareaRef.current.setSelectionRange(length, length);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isRecipientsModalOpen]);

  const parseRecipients = (text) => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((part) => part.trim());
        const email = parts.length === 1 ? parts[0] : parts.at(-1);
        const name = parts.length === 1 ? '' : parts.slice(0, -1).join(' ');
        return { name, email };
      })
      .filter((r) => r.email && r.email.includes('@'));
  };

  const parsedRecipients = useMemo(() => parseRecipients(formData.recipients), [formData.recipients]);
  const totalRecipients = parsedRecipients.length;
  const selectedRecipient = totalRecipients > 0 ? parsedRecipients[0] : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasUnsavedChanges(true);
  };

  const handleDomainCheckboxChange = (domainId) => {
    setSelectedDomains((prev) =>
      prev.includes(domainId)
        ? prev.filter((id) => id !== domainId)
        : [...prev, domainId]
    );
    setHasUnsavedChanges(true);
  };

  const toggleSection = (sectionName) => {
    setOpenSections((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim());

  const findEmailColumnIndex = (headerRow) => {
    if (!headerRow || headerRow.length === 0) return -1;
    const emailKeywords = ['email', 'e-mail', 'mail', 'correo', '电子邮件'];
    for (let i = 0; i < headerRow.length; i++) {
      const val = String(headerRow[i] ?? '').trim().toLowerCase().replace(/^[^a-z]/, '');
      if (emailKeywords.includes(val) || val.includes('@')) return i;
    }
    return -1;
  };

  const extractEmails = (rows) => {
    const emails = [];
    const seen = new Set();

    if (rows.length === 0) return emails;

    const colIndex = findEmailColumnIndex(rows[0]);

    if (colIndex >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const val = String(row[colIndex] ?? '').trim();
        if (isEmail(val) && !seen.has(val.toLowerCase())) {
          seen.add(val.toLowerCase());
          emails.push(val);
        }
      }
      if (emails.length > 0) return emails;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] ?? '').trim();
        if (isEmail(val) && !seen.has(val.toLowerCase())) {
          seen.add(val.toLowerCase());
          emails.push(val);
        }
      }
    }

    return emails;
  };

  const [importedCount, setImportedCount] = useState(null);

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportedCount(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const emails = extractEmails(rows);

      if (emails.length === 0) {
        alert('No valid email addresses found in the file.');
        return;
      }

      if (emails.length > 500) {
        setImportedRecipients((prev) => [
          ...prev,
          ...emails.map((email) => ({ name: '', email: email.trim(), status: 'pending' }))
        ]);
      }
      setFormData((prev) => {
        const existing = prev.recipients.trim();
        return {
          ...prev,
          recipients: existing ? `${existing}\n${emails.join('\n')}` : emails.join('\n')
        };
      });
      setImportedCount(emails.length);
      setHasUnsavedChanges(true);
    } catch (err) {
      alert('Failed to parse file: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAttachmentAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check size limit: total attachments + new files should not exceed ~1.5MB
    const currentSize = attachments.reduce((sum, att) => sum + (att.content ? atob(att.content).length : 0), 0);
    const newFilesSize = files.reduce((sum, f) => sum + f.size, 0);

    if (currentSize + newFilesSize > 250 * 1024) {
      alert('Total attachment size exceeds the 250KB limit. Please upload smaller files.');
      return;
    }

    const readers = files.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            filename: file.name,
            contentType: file.type,
            content: reader.result.split(',')[1]
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((newAttachments) => {
      setAttachments((prev) => [...prev, ...newAttachments]);
      setHasUnsavedChanges(true);
    });

    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const handleEditorInput = (e) => {
    setFormData((prev) => ({ ...prev, htmlContent: e.target.innerHTML }));
    setHasUnsavedChanges(true);
  };

  const handleEditorBlur = () => {
    if (editorRef.current) {
      setFormData((prev) => ({ ...prev, htmlContent: editorRef.current.innerHTML }));
    }
  };

  const applyFormat = (command, value = null) => {
    if (isVisual) {
      document.execCommand(command, false, value);
      if (editorRef.current) {
        setFormData((prev) => ({ ...prev, htmlContent: editorRef.current.innerHTML }));
        setHasUnsavedChanges(true);
      }
    }
  };

  const insertLink = () => {
    const url = prompt('Enter link URL:');
    if (url) {
      applyFormat('createLink', url);
    }
  };

  const insertAtCursor = (text) => {
    if (isVisual) {
      if (editorRef.current) editorRef.current.focus();
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      setFormData((prev) => ({ ...prev, htmlContent: editorRef.current.innerHTML }));
    } else {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = formData.htmlContent;
      const newVal = val.substring(0, start) + text + val.substring(end);
      setFormData((prev) => ({ ...prev, htmlContent: newVal }));
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
      }, 10);
    }
    setHasUnsavedChanges(true);
  };

  const addCustomHeader = () => {
    if (!customHeaderKey.trim() || !customHeaderValue.trim()) return;
    setActiveCustomHeaders(prev => [...prev, { key: customHeaderKey.trim(), value: customHeaderValue.trim() }]);
    setCustomHeaderKey('');
    setCustomHeaderValue('');
    setHasUnsavedChanges(true);
  };

  const removeCustomHeader = (index) => {
    setActiveCustomHeaders(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (selectedDomains.length === 0) {
      alert('Select at least one active sending domain.');
      return;
    }

    setIsSaving(true);
    try {
      const delaySettings =
        formData.delayType === 'fixed'
          ? { type: 'fixed', fixedValue: Number(formData.fixedValue), min: 0, max: 0 }
          : { type: 'random', fixedValue: 0, min: Number(formData.min), max: Number(formData.max) };

      const payload = {
        name: formData.name.trim() || formData.subject.trim() || 'Untitled Campaign',
        subject: formData.subject,
        htmlContent: formData.htmlContent,
        recipientsRaw: formData.recipients,
        senderRotationMode: formData.senderRotationMode,
        selectedDomains,
        delaySettings,
        attachments: attachments.length > 0 ? attachments : undefined
      };

      await onSaveCampaign(payload, isEdit ? initialCampaign?._id : null);
      setHasUnsavedChanges(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // SidebarCard is defined outside ComposeView to avoid re-creation on re-render
  const renderSidebarCard = (title, sectionKey, children) => {
    const isOpen = openSections[sectionKey];
    return (
      <div className="border-b border-slate-100 last:border-0">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-6 py-5 flex items-center justify-between font-bold text-left cursor-pointer transition-colors hover:bg-slate-50/20"
        >
          <span className="text-xs font-black uppercase tracking-wider text-[#2e3e5c]">{title}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            className={`transform transition-transform duration-250 text-blue-500/80 ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {isOpen && (
          <div className="px-6 pb-6 pt-2 flex flex-col gap-4 bg-white">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col min-h-[calc(100vh-100px)] relative pb-24 p-14 ">




      {activeTab === 'content' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

          {/* Left Column Settings Sidebar */}
          <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden w-full h-fit flex flex-col">

            {/* Campaign Name Section */}
            <div className="px-6 py-5.5 border-b border-slate-100 flex flex-col gap-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#8a94a6]">Campaign Name</span>
              <input
                type="text"
                placeholder="e.g. Q3 Outbound Pitch"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                className="w-full h-10 px-4 bg-white border border-[#e2e8f0] rounded-[18px] outline-none text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/5 transition-all"
              />
            </div>

            {/* Section 2: Configure Recipients & Import */}
            {renderSidebarCard('Recipients & CSV Import', 'recipients',
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-[#8a94a6] uppercase tracking-wider">Recipients CSV/XLSX</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="h-9 px-4.5 bg-white border border-[#e2e8f0] rounded-[18px] text-[11px] font-bold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-500">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 12 15 15" />
                    </svg>
                    {isImporting ? 'Importing...' : 'Import'}
                  </button>
                </div>
                <div
                  onClick={() => setIsRecipientsModalOpen(true)}
                  className="w-full p-4 bg-slate-50/50 hover:bg-slate-50/80 border border-[#e6ecf4] hover:border-blue-500/30 rounded-[22px] outline-none text-xs font-semibold text-slate-700 transition-all cursor-pointer min-h-[90px] max-h-[160px] overflow-hidden relative group flex flex-col justify-center"
                >
                  {totalRecipients > 0 ? (
                    <div className="flex items-center gap-3 select-none">
                      {importedRecipients.length > 0 ? (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-blue-500">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" />
                            <line x1="16" y1="11" x2="22" y2="11" />
                          </svg>
                          <span className="text-xs font-extrabold text-blue-700">{importedRecipients.length.toLocaleString()} imported</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-emerald-500">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                          </svg>
                          <span className="text-xs font-extrabold text-emerald-700">{parsedRecipients.length.toLocaleString()} recipients</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] select-none flex flex-col items-center justify-center gap-1.5 py-4 w-full">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-slate-400/80">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="16" y1="11" x2="22" y2="11" />
                      </svg>
                      Click to add recipient emails
                    </div>
                  )}
                  {/* Subtle edit badge overlay on hover */}
                  <div className="absolute inset-0 bg-slate-900/[0.01] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="bg-white border border-slate-100 shadow-md text-slate-700 px-3 py-1.5 rounded-full text-[10px] font-extrabold flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Open Spotlight Editor
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-black text-[#8a94a6] uppercase tracking-wider">
                    {totalRecipients > 0 ? `${totalRecipients.toLocaleString()} total recipient(s)` : 'One email per line'}
                  </span>
                  {totalRecipients > 0 && (
                    <span className="text-[9.5px] font-black text-emerald-500 uppercase tracking-wider">
                      {totalRecipients} valid
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Sending Domains */}
            {renderSidebarCard('Active Sending Domains', 'domains',
              <div className="flex flex-col gap-2">
                {displayDomains.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-2">
                    No active domains configured.
                  </p>
                ) : (
                  displayDomains.map((domain) => {
                    const isChecked = selectedDomains.includes(domain._id);
                    return (
                      <label
                        key={domain._id}
                        className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition-all ${isChecked
                          ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-500/10 shadow-sm'
                          : 'border-slate-150 bg-white hover:border-slate-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-blue-600 cursor-pointer rounded"
                          checked={isChecked}
                          onChange={() => handleDomainCheckboxChange(domain._id)}
                          disabled={isSaving}
                        />
                        <div className="min-w-0 leading-none">
                          <span className="text-xs text-slate-800 font-extrabold block truncate">{domain.domainName}</span>
                          <span className="text-[9px] text-slate-400 truncate block font-bold mt-1">{domain.senderEmail}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}

            {/* Section 4: Delivery Configuration */}
            {renderSidebarCard('Delivery Settings', 'delivery',
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Rotation Mode</span>
                  <select
                    name="senderRotationMode"
                    value={formData.senderRotationMode}
                    onChange={handleChange}
                    className="w-full h-10 px-3 bg-white border border-border-light rounded-xl outline-none text-xs font-semibold text-fg-secondary cursor-pointer shadow-sm"
                  >
                    <option value="Fixed">Fixed Domain</option>
                    <option value="Random">Random Rotation</option>
                    <option value="Round-Robin">Round-Robin Rotation</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Delay Profile</span>
                  <select
                    name="delayType"
                    value={formData.delayType}
                    onChange={handleChange}
                    className="w-full h-10 px-3 bg-white border border-border-light rounded-xl outline-none text-xs font-semibold text-fg-secondary cursor-pointer shadow-sm"
                  >
                    <option value="fixed">Fixed Delay</option>
                    <option value="random">Random Interval</option>
                  </select>
                </label>

                {formData.delayType === 'fixed' ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Delay (Seconds)</span>
                    <input
                      name="fixedValue"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.fixedValue}
                      onChange={handleChange}
                      className="w-full h-10 px-3 bg-white border border-border-light rounded-xl outline-none text-xs font-semibold text-fg shadow-sm"
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Min (Sec)</span>
                      <input
                        name="min"
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.min}
                        onChange={handleChange}
                        className="w-full h-10 px-3 bg-white border border-border-light rounded-xl outline-none text-xs font-semibold text-fg shadow-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Max (Sec)</span>
                      <input
                        name="max"
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.max}
                        onChange={handleChange}
                        className="w-full h-10 px-3 bg-white border border-border-light rounded-xl outline-none text-xs font-semibold text-fg shadow-sm"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Section 5: Attachments */}
            {renderSidebarCard('Attachments', 'attachments',
              <div className="flex flex-col gap-2.5">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleAttachmentAdd}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="w-full h-10 border border-dashed border-border hover:border-fg-muted rounded-xl text-xs font-bold text-fg-muted hover:text-fg bg-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-fg-muted">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  Add Files
                </button>

                {attachments.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1 max-h-36 overflow-y-auto">
                    {attachments.map((att, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white border border-border-light rounded-xl px-3 py-2 text-xs font-semibold shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-fg-muted flex-shrink-0">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <span className="text-fg truncate max-w-[160px]">{att.filename}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(index)}
                          className="text-fg-muted hover:text-error transition-all flex-shrink-0 cursor-pointer ml-2"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column Composer */}
          <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col min-h-[750px] relative">

            {/* Field: From */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-3 px-6">
              <span className="text-xs font-bold text-slate-400 w-14">From:</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFromListOpen(!isFromListOpen)}
                  className="flex items-center gap-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-all text-left cursor-pointer bg-slate-50/50 rounded-full px-3.5 py-1.5 border border-transparent hover:border-slate-200"
                >
                  <div className="w-5.5 h-5.5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0 text-[10px]">
                    {selectedFromDomain ? selectedFromDomain.senderEmail.charAt(0).toUpperCase() : '?'}
                  </div>
                  <span className="truncate">{selectedFromDomain ? selectedFromDomain.senderEmail : 'Select Domain'}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 ml-0.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isFromListOpen && (
                  <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-100 rounded-xl shadow-lg z-30 py-1.5 flex flex-col items-start w-full">
                    {displayDomains.map((domain) => {
                      const isChecked = selectedDomains.includes(domain._id);
                      return (
                        <button
                          key={domain._id}
                          type="button"
                          onClick={() => {
                            if (!selectedDomains.includes(domain._id)) {
                              setSelectedDomains([domain._id]); // set primary domain
                            }
                            setIsFromListOpen(false);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="w-5.5 h-5.5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0 text-[9px]">
                            {domain.senderEmail.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-bold text-slate-800 leading-none">{domain.domainName}</div>
                            <div className="truncate text-[9px] text-slate-400 mt-1">{domain.senderEmail}</div>
                          </div>
                          {isChecked && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>


            {/* Field: Subject */}
            <div className="flex items-center gap-3 border-b border-slate-100 py-3 px-6">
              <span className="text-xs font-bold text-slate-400 w-14">Subject:</span>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Enter email subject"
                className="flex-1 border-none outline-none text-xs font-extrabold text-slate-800 placeholder:text-slate-400 bg-transparent py-1"
                required
              />
            </div>



            {/* Rich Editor Toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2 gap-2">
              <div className="flex flex-wrap items-center gap-1.5">

                {/* Variable inserter button & dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsVariableDropdownOpen(!isVariableDropdownOpen)}
                    className="p-1.5 text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors flex items-center justify-center cursor-pointer h-7 w-7 text-sm font-extrabold border border-border-light/60 bg-white"
                    title="Insert Placeholder"
                  >
                    ⊕
                  </button>
                  {isVariableDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-44 bg-white border border-border-light rounded-lg shadow-lg z-30 py-1 flex flex-col items-start w-full">
                      {[
                        { label: 'Recipient Name', value: '{{name}}' },
                        { label: 'Recipient Email', value: '{{email}}' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            insertVariable(item.value);
                            setIsVariableDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-surface-secondary text-fg-secondary hover:text-fg cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-px h-5 bg-border-light mx-1" />

                {/* Bold */}
                <button
                  type="button"
                  onClick={() => applyFormat('bold')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors font-extrabold text-xs cursor-pointer border border-border-light/60 bg-white"
                  title="Bold"
                >
                  B
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={() => applyFormat('italic')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors italic text-xs cursor-pointer border border-border-light/60 bg-white font-serif font-bold"
                  title="Italic"
                >
                  I
                </button>

                {/* Underline */}
                <button
                  type="button"
                  onClick={() => applyFormat('underline')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors underline text-xs cursor-pointer border border-border-light/60 bg-white font-bold"
                  title="Underline"
                >
                  U
                </button>

                <div className="w-px h-5 bg-border-light mx-1" />

                {/* Align Left */}
                <button
                  type="button"
                  onClick={() => applyFormat('justifyLeft')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors cursor-pointer border border-border-light/60 bg-white"
                  title="Align Left"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="17" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="17" y1="18" x2="3" y2="18" />
                  </svg>
                </button>

                {/* Align Center */}
                <button
                  type="button"
                  onClick={() => applyFormat('justifyCenter')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors cursor-pointer border border-border-light/60 bg-white"
                  title="Align Center"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="10" x2="6" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="18" y1="18" x2="6" y2="18" />
                  </svg>
                </button>

                {/* Align Right */}
                <button
                  type="button"
                  onClick={() => applyFormat('justifyRight')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors cursor-pointer border border-border-light/60 bg-white"
                  title="Align Right"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="21" y1="10" x2="7" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="7" y2="18" />
                  </svg>
                </button>

                {/* Align Justify */}
                <button
                  type="button"
                  onClick={() => applyFormat('justifyFull')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors cursor-pointer border border-border-light/60 bg-white"
                  title="Align Justify"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="21" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="3" y2="18" />
                  </svg>
                </button>

                <div className="w-px h-5 bg-border-light mx-1" />

                {/* Text style dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                    className="h-7 px-2 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors font-mono font-bold text-[10px] cursor-pointer border border-border-light/60 bg-white gap-0.5"
                    title="Styles"
                  >
                    T T
                    <span className="text-[7px]">▼</span>
                  </button>
                  {isHeaderDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-32 bg-white border border-border-light rounded-lg shadow-lg z-30 py-1 flex flex-col items-start w-full">
                      {[
                        { label: 'Heading 1', value: '<h1>' },
                        { label: 'Heading 2', value: '<h2>' },
                        { label: 'Heading 3', value: '<h3>' },
                        { label: 'Paragraph', value: '<p>' }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            applyFormat('formatBlock', item.value);
                            setIsHeaderDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-surface-secondary text-fg-secondary hover:text-fg cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quote (66) */}
                <button
                  type="button"
                  onClick={() => applyFormat('formatBlock', '<blockquote>')}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors font-serif font-bold text-xs cursor-pointer border border-border-light/60 bg-white"
                  title="Blockquote"
                >
                  66
                </button>

                {/* Link */}
                <button
                  type="button"
                  onClick={insertLink}
                  className="h-7 w-7 flex items-center justify-center text-fg-secondary hover:text-fg hover:bg-surface-secondary rounded transition-colors cursor-pointer border border-border-light/60 bg-white"
                  title="Link"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
              </div>

              {/* Right toolbar HTML editor toggle */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setIsVisual(!isVisual)}
                  className={`h-7 px-3 flex items-center justify-center rounded text-[10px] font-extrabold cursor-pointer border transition-colors ${!isVisual
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-fg-secondary border-border-light/60 hover:text-fg hover:bg-surface-secondary'
                    }`}
                  title="Toggle HTML Source"
                >
                  HTML
                </button>
              </div>
            </div>

            {/* Editor Body Panel */}
            <div className="flex-1 flex flex-col min-h-[400px]">
              {isVisual ? (
                <div
                  ref={editorRef}
                  contentEditable
                  className="w-full flex-1 p-8 outline-none text-[15px] leading-relaxed text-slate-800 bg-white rounded-b-[20px] border-t border-slate-100 prose prose-sm max-w-none focus:ring-0 focus:border-transparent font-sans"
                  onInput={handleEditorInput}
                  onBlur={handleEditorBlur}
                  style={{ minHeight: '400px' }}
                />
              ) : (
                <textarea
                  ref={textareaRef}
                  value={formData.htmlContent}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, htmlContent: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full flex-1 p-8 outline-none text-xs font-mono leading-relaxed text-slate-100 bg-gray-800 rounded-b-[20px] border-t border-slate-900 resize-none min-h-[400px] selection:bg-blue-500/30 focus:ring-2 focus:ring-blue-500/10 transition-all duration-350"
                  placeholder="<h1>Compose your email draft in HTML...</h1>"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Layout & Preview Tab Pane */
        <div className="max-w-4xl mx-auto w-full bg-white border border-border-light rounded-[24px] overflow-hidden shadow-sm p-6 sm:p-10 flex flex-col gap-6">
          {/* Simulated Email Headers */}
          <div className="flex flex-col gap-2 border-b border-border-light pb-5">
            <div className="flex gap-2.5 text-xs font-bold">
              <span className="text-fg-muted w-14">From:</span>
              <span className="text-fg">{selectedFromDomain ? selectedFromDomain.senderEmail : 'sender@domain.com'}</span>
            </div>
            <div className="flex gap-2.5 text-xs font-bold">
              <span className="text-fg-muted w-14">To:</span>
              <span className="text-fg">{selectedRecipient ? `${selectedRecipient.name ? selectedRecipient.name + ' <' : ''}${selectedRecipient.email}${selectedRecipient.name ? '>' : ''}` : 'Customer <customer@email.com>'}</span>
            </div>
            <div className="flex gap-2.5 text-xs font-bold">
              <span className="text-fg-muted w-14">Subject:</span>
              <span className="text-fg">{formData.subject || '(No Subject)'}</span>
            </div>
          </div>

          {/* Rendered Body */}
          <div
            className="prose prose-sm max-w-none text-sm text-fg leading-relaxed font-sans min-h-[300px]"
            dangerouslySetInnerHTML={{ __html: formData.htmlContent }}
          />

          {/* Rendered Attachments */}
          {attachments.length > 0 && (
            <div className="border-t border-border-light pt-5 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Attachments ({attachments.length})</span>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-2 bg-surface-secondary border border-border-light rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-fg-muted flex-shrink-0">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <span className="text-fg truncate max-w-[150px]">{att.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[250px] bg-white/80 backdrop-blur-md border-t border-slate-100 py-4.5 px-8 flex items-center justify-between shadow-xl shadow-slate-900/5 z-20">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          {hasUnsavedChanges ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to discard your changes and go back?')) {
                navigate('/');
              }
            }}
            className="h-10 px-5 border border-red-200 hover:border-red-300 hover:bg-red-50/30 text-red-650 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-98 bg-white"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-10 px-6 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/15 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Saving Draft...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Spotlight Recipients Modal */}
      {isRecipientsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsRecipientsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[6px] transition-opacity duration-300 ease-out"
          />

          {/* Modal Container */}
          <div
            className="relative bg-white/95 backdrop-blur-md border border-slate-100 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.18)] w-full max-w-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out animate-slideDown z-10"
            style={{ maxHeight: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4.5 border-b border-slate-100/80 bg-slate-50/20">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Recipients Spotlight Editor</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Edit or paste your prospect emails list</p>
              </div>
              {/* Badge for valid emails count */}
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black">
                <span>{parseRecipients(modalRecipients).length} Valid</span>
              </div>
            </div>

            {/* Imports Summary */}
            {importedRecipients.length > 0 && (
              <div className="px-6 pt-4 pb-0 flex flex-wrap gap-2">
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-blue-500">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="16" y1="11" x2="22" y2="11" />
                  </svg>
                  <span className="text-xs font-extrabold text-blue-700">{importedRecipients.length.toLocaleString()} imported</span>
                </div>
              </div>
            )}

            {/* Body Textarea */}
            <div className="flex-1 flex flex-col p-6 bg-white">
              <textarea
                ref={modalTextareaRef}
                value={modalRecipients}
                onChange={(e) => setModalRecipients(e.target.value)}
                placeholder="Paste or type recipient email addresses here...&#10;One email per line or comma-separated.&#10;e.g.&#10;ada@vinsmoke.org&#10;grace@vinsmoke.org"
                className="w-full flex-1 min-h-[200px] text-xs font-mono font-semibold text-slate-700 bg-transparent resize-none border-0 outline-none focus:ring-0 p-0 placeholder:text-slate-300 leading-relaxed scrollbar-thin"
              />
              {importedRecipients.length > 0 && (
                <p className="text-[10px] text-blue-400 font-semibold mt-2">All recipients (imported + manual) shown below. Edit as needed.</p>
              )}
            </div>

            {/* Footer / Status Bar */}
            <div className="flex items-center justify-between px-6 py-4.5 border-t border-slate-100 bg-slate-50/40">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                <kbd className="bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-sm font-mono text-[9px] text-slate-500">ESC</kbd> to close
                <span className="text-slate-350 mx-1">•</span>
                <kbd className="bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-sm font-mono text-[9px] text-slate-500">Ctrl + ↵</kbd> to save
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRecipientsModalOpen(false)}
                  className="px-4.5 py-2 hover:bg-slate-100 text-slate-500 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, recipients: modalRecipients }));
                    setHasUnsavedChanges(true);
                    setIsRecipientsModalOpen(false);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-extrabold shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-98 transition-all cursor-pointer"
                >
                  Apply Recipients
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
