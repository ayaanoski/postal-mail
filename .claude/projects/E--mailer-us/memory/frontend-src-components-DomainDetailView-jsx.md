---
name: frontend-src-components-DomainDetailView-jsx
description: React view for displaying and managing a single sending domain, including DNS records, verification, settings, usage, and linked campaigns.
metadata:
  type: project
---

**Purpose**: Allows admins/users to view domain details, edit basic settings, verify DNS records, generate DKIM keys, send test emails, delete domain, and see which campaigns use the domain.

**Dependencies**:
- react, react-router-dom hooks (useParams, useNavigate)
- ../utils/api (apiFetch)
- Uses local storage indirectly via apiFetch.

**Inputs**:
- URL param domainId (via useParams)
- Props: onRefresh (function), onDeleteDomain (function)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /domains/:id (loads domain)
- GET /campaigns (loads all campaigns to filter)
- POST /domains/:id/verify (trigger verification)
- PUT /domains/:id (update settings)
- POST /domains/:id/dkim/generate (rotate DKIM)
- POST /domains/:id/test-send (send test email)
- DELETE /domains/:id (delete domain)
- Also triggers onRefresh and onDeleteDomain callbacks.

**Potential Risks**:
- Heavy client-side processing: builds DNS tables, copies to clipboard, renders many rows; but likely fine for typical domain count.
- No pagination for campaigns list; could be many.
- The editData object is used for PUT; only includes senderEmail, senderName, dailyLimit, status, provider; missing other fields like dkimSelector, dkimPublicKey (those are read-only). OK.
- No validation on senderEmail matching domain (controller does that).
- No input sanitization; XSS risk if domain contains malicious script? Rendered as text.
- No rate limiting on verify/generate/test-send; could be abused.
- The test-send endpoint uses user's SMTP config; could be used to spam external addresses.
- No confirmation dialog for delete beyond window.confirm (OK).
- No loading states for individual actions (except boolean flags).
- The DKIM generation logic: for non-Brevo/SparkPost/VPS, it shows generate button; but the actual key generation is done in controller (domainController.js generateDkim). That's fine.
- The DNS record values are hardcoded in buildSpfRecord/buildDmarcRecord; they assume certain include values; may be outdated.
- No handling of DNS propagation delays; verification may fail temporarily.
- No caching of verification details; each verify calls API.
- The usage card shows daily usage vs limit; usage is from domain.dailyUsage (updated by worker via reserveDomainCapacity). Might be stale if worker not running.
- No handling of manualDailyLimit from warmup config; domain limit is separate.
- No accessibility labels on some icons.
- The clipboard copy uses navigator.clipboard.writeText; may fail in insecure contexts; no fallback.
- The download zone file builds a text file; could be large if many records (only three).
- No error handling for API calls (catch {} silent); could hide failures.
- The component uses window.confirm; not SSR friendly but fine.