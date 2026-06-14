---
name: backend-src-models-SeedRecipient-js
description: Mongoose schema for seed recipients used in email warmup process.
metadata:
  type: project
---

**Purpose**: Defines the SeedRecipient collection storing email addresses used for warming up sending domains, tracking open/click counts and active status.

**Dependencies**:
- mongoose

**Inputs**: N/A (schema definition)

**Outputs**: N/A (model)

**Potential Risks**:
- Email field is unique, lowercase, trimmed; good.
- No validation on email format beyond lowercase/trim; relies on controller validation.
- openCount and clickCount are integers but not incremented anywhere in codebase observed; maybe used elsewhere.
- No indexes beyond unique email; queries by isActive may benefit from index.
- No TTL or archiving; seeds accumulate indefinitely.
- No relation to user or domain; seeds are global? Actually seed recipients are not tied to a user; they appear to be global warmup list used across all campaigns? In worker, seed recipients not used; maybe used elsewhere.
- No validation on name length.