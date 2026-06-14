---
name: frontend-src-components-SeedsView-jsx
description: Seed recipient management interface for warmup seed accounts that guarantee opens/clicks to accelerate domain warmup process.
metadata:
  type: project
---

**Purpose**: Manages seed recipient accounts (test email addresses) that are guaranteed to open and click emails to accelerate the domain warmup process and improve sender reputation.

**Dependencies**:
- React hooks (useState, useEffect)
- ../utils/api (apiFetch)
- showToast prop for notifications

**Inputs**:
- user prop (object with role property for permission checking)
- showToast prop (function for displaying notifications)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /seeds (load seed recipients)
- POST /seeds (add new seed recipient)
- POST /seeds/bulk-import (bulk import seed recipients)
- POST /seeds/:id/toggle (activate/deactivate seed recipient)
- DELETE /seeds/:id (delete seed recipient)

**Potential Risks**:
- No validation on email format beyond HTML5 email input
- No deduplication check when adding seeds (could add duplicates)
- No pagination for seeds list - could become slow with many seeds
- Bulk import uses simple newline split - no validation of email format in bulk
- No loading states for individual toggle/delete operations
- No confirmation for bulk import beyond checking if emails array is empty
- No error handling for API calls in toggle/delete (reliant on apiFetch error handling)
- No accessibility labels on action buttons
- No optimization: activeCount computed on every render despite being derivable from seeds state
- No handling of extremely large bulk imports (could cause memory issues)
- No feedback on duplicate detection during bulk import
- No rate limiting on seed addition/deletion operations