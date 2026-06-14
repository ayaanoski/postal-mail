# Testing Patterns

**Analysis Date:** 2026-06-05

## Test Framework

**Runner:**
- **None Configured:** There are currently no automated test runners (like Vitest, Jest, or Mocha) configured in this codebase.

**Assertion Library:**
- **None Configured:** No assertion libraries are installed or imported.

**Run Commands:**
- There are no test scripts registered in `backend/package.json` or `frontend/package.json`.
- Linting checks can be run via:
  ```bash
  npm run lint    # Inside frontend directory
  ```

## Test File Organization

- No test directories (`tests/`, `__tests__/`) or test files (`*.test.js`, `*.spec.js`) exist in the project repository.
- File system check confirms that both the `backend` and `frontend` folders contain only application code and configuration files.

## Future Testing Recommendations

When implementing tests for the Mailer application, the following framework setups and testing patterns are recommended:

### 1. Backend Testing (API & Worker)
- **Runner:** Jest or Vitest.
- **Integration Tests:** Use `supertest` to hit Express endpoints (mocking MongoDB using `mongodb-memory-server` to avoid side effects on the database).
- **Worker/Queue Tests:** Mock BullMQ instances or use a dedicated local Redis test database (`REDIS_PORT=6379`, `REDIS_DB=1`).
- **SMTP Mocking:** Use `nodemailer-mock` or run a local mock SMTP server (like `Mailhog` or `Mailpit`) to assert that outbound emails are generated with the correct headers, bodies, and attachments.

### 2. Frontend Testing (React)
- **Runner:** Vitest + React Testing Library.
- **Component Tests:** Mount Views (`ComposeView.jsx`, `DashboardView.jsx`) to assert rendering of state elements, forms, and mock list items.
- **API Mocking:** Mock `fetch` or use `msw` (Mock Service Worker) to intercept REST calls to `/api/*` routes.
- **End-to-End Tests:** Playwright or Cypress for testing user flows (e.g., logging in -> configuring domain -> drafting campaign -> launching campaign).

---

*Testing analysis: 2026-06-05*
*Update when test patterns are implemented*
