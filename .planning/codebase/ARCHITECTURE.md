# Architecture

**Analysis Date:** 2026-06-05

## Pattern Overview

**Overall:** Client-Server Monolith with Asynchronous Worker
- A full-stack web application consisting of a single-page React frontend and an Express REST API backend.
- High-throughput asynchronous tasks (like email campaigns) are offloaded to a Redis-backed queue processed by a separate worker process.

**Key Characteristics:**
- **Decoupled Client-Server:** The React frontend compiles to static assets served by the Express backend or a static host, communicating exclusively via REST APIs.
- **Asynchronous Execution:** Heavy, rate-limited, and delayed operations (sending mass email campaigns) run out-of-band in a queue worker, keeping the API server responsive.
- **Authoritative DNS Resolution:** Integrates custom direct-to-authoritative DNS query validation for DKIM, SPF, MX, and DMARC verification to bypass propagation caches.

## Layers

**Frontend Views & Components:**
- **Purpose:** Renders the user interface, handles local client states, and binds user inputs.
- **Contains:** Component views (`ComposeView.jsx`, `DashboardView.jsx`, `DomainsView.jsx`, `DomainDetailView.jsx`, `Sidebar.jsx`) inside `frontend/src/components/` and the shell container `frontend/src/App.jsx`.
- **Depends on:** Frontend API Client utility (`frontend/src/utils/api.js`).

**Frontend API Client:**
- **Purpose:** Abstract HTTP request wrapping, handle auth headers, and manage user login/logout session states.
- **Contains:** `apiFetch`, `getLocalSession`, `saveSession`, and `deleteLocalSession` in `frontend/src/utils/api.js`.
- **Used by:** Frontend Views & Components.

**Backend API Routes:**
- **Purpose:** Exposes API routes, maps them to controller handlers, and enforces authentication/authorization middleware.
- **Contains:** Route definitions in `backend/src/routes/api.js`.
- **Depends on:** Backend Controllers and Auth middleware functions.

**Backend Controllers:**
- **Purpose:** Handles business logic for API endpoints, parses and validates HTTP payloads, interacts with database models, and pushes jobs to queues.
- **Contains:** Controller route handlers (`authController.js`, `domainController.js`, `campaignController.js`) inside `backend/src/controllers/`.
- **Depends on:** Mongoose Database Models, BullMQ config.

**Database Models (Mongoose):**
- **Purpose:** Defines MongoDB schemas, validation rules, and indexes.
- **Contains:** Schema definitions (`User.js`, `Domain.js`, `Campaign.js`) in `backend/src/models/`.

**Background Queue Worker:**
- **Purpose:** Subscribes to Redis/BullMQ to pick up and process campaign dispatching jobs sequentially.
- **Contains:** `backend/src/queues/worker.js`.
- **Depends on:** Database Models, Nodemailer SMTP transport.

## Data Flow

### Campaign Broadcast Flow (Asynchronous Job Processing):

1. **User action:** User composes a campaign in `ComposeView.jsx` and submits it.
2. **REST Call:** Frontend POSTs campaign payload to `/api/campaigns`.
3. **Database Insertion:** `campaignController.js` creates a `Campaign` record with `recipients` status initialized to `pending`.
4. **Campaign Launch:** User triggers a launch on the dashboard, making a POST request to `/api/campaigns/:id/launch`.
5. **Queue Push:** `campaignController.js` queries the campaign, loops through recipients, and creates individual BullMQ jobs inside the `emailSendingQueue` containing metadata (recipient details, templates, sending domain config, delay profile).
6. **Worker Processing:** The background worker process (`backend/src/queues/worker.js`) picks up jobs. For each job:
   - Reserves domain sending capacity (increments `dailyUsage` in `Domain` model).
   - Generates DKIM signed headers using private keys.
   - dispatches SMTP email via Nodemailer connection.
   - Sleeps for the configured delay (enforcing fixed/random delays).
   - Updates MongoDB recipient status to `sent` or `failed`.
   - Increments total delivered counts or updates campaign status to `Completed` if all recipients have been processed.

**State Management:**
- **Backend:** Relies on MongoDB database for persistent states (e.g. Campaign progress, verified domains) and Redis for transient background job queue states.
- **Frontend:** Managed using parent state hook hooks inside `frontend/src/App.jsx` (`domains`, `campaigns`, `toast`, `activeView`).

## Key Abstractions

**Mongoose Models:**
- **Purpose:** Object-Document Mapper modeling relationships and field constraints.
- **Examples:** `Campaign`, `Domain`, `User` inside `backend/src/models/`.

**DNS Verifier Helper:**
- **Purpose:** Inspects domain name server configurations.
- **Location:** `backend/src/utils/dnsVerifier.js`
- **Functions:** `verifyDomain`, `generateDkimKeys`, `buildDkimDnsRecord`.

**SMTP Nodemailer Transport:**
- **Purpose:** Manages SMTP connection to the custom mail relay agent.
- **Location:** `backend/src/queues/worker.js` and `backend/src/controllers/domainController.js`.

## Entry Points

**Backend Server API:**
- **Location:** `backend/src/server.js`
- **Invoker:** `npm run dev` or `node src/server.js`
- **Responsibilities:** Establish database connections, instantiate Express app, host API routes, serve public static assets.

**Background Queue Worker:**
- **Location:** `backend/src/queues/worker.js`
- **Invoker:** `npm run worker` or `node src/queues/worker.js`
- **Responsibilities:** Establish connection to Redis and MongoDB, spin up BullMQ worker, configure SMTP nodemailer transporter, and listen for incoming jobs.

**Frontend Client:**
- **Location:** `frontend/src/main.jsx`
- **Invoker:** `npm run dev` (Vite)
- **Responsibilities:** Mounts React application and styles in the browser.

## Error Handling

**Express Error Middleware:**
- Handles syntax errors in requests (e.g. invalid JSON payloads) and generic unhandled Server Error throws with structured 500 JSON responses.
- Handles standard routes with a catch-all 404 response.

**Controller Level Catch Blocks:**
- Formats exceptions into REST-compliant `{ message: '...', error: '...' }` responses with appropriate status codes (400, 403, 404, 500).

**Worker Error Bubbling:**
- Logs completed and failed job exceptions via worker `.on('failed')` listeners. Re-adds failed jobs if retries are configured or marks the recipient status as `failed` in MongoDB.

---

*Architecture analysis: 2026-06-05*
*Update when major patterns change*
