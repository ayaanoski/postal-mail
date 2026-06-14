---
name: backend-src-utils-emailVerifier-js
description: Utility functions for email syntax validation, MX record lookup, and bounce categorization.
metadata:
  type: project
---

**Purpose**: Provides reusable validation and diagnostics for email addresses: syntax check, MX DNS lookup, and classification of bounce events as hard/soft based on DSN and diagnostic strings.

**Dependencies**:
- Node.js dns/promises Resolver

**Inputs**:
- validateEmail(email): string
- hasMxRecord(domain): string domain
- validateAndCheckMx(email): string email
- categorizeBounce(dsn, diagnostic): strings (DSN code, diagnostic text)

**Outputs**:
- validateEmail: boolean
- hasMxRecord: boolean
- validateAndCheckMx: object {valid, reason, mxExists}
- categorizeBounce: string 'hard' or 'soft'

**Potential Risks**:
- Email regex is basic; allows multiple '@'? Actually regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` ensures exactly one '@' and a dot after; but does not validate multiple dots or leading/trailing dots; still okay for basic.
- hasMxRecord uses hardcoded public resolvers (Google/Cloudflare); may be blocked or rate-limited; no caching; each call creates new Resolver.
- validateAndCheckMx returns `valid: true` when reason is 'no_mx' (line 25) which is confusing: valid true but reason no_mx? Actually they treat valid true if format passes, regardless of MX. Might be intentional: format valid but lacking MX.
- categorizeBounce logic: 
  * If DSN starts with '5.' -> hard (including all subclasses). 
  * If DSN starts with '4.' -> soft. 
  * Then scans diagnostic for hard patterns; if found returns hard. 
  * Then scans for soft patterns; if found returns soft. 
  * Else defaults to hard. 
  This may misclassify some bounces; also DSN may be empty.
- No input validation on dsn/diagnostic (could be undefined).
- No logging or metrics.
- No rate limiting on DNS queries; could cause DNS throttling under load.
- No fallback DNS servers if primary fail.
- No handling of internationalized domain names (IDN).