---
name: backend-src-providers-postal-js
description: HTTP client for interacting with a Postal SMTP relay server via its API to send raw emails.
metadata:
  type: project
---

**Purpose**: Provides a wrapper around the Postal HTTP API to construct MIME messages and send them via POST to /api/v1/send/raw. Used when user SMTP provider is 'vps' with an API URL.

**Dependencies**:
- Node.js http and https modules.

**Inputs**:
- Constructor: { serverUrl, apiKey }
- sendMail(mailOptions): expects mailOptions compatible with nodemailer (from, to, subject, text/html, attachments, messageId, headers).

**Outputs**:
- Promise resolving to { messageId, status: 'sent', provider: 'postal-http' } on success.
- Promise rejecting with Error containing statusCode and response body on failure.

**Potential Risks**:
- Builds MIME manually; may not handle edge cases (non-ASCII, encoding, line length limits). Relies on quoted-printable for text/html but does not actually encode; just passes raw strings (could break if contains non-ASCII or special chars).
- No proper MIME encoding for attachments (assumes base64 content already provided; but content is expected base64 string from nodemailer? In worker, attachments.content is base64 string; okay).
- Uses `rejectUnauthorized: false` which disables TLS certificate validation; security risk (MITM).
- Hardcoded timeout 30s; may be insufficient for large attachments.
- Does not support streaming; builds entire MIME string in memory; large attachments could cause memory issues.
- No retry logic on transient failures.
- The API endpoint assumes Postal server; may not be generic.
- No logging of requests/responses for debugging.
- Input validation minimal; missing fields could cause malformed MIME.
- The `buildMime` method adds extra spaces/tabs for formatting; may break some parsers.
- No support for inline content or other MIME types.