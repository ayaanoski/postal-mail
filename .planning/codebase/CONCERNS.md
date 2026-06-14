# Codebase Concerns

**Analysis Date:** 2026-06-05

## Tech Debt

**Hardcoded Secrets in Git History:**
- Issue: Hardcoded database credentials, Redis configuration, and JWT secrets are committed directly in the setup script.
- File: `setup-vps.sh` (lines 12-15)
- Impact: Security vulnerability; credentials can be read by anyone with read access to the repository, potentially leading to unauthorized data modification or leak.
- Fix approach: Move all configuration variables to environment inputs or read them from a secure runtime prompt during script execution.

**Monolithic View Component:**
- Issue: `ComposeView.jsx` is highly monolithic, containing over 1,000 lines of code.
- File: `frontend/src/components/ComposeView.jsx`
- Why: Built rapidly to group all campaign configuration and editing features in a single interface.
- Impact: Hard to maintain, debug, and test. State management is cluttered with local dropdown toggles, attachment parsing, XLS imports, and text formatting commands.
- Fix approach: Refactor `ComposeView.jsx` into smaller, atomic subcomponents (e.g., `RecipientImporter`, `AttachmentManager`, `DeliverySettingsForm`, `EmailEditorToolbar`).

**Client-Side Route State Switching:**
- Issue: Router states are managed via state variables (`activeView` and `selectedDomainId` inside `frontend/src/App.jsx`).
- Why: Avoided router dependencies (like React Router) to keep the frontend bundle minimal.
- Impact: Impossible to deep-link to specific views (e.g. linking to a specific domain detail page), browser back/forward buttons break, and refreshing the page resets the user back to the default view.
- Fix approach: Integrate a light client-side routing library (e.g., `wouter` or hash-based routing) to bind active view state to browser history.

## Known Bugs

**SMTP Connection Fatal Crash:**
- Symptoms: Worker crashes immediately on startup.
- Trigger: SMTP relay host is unreachable or connection verification fails on worker boot (`await transport.verify()` inside `backend/src/queues/worker.js` line 243).
- Workaround: PM2 automatically restarts the process, but this results in continuous boot loops when the relay is down.
- Fix: Wrap the connection verification check in a try-catch block to log the error and retry connection periodically rather than throwing an unhandled exception.

## Security Considerations

**localStorage Token Storage:**
- Risk: JWT tokens and user profiles are stored in client `localStorage` (`mailerToken` and `mailerUser`).
- current mitigation: None.
- Recommendations: Store JWT tokens in `httpOnly` secure cookies to mitigate token theft via Cross-Site Scripting (XSS).

**Visual Editor XSS Risks:**
- Risk: The email composer uses standard `contentEditable` and renders raw HTML via `dangerouslySetInnerHTML` or `innerHTML`. If inputs or Excel imports contain malicious javascript blocks, they may execute in the user's browser.
- Current mitigation: None in place.
- Recommendations: Integrate an HTML sanitizer (such as `dompurify` or `sanitize-html`) before rendering or storing email HTML content.

**Missing API Rate Limiting:**
- Risk: Critical API endpoints like `/api/auth/login` and `/api/auth/register` are vulnerable to brute force and denial of service attacks.
- Current mitigation: None.
- Recommendations: Implement `express-rate-limit` middleware on auth and verify endpoints in `backend/src/server.js`.

## Performance Bottlenecks

**Serial Bulk Campaign Dispatch:**
- Problem: Launching a campaign with thousands of recipients requires looping through arrays and pushing jobs to BullMQ inside a single HTTP request context (`launchCampaign` in `backend/src/controllers/campaignController.js`).
- Cause: Synchronous block processing of large payloads.
- Measurement: High memory spike and potential API timeout when launching campaigns with >5,000 recipients.
- Improvement path: Paginate bulk job pushing or offload campaign slicing to a parent queue job.

## Fragile Areas

**Excel/CSV Recipient Parsing logic:**
- File: `frontend/src/components/ComposeView.jsx` (line 141)
- Why fragile: Uses a simple string check to identify emails: `const emailCell = cells.find((c) => c.includes('@'))`. If a user name contains an `@` sign or if multiple cell values contain emails, the parsed output will mismatch.
- Common failures: Column headers (e.g. `email@company.com`) or annotations get parsed as recipients instead of standard records.
- Safe modification: Use a robust email validation regex to identify email addresses, and inspect columns/headers programmatically.

## Scaling Limits

**Single Queue Concurrency:**
- Current capacity: `concurrency: 1` configured in the worker.
- Limit: Sequential, single-threaded processing. Campaigns containing tens of thousands of recipients with delay timers will execute very slowly.
- Scaling path: Introduce queue worker concurrency scalability or spin up multiple PM2 worker instances.

## Missing Critical Features

**Bounce Tracking / Delivery Feedback loops:**
- Problem: Outbound emails that bounce (due to spam filtering or invalid addresses) are not tracked.
- Impact: Active campaigns show "sent" status indefinitely; sending domains run the risk of reputation damage by repeatedly emailing invalid addresses.
- Implementation complexity: High. Requires integrating a webhook receiver for SMTP delivery status notifications (DSNs) or analyzing incoming bounce emails.

**Unsubscribe Link Injection:**
- Problem: The dashboard does not inject unsubscribe headers or custom links into campaign email templates automatically.
- Impact: High likelihood of emails getting flagged as spam by inbox providers (Gmail, Outlook).
- Implementation complexity: Medium. Require database mapping for unsubscribed contacts and automated compiler checks to insert unsubscribe URLs into HTML bodies.

## Test Coverage Gaps

**Total Lack of Tests:**
- What's not tested: 100% of codebase has no unit, integration, or E2E tests.
- Risk: Code refactoring or upgrading dependencies (such as React 19 or Express) could break essential logic like DKIM signing, database updates, or JWT auth validation without immediate feedback.
- Priority: High.

---

*Concerns audit: 2026-06-05*
*Update as issues are fixed or new ones discovered*
