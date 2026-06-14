# New Changes — Mailer Deliverability Overhaul

> This document covers all modifications made to fix email deliverability,
> IP rotation, DKIM alignment, and DNS record generation.

---

## 1. IP Rotation (Multi-Relay Support)

### Problem
All emails went through a single Postfix relay on one IP. Gmail detects burst
from a single source and treats it as bulk spam.

### Solution — `backend/src/config/relays.js` (NEW)
A `RelayPool` class that manages multiple Nodemailer transports. The worker
round-robins through available relays so each email egresses from a different
public IP.

**How it works:**
- Reads `MAIL_RELAY_HOSTS` (comma-separated `host:port` entries)
- Falls back to `MAIL_RELAY_HOST` + `MAIL_RELAY_PORT` for backward compat
- Every `sendMail()` call picks the next relay in sequence
- Also provides `getRandom()` (used by test-send) and `getByIndex()` (used by
  startup verification)

**Files touched:**
- `backend/src/config/relays.js` — new file
- `backend/src/queues/worker.js` — replaced single transport with pool
- `backend/src/controllers/domainController.js` — test-send uses pool

---

## 2. Email Header & Content Improvements

### Problem
Emails were HTML-only, had no `Message-ID`, no `Precedence` header, and no
plain-text alternative — all of which increase spam score.

### Solution — `backend/src/queues/worker.js`

| Change | Detail |
|---|---|
| **Plain-text alternative** | `htmlToPlainText()` strips HTML tags, converts `<br>`, `</p>`, `</h1-6>` to newlines. Sent as `text` alongside `html`. |
| **Unique Message-ID** | Format: `<campaignId.recipientId.uuid@sendingDomain>` |
| **Precedence: bulk** | Tells Gmail this is mass mail (prevents misclassification) |
| **X-Mailer: Mailer/1.0** | Standard mailer identification header |
| **Relay verification** | Startup verifies ALL configured relays, logs warnings for unreachable ones instead of crashing |

---

## 3. DNS Record Fixes

### Problem
- **SPF** was `v=spf1 mx include:mail.{domain} ~all` — generic, often wrong
- **DMARC** was `p=quarantine` — telling Gmail to spam any auth-failing email

### Solution — `backend/src/utils/dnsVerifier.js`

| Function | Before | After |
|---|---|---|
| `buildSpfDnsRecord` | `v=spf1 mx include:mail.{domain} ~all` | `v=spf1 ip4:X.X.X.X ip4:Y.Y.Y.Y ~all` (reads `MAIL_RELAY_IPS`) |
| `buildDmarcDnsRecord` | `v=DMARC1; p=quarantine; ...` | `v=DMARC1; p=none; ...` |

The SPF record now explicitly lists your VPS IPs instead of a generic include.
DMARC set to `p=none` during warmup phase (tighten later).

---

## 4. Backend DNS Records API

### Problem
The frontend computed its own DNS records without knowing the server's sending
IPs, so SPF was always shown with the generic `include:mail.{domain}`.

### Solution — `backend/src/controllers/domainController.js`

All domain API responses (`GET/POST/PUT` + verify) now include computed DNS
records via the `attachDnsRecords()` helper:

```json
{
  "domain": {
    "...": "...",
    "dnsRecords": {
      "spf": "v=spf1 ip4:203.0.113.1 ~all",
      "dmarc": "v=DMARC1; p=none; rua=mailto:dmarc@domain.com; pct=100",
      "dkim": {
        "hostname": "dkimX._domainkey.domain.com",
        "value": "v=DKIM1; k=rsa; p=MIIBIjANBg..."
      }
    }
  }
}
```

The frontend (`DomainsView.jsx`) now prefers these server-provided records
and only falls back to local computation when they're absent.

---

## 5. DKIM Domain Alignment Enforcement

### Problem
The UI allowed any `senderEmail` (e.g., `user@gmail.com`) even when the domain
was `vinsmoke.org`. Gmail checks DKIM domain alignment — if the `From:` domain
doesn't match the DKIM signature domain, DKIM fails and the email is flagged.

### Solution — Three-layer enforcement

#### Layer 1: Model — `backend/src/models/Domain.js`
Pre-validate hook rejects any save where `senderEmail` domain ≠ `domainName`:
```js
domainSchema.pre('validate', function (next) {
  const emailDomain = this.senderEmail.split('@')[1];
  if (emailDomain !== this.domainName) {
    this.invalidate('senderEmail', '...must match...');
  }
  next();
});
```

#### Layer 2: Controller — `backend/src/controllers/domainController.js`
- `addDomain()`: Validates before create with clear 400 error
- `updateDomain()`: Fetches domain, validates against existing `domainName`,
  then uses `save()` (triggering the model hook)

#### Layer 3: Frontend — `frontend/src/components/DomainsView.jsx`
- When user types the domain name, sender email's `@` part **auto-updates**
- Placeholder dynamically shows `info@{domain}`
- Amber hint: "Must use @yourdomain.com — Gmail checks DKIM alignment..."

#### Layer 4: Frontend — `frontend/src/components/DomainDetailView.jsx`
- Amber hint under sender email: "Must use @{domain} — Gmail requires DKIM
  alignment..."

#### Layer 5: Frontend — `frontend/src/components/ComposeView.jsx`
- Mock fallback domain changed from `gmail.com` to `yourdomain.com`

---

## 6. Environment Variables

### New Variables — `backend/.env.example`

```env
# Multi-relay IP rotation — comma-separated host:port entries
# Worker round-robins through these for each email so every
# message can egress from a different public IP.
MAIL_RELAY_HOSTS=203.0.113.1:25,203.0.113.2:25,203.0.113.3:25

# Public IPs of your relay(s) — used to generate correct SPF records
MAIL_RELAY_IPS=203.0.113.1,203.0.113.2,203.0.113.3
```

### Backward Compatibility
`MAIL_RELAY_HOSTS` is optional. If omitted, the system falls back to
`MAIL_RELAY_HOST` + `MAIL_RELAY_PORT` (single relay, no rotation).

---

## Files Changed — Summary

| File | Status | Description |
|---|---|---|
| `backend/src/config/relays.js` | **NEW** | Relay pool with round-robin IP rotation |
| `backend/src/queues/worker.js` | MODIFIED | Uses relay pool, added headers + plain text |
| `backend/src/utils/dnsVerifier.js` | MODIFIED | SPF uses real IPs, DMARC `p=none` |
| `backend/src/controllers/domainController.js` | MODIFIED | DNS records in API, DKIM alignment validation, relay pool for tests |
| `backend/src/models/Domain.js` | MODIFIED | Pre-validate hook for DKIM alignment |
| `backend/.env.example` | MODIFIED | Added `MAIL_RELAY_HOSTS` and `MAIL_RELAY_IPS` |
| `frontend/src/components/DomainsView.jsx` | MODIFIED | Auto-sync email domain, server DNS records, alignment hint |
| `frontend/src/components/DomainDetailView.jsx` | MODIFIED | Alignment hint in settings |
| `frontend/src/components/ComposeView.jsx` | MODIFIED | Mock domain uses aligned domain |
