# Technology Stack

**Analysis Date:** 2026-06-05

## Languages

**Primary:**
- JavaScript (ES6+) - All application code (Node.js backend and React frontend)

**Secondary:**
- HTML5 / CSS3 - Frontend markup and Tailwind CSS v4 styling
- Bash - Deployment scripts (e.g., `setup-vps.sh`)

## Runtime

**Environment:**
- Node.js >=18 (Backend API server and BullMQ worker)
- Modern Web Browsers (Frontend application)

**Package Manager:**
- npm - Used in both `backend` and `frontend` folders
- Lockfiles: `backend/package-lock.json` and `frontend/package-lock.json` present

## Frameworks

**Core:**
- Express v4.21.2 - Backend REST API server framework
- React v19.2.6 - Frontend UI library

**Testing:**
- None configured in the project yet

**Build/Dev:**
- Vite v6.1.1 - Frontend bundling and dev server
- Tailwind CSS v4.0.0 (with `@tailwindcss/vite` plugin) - Frontend utility-first CSS styling
- nodemon v3.1.14 - Backend live reload during development
- concurrently v10.0.3 - Running multiple npm scripts simultaneously

## Key Dependencies

**Critical:**
- `mongoose` v8.9.5 - MongoDB object modeling and database connection (`backend/package.json`)
- `bullmq` v5.34.4 - Redis-based message queue for background job management (`backend/package.json`)
- `nodemailer` v6.9.16 - SMTP email delivery engine (`backend/package.json`)
- `jsonwebtoken` v9.0.2 - JWT generation and validation for authentication (`backend/package.json`)
- `bcryptjs` v2.4.3 - Password hashing and verification (`backend/package.json`)
- `xlsx` v0.18.5 - Parsing recipient lists from Excel/CSV formats (`frontend/package.json`)
- `@solar-icons/react-perf` v2.1.1 - Vector iconography suite (`frontend/package.json`)

## Configuration

**Environment:**
- `.env` files loaded via `dotenv` in backend (`backend/src/server.js`, `backend/src/queues/worker.js`)
- Key configurations required:
  - `MONGO_URI` (MongoDB connection string)
  - `PORT` (API port, default 5000)
  - `REDIS_HOST` / `REDIS_PORT` (Redis instance address)
  - `MAIL_RELAY_HOST` / `MAIL_RELAY_PORT` / `MAIL_RELAY_IGNORE_TLS` (Nodemailer transport relay configurations)

**Build:**
- `frontend/vite.config.js` - Vite compiler and plugin declarations
- `frontend/eslint.config.js` - ESLint configuration rules

## Platform Requirements

**Development:**
- Cross-platform (Windows/macOS/Linux)
- Requires Node.js >=18
- Requires a local or remote MongoDB instance
- Requires a local or remote Redis instance
- Requires an SMTP relay server for testing (or a mock relay)

**Production:**
- Backend and worker run as Node.js processes (can be containerized using Docker)
- Frontend built as a static bundle and served by the Express server or a static host
- Production deployment: Self-hosting setup scripts available in `setup-vps.sh`

---

*Stack analysis: 2026-06-05*
*Update after major dependency changes*
