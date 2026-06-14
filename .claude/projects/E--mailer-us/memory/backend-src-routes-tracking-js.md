---
name: backend-src-routes-tracking-js
description: Express route handlers for email tracking pixels (open, click, unsubscribe) that log events and serve responses.
metadata:
  type: project
---

**Purpose**: Defines HTTP endpoints for tracking email opens (transparent GIF), clicks (redirect), and unsubscribes (web page). Each endpoint logs a Tracking document in MongoDB asynchronously.

**Dependencies**:
- express
- mongoose
- Tracking model

**Inputs**:
- GET /track/open/:campaignId/:recipientId: URL params campaignId, recipientId
- GET /track/click/:campaignId/:recipientId: URL params + query param `url`
- GET/POST /track/unsubscribe/:campaignId/:recipientId: URL params, method distinguishes POST (RFC 8058) vs GET (landing page)

**Outputs**:
- Open: 200 with 1x1 transparent GIF (binary)
- Click: 302 redirect to target URL (or 400 if missing url)
- Unsubscribe GET: 200 with HTML confirmation page
- Unsubscribe POST: 200 with text "Unsubscribed successfully"

All responses also attempt to log Tracking document (non-blocking for open, blocking for click/unsubscribe? Actually click logs after redirect? It logs before sending redirect? It logs after redirect? The code logs after redirect? It logs after `res.redirect`? No, redirect is sent then try block logs after; but redirect ends response; logging occurs after sending headers but before connection close? Node may still process.

**Potential Risks**:
- Open endpoint logs asynchronously but does not wait for errors; failures are logged to console only; no client feedback.
- No validation that campaignId/recipientId belong to same campaign/user; could allow logging arbitrary IDs.
- No rate limiting; could be abused to insert many tracking events (spam).
- Open endpoint returns cached GIF constant; fine.
- Click endpoint redirects without validating URL; could be open redirect vulnerability (allows redirect to any external site). Should validate URL is same domain or allowlist.
- Unsubscribe endpoint logs only if not already exists (duplicate prevents); but clicks are always logged (duplicate allowed). Inconsistent.
- Unsubscribe HTML page uses inline CSS; fine.
- No sanitization of userAgent/IP before storage (could store large strings).
- No indexing on Tracking queries (campaignId, recipientId, type) though model has indexes.
- No handling of malformed ObjectId; early return prevents logging but still sends response (GIF/redirect/page). Could lead to missing tracking.
- No CSRF protection; but endpoints are GET; CSRF less relevant.
- No HTTPS enforcement; but trust proxy headers.
- No logging of failed attempts (e.g., invalid IDs) beyond console.
- No metrics or monitoring.