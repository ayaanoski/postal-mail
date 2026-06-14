# Codebase Structure

**Analysis Date:** 2026-06-05

## Directory Layout

```
[project-root]/
├── .agent/             # Agent instructions and workflow configuration files
├── .planning/          # GSD project plans, tasks, and codebase specifications
│   └── codebase/       # Codebase mapping documentation (STACK, ARCHITECTURE, etc.)
├── backend/            # Express API backend & BullMQ worker codebase
│   ├── docker/         # Docker configs for mail relay services
│   │   └── postfix/    # Postfix mail container config (Dockerfile, main.cf)
│   ├── src/            # Node.js Express backend source files
│   │   ├── config/     # Database and redis queue connections
│   │   ├── controllers/# Business logic route controllers
│   │   ├── models/     # Mongoose database schema models
│   │   ├── queues/     # BullMQ background worker definitions
│   │   ├── routes/     # Express HTTP endpoint router definitions
│   │   └── utils/      # Domain DNS validation helpers
│   ├── package.json    # Backend project dependencies and scripts
│   └── docker-compose.yml# Container setup for local Postfix relay running on port 2525
├── frontend/           # Vite-powered React client application
│   ├── public/         # Static assets and built index fallback
│   ├── src/            # React client source files
│   │   ├── assets/     # Vector graphics and UI image files
│   │   ├── components/ # React dashboard, domain views, and compose editor
│   │   ├── utils/      # Client-side API fetch wrapping and auth storage
│   │   ├── App.jsx     # Parent view orchestrator and authentication forms
│   │   ├── index.css   # CSS styling and Tailwind CSS v4 variables
│   │   └── main.jsx    # Client entry point
│   ├── package.json    # Frontend dependencies and dev scripts
│   └── vite.config.js  # Vite server and compiler configurations
├── PRODUCT.md          # Technical specifications and product definitions
├── SELF_HOSTING_TODO.md# Operational guides for production hosting deployment
└── setup-vps.sh        # Bash provisioning script for setting up Ubuntu VPS
```

## Directory Purposes

**backend/src/config/**
- Purpose: Infrastructure connection management.
- Contains: `db.js` (MongoDB) and `queue.js` (Redis Connection / BullMQ instance).

**backend/src/controllers/**
- Purpose: Incoming API request handlers.
- Contains: Route business controllers (`authController.js`, `domainController.js`, `campaignController.js`).

**backend/src/models/**
- Purpose: MongoDB collections mapping and constraints definition.
- Contains: Mongoose schemas (`User.js`, `Domain.js`, `Campaign.js`).

**backend/src/queues/**
- Purpose: Asynchronous campaign email dispatching worker.
- Contains: BullMQ worker runner `worker.js`.

**backend/src/routes/**
- Purpose: Maps URL paths to controller endpoints.
- Contains: `api.js` routing script.

**backend/src/utils/**
- Purpose: Operational utilities.
- Contains: `dnsVerifier.js` containing DNS resolve logic.

**frontend/src/components/**
- Purpose: Client-side UI elements.
- Contains: React JSX files (`ComposeView.jsx`, `DashboardView.jsx`, `DomainsView.jsx`, `DomainDetailView.jsx`, `Sidebar.jsx`).

**frontend/src/utils/**
- Purpose: Client helper functions.
- Contains: `api.js` implementing JWT session storage and fetch wrappers.

## Key File Locations

**Entry Points:**
- `backend/src/server.js` - Express API web server runner.
- `backend/src/queues/worker.js` - Background campaign processing worker process.
- `frontend/src/main.jsx` - Frontend application renderer.

**Configuration:**
- `backend/.env` (and template `backend/.env.example`) - Backend environment parameters.
- `frontend/vite.config.js` - Vite compiler and CSS injection configuration.
- `frontend/eslint.config.js` - Lint rules.

**Core Logic:**
- `backend/src/utils/dnsVerifier.js` - Domain verification DNS resolution calculations.
- `frontend/src/components/ComposeView.jsx` - Advanced editor interface for configuring campaigns and parsing XLS recipient tables.

**Documentation:**
- `PRODUCT.md` - Technical outline of Mailer system features.
- `SELF_HOSTING_TODO.md` - Manual setup steps for SMTP and network configuration.
- `setup-vps.sh` - Standard VPS PM2 and Docker installation script.

## Naming Conventions

**Files:**
- `camelCase.js` - General JavaScript source modules and controllers (e.g., `dnsVerifier.js`, `authController.js`).
- `PascalCase.jsx` - React UI views and layout items (e.g., `ComposeView.jsx`, `Sidebar.jsx`).
- `PascalCase.js` - Database models (e.g., `Campaign.js`, `Domain.js`).
- `kebab-case.sh` / `kebab-case.yml` - Deployment and utility tools (e.g., `setup-vps.sh`, `docker-compose.yml`).

**Directories:**
- `camelCase` - Collection folders in backend and client (e.g., `controllers/`, `components/`, `queues/`).

## Where to Add New Code

**New Backend API Endpoint:**
- Router mapping: `backend/src/routes/api.js`
- Controller logic: Add function in `backend/src/controllers/` (e.g., `campaignController.js` or create a new controller)
- Input validation: Controller entry checks.

**New React Component View:**
- Component definition: `frontend/src/components/NewView.jsx`
- View selection mapping: Update view list in `frontend/src/App.jsx` (`activeView` router switches).
- Global styles: `frontend/src/index.css` (Tailwind CSS).

**New Background Job / Process:**
- Queue registry: `backend/src/config/queue.js`
- Worker handling loop: `backend/src/queues/worker.js`

---

*Structure analysis: 2026-06-05*
*Update when directory structure changes*
