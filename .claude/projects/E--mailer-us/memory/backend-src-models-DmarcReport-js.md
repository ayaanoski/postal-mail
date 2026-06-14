---
name: backend-src-models-DmarcReport-js
description: Mongoose schema for storing aggregated DMARC reports received from external services.
metadata:
  type: project
---

**Purpose**: Stores parsed DMARC (Domain-based Message Authentication, Reporting & Conformance) reports to monitor domain authentication status and aggregate feedback from receivers.

**Dependencies**:
- mongoose

**Inputs**: N/A

**Outputs**: N/A

**Potential Risks**:
- Fields are mostly default empty strings; no validation on format (e.g., sourceIp should be IP, policyP should be enum none/quarantine/reject).
- `records` array stores detailed per-source results; could grow large per report.
- `rawXml` stores full XML; could be large (potentially MBs). Storing raw XML in DB may bloat; consider storing only parsed data or referencing external storage.
- No indexes on frequently queried fields like policyDomain, createdAt.
- No TTL; reports accumulate indefinitely.
- No relationship to user/domain; reports are global? Likely tied to a domain via a domainId field missing; maybe they are aggregated globally.
- The aggregation in getDmarcSummary unwinds records and sums counts; assumes disposition values; may be inaccurate if other dispositions.
- No error handling for malformed XML ingestion (likely done elsewhere).