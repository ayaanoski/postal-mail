# Coding Conventions

**Analysis Date:** 2026-06-05

## Naming Patterns

**Files:**
- **Backend source files:** camelCase (e.g., `dnsVerifier.js`, `authController.js`, `api.js`).
- **Mongoose models:** PascalCase (e.g., `User.js`, `Domain.js`, `Campaign.js`).
- **Frontend components:** PascalCase (e.g., `ComposeView.jsx`, `DashboardView.jsx`).
- **Frontend utility modules:** camelCase (e.g., `api.js`).

**Functions:**
- **General functions:** camelCase (e.g., `addDomain`, `verifyDomain`, `processEmailJob`).
- **Async functions:** camelCase (no special suffixes).
- **Event handlers (Frontend):** prefixed with `handle` + EventName (e.g., `handleLoginSubmit`, `handleDomainCheckboxChange`, `handleFileImport`).

**Variables:**
- **General variables:** camelCase (e.g., `activeResolver`, `responseDomain`, `capacityReserved`).
- **Constants:** UPPER_SNAKE_CASE (e.g., `COMMON_DKIM_SELECTORS`, `REDIS_PORT`, `MAIL_RELAY_PORT`).

**Database Schemas:**
- **Mongoose schemas:** camelCase properties matching the standard database document columns (e.g., `domainName`, `senderEmail`, `dailyLimit`, `verified`, `dkimSelector`).

## Code Style

**Formatting:**
- **Indentation:** 2 spaces (consistently applied across backend and frontend).
- **Quotes:** Single quotes preferred for strings in JavaScript (`require('cors')`, `'Pending Verification'`), except where double quotes are required (like JSON or inline string values).
- **Semicolons:** Required and consistently used at the end of statements.
- **Line Length:** Kept within readable bounds (~100-120 characters).

**Linting:**
- **Tool:** ESLint is configured in the frontend (`eslint.config.js`).
- **Execution command:** `npm run lint` in the `frontend` directory.

## Import Organization

**Backend (CommonJS require):**
1. Core environment loaders: `require('dotenv').config()`
2. External packages (e.g., `express`, `mongoose`, `nodemailer`)
3. Project configuration files (e.g., `connectDB`, `queue`)
4. Internal modules / routing files (e.g., `apiRoutes`, `dnsVerifier`)

**Frontend (ES Modules import):**
1. React hooks (e.g., `useState`, `useEffect`, `useRef`)
2. Third-party vendor libraries (e.g., `xlsx`, icon packages)
3. Internal custom components (e.g., `Sidebar`, `DashboardView`)
4. Internal utilities (e.g., API wrappers from `utils/api.js`)

## Error Handling

**Backend Controller APIs:**
- Always run route operations inside `try/catch` blocks.
- Return structured error responses in JSON format:
  ```javascript
  try {
    // Controller logic...
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to perform operation',
      error: error.message
    });
  }
  ```
- Return appropriate HTTP status codes:
  - `400 Bad Request` for invalid input validation.
  - `401 Unauthorized` for expired/invalid JWT tokens.
  - `403 Forbidden` for permission checks (e.g., non-admin actions).
  - `404 Not Found` for missing database documents.
  - `500 Internal Server Error` for unexpected logic failures.

**Backend Worker Jobs:**
- BullMQ worker captures failed jobs.
- If a job fails before the email relay accepts the connection, the worker releases the domain's daily sending quota reservation (`releaseDomainCapacity`).
- recipient campaign status is marked as `failed` in Mongoose when retry attempts are exhausted.

**Frontend Client:**
- REST calls wrap errors with `throw new Error(...)` showing error responses via standard toast notifications (`showToast(err.message, 'error')`).

## Logging

- **API Logs:** stdout/stderr via `console.log` and `console.error` (managed by PM2 inside production environments).
- **Worker Logs:** Detailed logs printed for job lifecycles (`completed` or `failed` triggers).
- **Format:** Simple text output messages containing details (e.g., `console.log('MongoDB connected')`).

## Comments

- **Usage:** Used to document complex component layouts, state mappings, or non-obvious business rules (e.g., `// Check size limit: total attachments + new files should not exceed ~1.5MB`).
- **Headers:** Double-dash/dash line indicators separating page setup configurations (e.g., `// Section 3: Sending Domains`).

---

*Convention analysis: 2026-06-05*
*Update when patterns change*
