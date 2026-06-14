# Mailer Repository Analysis Report

**Date:** 2026-06-14  
**Repository:** E:\mailer-us  
**Analyzed by:** Claude Code

---

## 1. Repository Overview

Mailer is a self-hosted, privacy-first bulk email platform designed for email operators, marketing professionals, and system administrators. It provides domain management, campaign composition, sender rotation, throttling, and detailed delivery tracking.

The repository consists of:
- **Backend:** Node.js/Express server with MongoDB (Mongoose ODM)
- **Frontend:** React/Vite application with REST API communication
- **Infrastructure:** Docker Compose (referenced), BullMQ job queue, optional Postfix relay

Key technologies:
- Backend: Express, Mongoose, BullMQ, Nodemailer, Crypto (AES-256-GCM)
- Frontend: React, React Router, Vite, Tailwind CSS (inferred from class names)
- Queue: BullMQ with Redis
- Email Sending: Nodemailer transports (Brevo, SES, SMTP, Postal HTTP API)

---

## 2. Backend Architecture

### 2.1 Server Entry Point
- **File:** `backend/src/server.js`
- Loads environment variables, sets up Express middleware (CORS, JSON, static files).
- Defines health check (`/health`), tracking routes (`/track/*`), and API routes (`/api`).
- Connects to MongoDB and initializes BullMQ queue.
- Starts Postfix log parser (if in Brevo mode, parser is disabled per log).
- Sets up QueueEvent listeners to inject delivery events into the parser for SSE streaming.
- Graceful shutdown handling for SIGINT/SIGTERM.

### 2.2 Configuration
- **Environment Variables:** Referenced in `backend/.env.example` (from NEWCHANGES.md):
  - `MAIL_RELAY_HOSTS`: Comma-separated `host:port` for multi-relay IP rotation (not implemented in code).
  - `MAIL_RELAY_IPS`: Public IPs for SPF record generation.
  - Standard vars: `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`, `PORT`, `BASE_URL`, `SMTP_ENCRYPTION_KEY`, provider-specific SMTP credentials.
- **Configuration Files:**
  - `backend/src/config/db.js`: MongoDB connection helper.
  - `backend/src/config/queue.js`: BullMQ queue and Redis connection.
  - `backend/src/config/relays.js`: RelayPool class (currently only supports single Brevo/AWS SES transport; does **not** implement MAIL_RELAY_HOSTS rotation).

### 2.3 Database Models (Mongoose)
Located in `backend/src/models/`:
- **User:** Referenced but not seen in output; likely contains auth info.
- **Domain:** Sending domain details (name, sender email, daily limit, DKIM keys, provider, verification status).
  - Includes pre‑save validator to enforce sender email domain matches domainName (DKIM alignment).
- **Campaign:** Email campaign with recipients, subject, HTML, sender rotation mode, delay settings, attachments.
- **SmtpConfig:** User‑specific SMTP credentials (encrypted AES‑256‑GCM) and VPS Postal API settings.
- **DeliveryEvent:** Parsed Postfix log entries (timestamp, status, dsn, diagnostic, linked to campaign/recipient).
- **Tracking:** Open/click/unsubscribe events (1×1 GIF for opens, redirect for clicks).
- **SeedRecipient:** Warmup accelerator list.
- **WarmupConfig:** Warm‑up schedule settings.
- **DmarcReport:** Aggregated DMARC feedback.

### 2.4 Controllers & API Endpoints
Defined in `backend/src/controllers/` and routed via `backend/src/routes/api.js`:
- **authController:** Register, login, getMe, admin user management.
- **domainController:** CRUD domains, import from Brevo/SparkPost/VPS, verify, DKIM generation, test send.
- **campaignController:** Create, list, launch, delete campaigns.
- **smtpConfigController:** CRUD user SMTP configs, test connection.
- **statsController:** Campaign stats, overview stats.
- **eventController:** Event stream (SSE), stats, export/failures, queue operations.
- **seedRecipientController:** Seed list management.
- **warmupController:** Warm‑up status and config.
- **monitoringController:** DMARC report fetching and summary.
- **Tracking Routes:** Separate file `backend/src/routes/tracking.js` for open/pixel, click/redirect, unsubscribe.

**Middleware:** `protect` (requires valid JWT) and `adminOnly` (role check) from authController.

### 2.5 Services & Utilities
- **RelayPool** (`backend/src/config/relays.js`): Manages Nodemailer transports. Currently initializes a single transport from Brevo/AWS SES credentials; lacks support for `MAIL_RELAY_HOSTS` round‑robin rotation.
- **Worker** (`backend/src/queues/worker.js`): BullMQ worker that processes email jobs.
  - Reserves domain capacity atomically.
  - Selects relay: user SMTP config (matching domain provider) → VPS Postal HTTP API → global Brevo fallback.
  - Adds tracking headers (Message‑ID, Precedence commented out, X‑Mailer).
  - Generates plain‑text alternative from HTML.
  - Sleeps based on campaign delay settings.
  - Updates recipient status and domain stats.
- **DNS Verifier** (`backend/src/utils/dnsVerifier.js`): Functions to verify MX, SPF, DKIM, DMARC records; generate DKIM keys; build DNS records.
  - Note: `buildSpfDnsRecord` currently ignores `MAIL_RELAY_IPS` and provider‑specific logic (still uses generic includes).
- **Crypto** (`backend/src/utils/crypto.js`): AES‑256‑GCM encryption/decryption of SMTP passwords using `SMTP_ENCRYPTION_KEY`.
- **Email Verifier** (`backend/src/utils/emailVerifier.js`): Email format validation and MX lookup.
- **PostfixLogParser** (`backend/src/utils/postfixLogParser.js`): Tails Docker container logs, parses delivery events, stores in MongoDB, emits via EventEmitter, provides buffered events for SSE.

### 2.6 Middleware
- **auth/protect:** Verifies JWT token, attaches `req.user`.
- **auth/adminOnly:** Checks `req.user.role === 'Admin'`.

---

## 3. Frontend Architecture

### 3.1 Entry Point
- **File:** `frontend/src/App.jsx`
- Uses React Router v6 for client‑side routing.
- Manages session token in `localStorage` (via `utils/api.js`).
- Renders login/register UI when no session; otherwise renders layout with Sidebar and main content.
- Includes floating action button (FAB) to navigate to `/compose`.
- Toast notifications for feedback.

### 3.2 State Management
- React hooks (`useState`, `useEffect`) within `AppContent`.
- State variables: `session`, `searchQuery`, `domains`, `campaigns`, `sidebarOpen`, `overviewStats`, auth form fields, toast.
- Data loaded via `apiFetch` calls wrapped in `load*` functions; refreshed on token change or manual actions.
- No global state library (e.g., Redux, Context) – state is lifted to `AppContent` and passed down as props.

### 3.3 Components
Located in `frontend/src/components/`:
- **Sidebar:** Navigation, domain list, search, logout.
- **DashboardView:** Overview stats, recent campaigns/domains, launch campaign button.
- **DomainsView:** List domains, add domain, import from Brevo/SparkPost/VPS, delete.
- **DomainDetailView:** Read‑only domain details (likely reuses DomainsView logic).
- **ComposeView:** Campaign creation form (recipients, subject, HTML, rotation, delay, attachments).
- **CampaignDetailView:** Campaign details with stats.
- **EventsView:** Event stream (SSE) and filtering.
- **SeedsView:** Warmup seed list management.
- **EmployeeView/EmployeeDetailView:** Employee (user) management (admin only).
- **RulesView:** Possibly for automation rules (not detailed).
- **SettingsView:** User profile, API keys, etc.
- **ToastNotification:** Simple toast component.

### 3.4 API Communication
- **File:** `frontend/src/utils/api.js`
- Wrapper around `fetch` that automatically injects JWT `Authorization` header from `localStorage`.
- Handles 401 responses by clearing session and invoking a logout callback (set in `App.jsx`).
- Provides helpers: `getLocalSession`, `saveSession`, `deleteLocalSession`.

### 3.5 Build Tool
- **Vite:** Inferred from `frontend/vite.config.js` and presence of `vite.svg`.

---

## 4. Key Features (from NEWCHANGES.md – Deliverability Overhaul)

The document `NEWCHANGES.md` describes a series of improvements to fix email deliverability:

1. **IP Rotation (Multi‑Relay Support)**
   - New `RelayPool` class (supposed) reads `MAIL_RELAY_HOSTS` and round‑robins.
   - Worker uses pool; domain controller uses pool for test‑send.
   - **Reality:** Current `relays.js` does **not** implement multi‑relay; only single Brevo/AWS SES transport.

2. **Email Header & Content Improvements**
   - Plain‑text alternative generated from HTML.
   - Unique Message‑ID: `<campaignId.recipientId.uuid@sendingDomain>`.
   - `Precedence: bulk` header (commented out in worker).
   - `X-Mailer: Mailer/1.0`.
   - Relay verification at startup (logs warnings instead of crashing).

3. **DNS Record Fixes**
   - SPF now uses `MAIL_RELAY_IPS` instead of generic `include:mail.{domain}`.
   - DMARC set to `p=none` (instead of `p=quarantine`).
   - Implemented in `dnsVerifier.js`: `buildSpfDnsRecord` and `buildDmarcDnsRecord`.
   - **Note:** `buildSpfDnsRecord` still does not use `MAIL_RELAY_IPS`; it falls back to provider‑specific includes or `a mx ~all`.

4. **Backend DNS Records API**
   - `attachDnsRecords()` helper adds `dnsRecords` object to domain API responses.
   - Frontend (`DomainsView.jsx`) prefers server‑provided records.

5. **DKIM Domain Alignment Enforcement**
   - **Layer 1:** Domain model pre‑validate hook rejects mismatched sender email domain.
   - **Layer 2:** Controller validation in `addDomain`/`updateDomain`.
   - **Layer 3‑5:** Frontend auto‑syncs sender email `@` part to domain, shows hints, changes mock fallback.

6. **Environment Variables**
   - Added `MAIL_RELAY_HOSTS` and `MAIL_RELAY_IPS` to `.env.example`.

---

## 5. Discrepancies & Issues Found

### 5.1 Missing IP Rotation Implementation
- **Files:** `backend/src/config/relays.js` (only single transport), `backend/src/utils/dnsVerifier.js` (`buildSpfDnsRecord` ignores `MAIL_RELAY_IPS`).
- **Impact:** The advertised multi‑relay IP rotation feature is not functional; all emails go through a single Brevo/IP (if configured) or fail if no Brevo creds.
- **Evidence:** No reference to `MAIL_RELAY_IPS` in relays.js; SPF builder does not use the ips argument.

### 5.2 Demo Cheat Code in Domain Verification
- **File:** `backend/src/controllers/domainController.js`, lines 126‑135 (in `verifyDomainEndpoint`).
- **Code:** Always returns `{ passed: true, ... }` regardless of actual DNS checks.
- **Impact:** Security vulnerability – domain verification can be bypassed, allowing unverified domains to be marked as active and used for sending.
- **Recommendation:** Remove the demo cheat code or gate it behind a feature flag (e.g., `NODE_ENV !== 'production'`).

### 5.3 Potential Worker Crash if No Relay Configured
- **File:** `backend/src/queues/worker.js`, lines 271‑273 and 371‑379.
- If `userSmtpConfigs` is empty and `relayPool.size === 0` (no Brevo/AWS creds), `relayPool.getRoundRobin()` will attempt to access `this.transports[0]` → `undefined`, causing a runtime error.
- **Impact:** Worker could crash on startup if no global relay and no user SMTP configs.
- **Evidence:** The pool initialization logs a warning but leaves `transports` empty; verification loop skips if size === 0.

### 5.4 Concurrency Limit of 1 May Be a Bottleneck
- **File:** `backend/src/queues/worker.js`, line 383: `concurrency: 1`.
- **Impact:** Only one email job is processed at a time, limiting throughput. This may be intentional to avoid overwhelming relays or to preserve ordering, but it conflicts with the goal of high‑volume bulk sending.
- **Recommendation:** Evaluate increasing concurrency based on relay capacity and rate limits; consider making it configurable via env var.

### 5.5 Inconsistent SPF Record Generation
- **File:** `backend/src/utils/dnsVerifier.js`, lines 149‑158.
- The `buildSpfDnsRecord` function accepts `ips` argument but does not use it; instead it returns provider‑specific includes or `a mx ~all`.
- **Impact:** SPF records shown in the API will not reflect the actual sending IPs, reducing deliverability benefits.
- **Evidence:** The `ips` parameter is ignored; the function does not reference `MAIL_RELAY_IPS`.

### 5.6 Plain‑text Alternative Generation May Be Lossy
- **File:** `backend/src/queues/worker.js`, lines 15‑33 (`htmlToPlainText`).
- The function uses a series of regex replacements that may not correctly convert all HTML to plain text (e.g., nested tables, CSS‑based layout).
- **Impact:** Accessibility and spam score may suffer if the plain‑text version is poorly formatted.
- **Recommendation:** Consider using a dedicated library like `html-to-text` for more robust conversion.

### 5.7 Potential Race Condition in Domain Capacity Reservation
- **File:** `backend/src/queues/worker.js`, `reserveDomainCapacity` uses `findOneAndUpdate` with atomic increment – this is safe.
- However, if a job reserves capacity but crashes before `recordDomainDelivery`, the capacity is still counted as used (dailyUsage already incremented). This is conservative (may under‑utilize limit) but not a bug.
- **Note:** The worker releases capacity only if `deliveryAccepted` is false; if the send succeeds but the process crashes before `recordDomainDelivery`, the capacity remains reserved (counted) and the email is considered sent (job succeeded). This is acceptable.

### 5.8 Missing Input Validation on Some Endpoints
- **Example:** `/validate-emails` endpoint (in `api.js`) does basic validation but relies on `hasMxRecord` which may be slow if called in a loop; could be abused for DoS via many lookups.
- **Impact:** Low, as endpoint is protected; still worth considering rate limiting or caching.

### 5.9 Hardcoded Demo Values in Tracking Routes
- **File:** `backend/src/routes/tracking.js`, lines 130‑131: POST to `/unsubscribe` returns hardcoded success; no actual validation of campaign/recipient.
- **Impact:** Low; endpoint is protected and logs only if IDs are valid ObjectIds.

### 5.10 Unused Code / Dead Code
- **Observation:** Several files in the root appear to be scripts or logs (e.g., `check-nginx-sites.js`, `fix-vps.js`, `postal.sh`). These are likely operational scripts not part of the main application but present in the repo.
- **Impact:** None; they are outside the `src` tree and not imported.
- **Note:** The `backend/providers/postal.js` file was referenced but not read; likely used for VPS Postal HTTP API.

### 5.11 Potential Memory Leak in PostfixLogParser
- **File:** `backend/src/utils/postfixLogParser.js`, `queueIdToMessageId` map.
- The map is periodically cleaned when entries become older (final status) and when size exceeds `maxMapSize`. Looks adequate.
- **Buffer** also bounded by `maxBuffer`.

---

## 6. Performance Bottlenecks

1. **Worker Concurrency = 1** – limits email throughput to one job at a time.
2. **Synchronous DNS Lookups in Verification** – `verifyDomain` function performs MX, SPF, DKIM, DMARC lookups sequentially; could be slow for bulk domain verification.
3. **Plain‑text Generation Regex** – inefficient for large HTML strings; each regex passes over the whole string.
4. **Event Streaming** – Uses BullMQ `QueueEvents` to listen to completed/failed jobs and inject into PostfixLogParser; adds overhead but necessary for real‑time UI.
5. **MongoDB Queries Without Indexes** – Some queries (e.g., `DeliveryEvent.find()` for buffer init) may lack indexes; however the dataset is likely small.

---

## 7. Security Considerations

1. **Demo Verification Bypass** – Critical; must be removed in production.
2. **JWT Secret Strength** – Not seen; ensure `JWT_SECRET` (if used) is strong and stored in env.
3. **Encryption Key** – `SMTP_ENCRYPTION_KEY` must be a 64‑char hex string; ensure it is kept secret.
4. **CORS Configuration** – In `server.js`, `cors()` is used without options, allowing any origin; should be restricted to trusted domains in production.
5. **Rate Limiting** – No visible rate limiting on auth or API endpoints; consider adding to prevent brute‑force.
6. **Input Sanitization** – HTML content is stored as‑is and later used in emails; ensure sanitization to prevent XSS in tracking pixel URLs (though pixel URLs are internal). The `injectTrackingPixel` and `wrapLinksForTracking` functions replace placeholders but do not sanitize the original HTML; could allow malicious JS if HTML is rendered in a web view (unlikely).
7. **Database Injection** – Mongoose protects against injection if using proper query objects; no raw strings observed.

---

## 8. Recommendations

### Immediate Actions
1. **Remove demo cheat code** from `domainController.js` (`verifyDomainEndpoint`).
2. **Implement true multi‑relay support**:
   - Update `relays.js` to parse `MAIL_RELAY_HOSTS` and create a transport per entry.
   - Update `buildSpfDnsRecord` to use the `ips` argument when provided.
   - Ensure worker selects relays round‑robin from the pool.
3. **Increase worker concurrency** to a value >1 (make configurable via `WORKER_CONCURRENCY`).
4. **Add proper error handling** for empty relay pool (fail fast or fallback to a safe default).
5. **Replace `htmlToPlainText`** with a robust library (e.g., `html-to-text`).

### Medium‑Term Improvements
1. **Add rate limiting** on auth and public endpoints.
2. **Restrict CORS** to known origins.
3. **Consider caching DNS verification results** to reduce lookup latency.
4. **Add indexes** on frequently queried MongoDB fields (e.g., `DeliveryEvent.timestamp`, `Campaign.userId`).
5. **Implement refresh token strategy** for longer sessions.
6. **Separate concerns** – move business logic out of controllers into services for easier testing.

### Observability & Testing
1. **Add structured logging** (request IDs, timing) for better debugging.
2. **Increase test coverage** for critical paths (domain verification, worker job processing, capacity reservation).
3. **Monitor worker lag** (queue depth) and auto‑scale concurrency based on backlog.

---

## 9. Conclusion

The Mailer repository implements a feature‑rich bulk email platform with strong focus on deliverability (DKIM alignment, header improvements, warm‑up, tracking). The codebase is generally well‑structured, with clear separation between API routes, models, and utilities. However, several gaps exist between the documented features (notably IP rotation and SPF using real IPs) and the actual implementation. Addressing these discrepancies, removing the demo verification bypass, and tuning worker concurrency will bring the system closer to its promised capabilities and improve security and performance.

--- 
*End of Report*