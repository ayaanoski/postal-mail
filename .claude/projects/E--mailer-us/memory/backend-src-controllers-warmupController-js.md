---
name: backend-src-controllers-warmupController-js
description: Controller for managing global warmup configuration (singleton document) to control daily sending limits and schedule.
metadata:
  type: project
---

**Purpose**: Provides endpoints to retrieve and update the global warmup configuration (singleton document) that governs daily email sending limits, warmup phases, and manual overrides. Also provides remaining quota.

**Dependencies**:
- WarmupConfig model (../models/WarmupConfig)

**Inputs**:
- GET /warmup: no input
- PUT /warmup: JSON body {enabled?, manualDailyLimit?, resetStartDate?}
- GET /warmup/limits: no input

**Outputs**:
- JSON with fields: enabled, dayNumber, phase, maxDaily, dailySent, startDate, manualDailyLimit (for warmup status)
- JSON with maxDaily, remaining, dailySent (for limits)

**Potential Risks**:
- Relies on route-level protection (adminOnly) in api.js; no auth within controller.
- Singleton document uses hardcoded 'singleton': 'global' field; if multiple documents exist, behavior undefined (findOne picks first).
- resetStartDate flag triggers clearing dailySent and lastResetDate; no validation that resetStartDate is boolean.
- No input validation on manualDailyLimit (should be positive integer).
- No rate limiting; could be abused to reset frequently.
- No logging of changes.
- The model methods getDayNumber, getPhaseLabel, getMaxDailyEmails are not shown; assume they exist.