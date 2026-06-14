# External Integrations

**Analysis Date:** 2026-06-05

## APIs & External Services

**Email Delivery:**
- Custom Postfix SMTP Mail Relay - Used for sending outgoing emails.
  - SDK/Client: `nodemailer` npm package in `backend/src/queues/worker.js`
  - Integration: SMTP connection on local port `25` (or custom `MAIL_RELAY_PORT`, e.g., `2525` in VPS deployment)
  - Auth: None (runs locally, restricted to localhost in Docker Postfix relay container)
  - Configuration env vars:
    - `MAIL_RELAY_HOST` (default `mail`)
    - `MAIL_RELAY_PORT` (default `25`)
    - `MAIL_RELAY_IGNORE_TLS` (controls ignoring TLS validation, default `true`)

**Domain DNS Verification:**
- DNS/Authoritative Nameserver Queries - Verifies SPF, DKIM, MX, and DMARC settings for sending domains.
  - SDK/Client: Built-in `dns/promises` Resolver in `backend/src/utils/dnsVerifier.js`
  - Servers used: Public resolvers `8.8.8.8`, `8.8.4.4`, `1.1.1.1` to find authoritative name servers, then queries authoritative name servers directly to avoid DNS propagation delays.
  - Features checked:
    - MX record existence
    - SPF record presence (`v=spf1`)
    - DKIM record match (`v=DKIM1`) for selector
    - DMARC record presence (`v=DMARC1`)

## Data Storage

**Databases:**
- MongoDB Atlas / MongoDB Database - Stores users, domains, campaigns, and delivery status logs.
  - Client: `mongoose` v8.9.5 (`backend/src/config/db.js`)
  - Connection: Configured via the `MONGO_URI` environment variable.
  - Models:
    - User: `backend/src/models/User.js`
    - Domain: `backend/src/models/Domain.js`
    - Campaign: `backend/src/models/Campaign.js`

**Queues & Scheduling:**
- Redis / BullMQ - Asynchronous queueing system for processing campaign email dispatching.
  - Client: `bullmq` v5.34.4 (`backend/src/config/queue.js` and `backend/src/queues/worker.js`)
  - Connection: Configured via `REDIS_HOST` (default `127.0.0.1`) and `REDIS_PORT` (default `6379`)
  - Queue name: `emailSendingQueue`

## Authentication & Identity

**JWT Auth Provider:**
- Custom JWT Auth - Token-based API access control.
  - Implementation: `jsonwebtoken` and `bcryptjs` in `backend/src/controllers/authController.js`
  - Token storage: Client-side `localStorage` (`mailerToken` and `mailerUser` stored via `frontend/src/utils/api.js`)
  - Verification: `Authorization: Bearer <token>` header checked by middleware on protected routes.
  - Secret: Configured via `JWT_SECRET` environment variable.

## CI/CD & Deployment

**Hosting & Infrastructure:**
- PM2 & Docker on Ubuntu VPS (e.g., Hostinger VPS) - Main deployment environment.
  - Provisioning: Automating system configuration via `setup-vps.sh`.
  - PM2 processes:
    - `mailer-api` (runs Express app at `backend/src/server.js`)
    - `mailer-worker` (runs BullMQ worker at `backend/src/queues/worker.js`)
  - Docker containers:
    - `mailer-postfix-relay` (runs Postfix relay defined in `backend/docker/` and `backend/docker-compose.yml`)

## Environment Configuration

**Development:**
- Env files: `backend/.env` (gitignored, configured from `backend/.env.example`)
- Critical vars:
  - `MONGO_URI`
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `JWT_SECRET`
  - `MAIL_RELAY_HOST`
  - `MAIL_RELAY_PORT`

**Production:**
- Managed via VPS deployment environment. Variables are written to `backend/.env` during the script run of `setup-vps.sh`.

---

*Integration audit: 2026-06-05*
*Update when adding/removing external services*
