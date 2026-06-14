---
name: backend-src-controllers-seedRecipientController-js
description: Controller for managing seed recipients (email warmup list) - CRUD operations and bulk import.
metadata:
  type: project
---

**Purpose**: Handles HTTP requests for seed recipient management: listing, creating, deleting, toggling active status, and bulk importing email addresses used for warming up sending domains.

**Dependencies**:
- SeedRecipient model (../models/SeedRecipient)
- Express async handler pattern (implicit)

**Inputs**:
- GET /seeds: query params none
- POST /seeds: JSON body {email, name}
- DELETE /seeds/:id: URL param id
- POST /seeds/:id/toggle: URL param id
- POST /seeds/bulk-import: JSON body {emails: []}

**Outputs**:
- JSON responses with seeds, success messages, or error objects with status codes.
- For bulk import: counts added and skipped.

**Potential Risks**:
- No authentication/authorization middleware applied in this file; relies on route-level protection (adminOnly) in api.js.
- Email validation minimal (only checks for '@'); could allow malformed emails.
- Bulk import loop creates each seed individually; could be slow for large lists, no bulk insert.
- Duplicate email detection relies on Mongo unique index; error handling catches code 11000 but continues loop.
- No rate limiting on bulk import could allow DoS via large email list.
- No input sanitization beyond trim and lowercasing.