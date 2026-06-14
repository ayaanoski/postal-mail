---
name: backend-src-models-WarmupConfig-js
description: Singleton mongoose model for global warmup configuration controlling daily email sending limits and phases.
metadata:
  type: project
---

**Purpose**: Manages the warmup schedule that incrementally increases daily sending limits to build sender reputation. Provides methods to reserve/release slots for sending emails.

**Dependencies**:
- mongoose

**Inputs**: N/A (model definition)

**Outputs**: N/A

**Potential Risks**:
- Uses singleton pattern with unique constraint on `singleton: 'global'`; ensures only one document.
- `getDayNumber` calculates days since startDate (inclusive). Off-by-one? Adds 1; day 1 is start date.
- `getPhase` returns first phase where day <= maxDay; works.
- `getMaxDailyEmails` returns manualDailyLimit if set >0, else if disabled returns Infinity (meaning no limit?), else phase maxEmails. Infinity may cause issues when compared; used in reserveSlot where `config.dailySent >= maxDaily` with Infinity will always be false (since dailySent finite). That means if disabled, limit is infinite, allowing unlimited sends. Might be intentional.
- `reserveSlot` and `releaseSlot` are static methods that atomically? Not atomic: they read, update, save; race conditions could cause over/under counting. Should use findOneAndUpdate with $inc and date check.
- `lastResetDate` stored as string YYYY-MM-DD; compared to today string; works but timezone issues (using local date? toISOString slice yields UTC date). Could cause drift if server timezone differs.
- No validation on manualDailyLimit (should be positive integer).
- No indexes; frequent reads/writes on singleton document could cause contention under high load.
- The model is used in worker? Not seen; likely used by middleware to check slot before sending.
- No logging or audit of changes.