# IP Rotation System — Per-User IP Pools

## Overview

Each user gets their own isolated pool of floating IP addresses. When they send a campaign, the worker cycles through their pool — every N emails the source IP switches. No user's traffic touches another user's IPs. The recipient sees the SMTP provider's IP (SendGrid, Brevo, etc.), but the provider sees the connection coming from a rotating set of source IPs, reducing throttling triggers.

---

## Requirements

| Resource | Per User | Total (5 Users) |
|---|---|---|
| Floating IPv4 addresses | 3-5 | 15-25 |
| Monthly IP cost (Hetzner €0.50/IP) | €1.50-2.50 | €7.50-12.50 |
| Worker concurrency | — | 5 (1 per user) |

All floating IPs must be assigned to the same VPS network interface. The main VPS IP stays reserved for the web app and tracking — it never touches email sending.

---

## Data Model — IpPool

| Field | Type | Purpose |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `name` | String | Human label (e.g. "John's Pool") |
| `userId` | ObjectId (ref: User) | One pool per user, unique |
| `ips` | [String] | The user's dedicated floating IPs |
| `rotationBatchSize` | Number | Emails per IP before switching (default 50) |
| `currentIpIndex` | Number | Which IP in the array is active (starts 0) |
| `emailsOnCurrentIp` | Number | Counter of emails sent from the current IP |
| `isActive` | Boolean | If false, skip IP binding |
| `createdAt` | Date | Timestamp |

---

## API Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/ip-pools` | Admin | List all pools |
| `POST` | `/api/ip-pools` | Admin | Create pool (user + IPs + batch size) |
| `PUT` | `/api/ip-pools/:id` | Admin | Edit pool |
| `DELETE` | `/api/ip-pools/:id` | Admin | Delete pool |
| `GET` | `/api/ip-pools/user/:userId` | Admin | Get pool for a specific user |
| `GET` | `/api/ip-pools/my` | User | User sees their own pool |

---

## Core Logic — IP Determination (Worker)

For every email sent, the worker runs this sequence:

```
1. Load user's SMTP config (e.g. SendGrid)
2. Load user's IpPool
3. Check emailsOnCurrentIp vs rotationBatchSize:

   if emailsOnCurrentIp < batchSize:
       → increment emailsOnCurrentIp by 1
       → use ips[currentIpIndex] as localAddress

   if emailsOnCurrentIp >= batchSize:
       → advance currentIpIndex to next IP (wrap to 0)
       → reset emailsOnCurrentIp to 1
       → use ips[currentIpIndex] as localAddress

4. Create Nodemailer transport with localAddress = selected IP
5. Send email via SendGrid
```

The read-and-update must be a **single atomic MongoDB operation** to prevent race conditions when multiple worker threads handle the same user's emails.

---

## Transport — Nodemailer

| Setting | Value | Why |
|---|---|---|
| `localAddress` | Selected pool IP | OS binds the TCP socket to this source IP |
| `pool` | `false` | Must be false — pooling reuses sockets and prevents IP switching |

Without `pool: false`, the same TCP connection (and same source IP) would be reused for all emails.

---

## Concurrency

| Current | New | Reason |
|---|---|---|
| `concurrency: 1` | `concurrency: 5` | One per user — prevents blocking |

Without this, User B's campaign waits for User A's entire campaign to finish.

---

## Files to Create

| File | Type | What |
|---|---|---|
| `backend/src/models/IpPool.js` | Backend | Mongoose schema |
| `backend/src/controllers/ipPoolController.js` | Backend | CRUD handlers |
| `frontend/src/components/IPoolsView.jsx` | Frontend | Admin UI page |

## Files to Modify

| File | Changes |
|---|---|
| `backend/src/routes/api.js` | Add 6 new IP pool routes |
| `backend/src/config/relays.js` | Add `localAddress` parameter to `createTransportForUser()` |
| `backend/src/queues/worker.js` | Add IP pool resolution before sending; change concurrency to 5 |
| `frontend/src/App.jsx` | Add `/ip-pools` route |

---

## Full End-to-End Flow

```
Admin creates pool for User A: [IP1, IP2, IP3], batch size 50
Admin creates pool for User B: [IP4, IP5], batch size 100

User A adds SendGrid SMTP
User A creates campaign, 2000 recipients, launches

Worker picks email #1 for User A
  → Pool: currentIpIndex=0, emailsOnCurrentIp=0
  → No rotation needed, increment to 1
  → localAddress = IP1
  → Send → SendGrid sees connection from IP1

Worker picks email #2 for User A
  → Pool: emailsOnCurrentIp=1, no rotation
  → localAddress = IP1 (still same IP)

...continues for 50 emails...

Worker picks email #51 for User A
  → Pool: emailsOnCurrentIp=50 >= batchSize
  → Rotate: currentIpIndex=1, emailsOnCurrentIp=1
  → localAddress = IP2
  → Send → SendGrid sees connection from IP2

User B launches simultaneously
  → Worker concurrency allows parallel processing
  → Pool: [IP4, IP5], completely independent from User A
  → Sends from IP4, User A continues from IP2/IP3
```

---

## Delivery Path

```
Recipient's Browser ──main IP──→ Web App
                                      │
User A campaign:                      │
  Emails 1-50   → VPS (IP1) ──→ SendGrid ──→ Gmail
  Emails 51-100 → VPS (IP2) ──→ SendGrid ──→ Gmail
  Emails 101-150→ VPS (IP3) ──→ SendGrid ──→ Gmail

SendGrid logs: connections from IP1, IP2, IP3
Recipient sees in email headers: "Received: from smtp.sendgrid.net"
Your floating IPs never appear in the delivered email.
```

---

## Ways to Integrate

### Option A — Sequential (Recomended)
Implement in order:
1. Create IpPool model
2. Create controller + routes
3. Build admin UI
4. Modify `relays.js` to accept `localAddress`
5. Add pool resolution in worker
6. Bump concurrency
7. Buy floating IPs from Hetzner
8. Assign to VPS, create pools in admin panel

### Option B — Parallel (Faster)
Frontend and backend can be built simultaneously:
- **Backend team:** Model + controller + relays + worker
- **Frontend team:** Admin page + route + sidebar link
- Merge, test, deploy

### Option C — Staged Rollout
1. First: just the model + worker change + relays change (no admin UI)
2. Manually create pools in MongoDB shell for each user
3. Later: build the admin UI

---

## Hetzner Setup

1. Log in to Hetzner Cloud Console
2. Select your VPS (Cloud Server)
3. Go to **Floating IPs** → **Add Floating IP**
4. Choose IPv4, assign to your server
5. Repeat for each IP needed
6. The IPs appear on your server's network interface automatically
7. Verify: `ip addr show` — should list all floating IPs

Cost: €0.50/month per floating IPv4.

---

## Critical Requirements

| Requirement | Why |
|---|---|
| All floating IPs must be added to the VPS network interface | OS can't bind to an IP it doesn't own |
| Nodemailer `pool: false` | Connection pooling reuses the same source IP |
| Atomic MongoDB update for counter | Prevents race conditions at concurrency > 1 |
| Each user must have exactly one pool | Clean isolation, simple lookup |
