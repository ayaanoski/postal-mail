# IPTor — Tor-Based IP Rotation Integration Plan

## Overview

Integrate [IPGhost](https://github.com/s-r-e-e-r-a-j/IPGhost) (Tor-based IP changer) into Mailer-US. The VPS routes all outgoing email connections through Tor's SOCKS5 proxy. Every N seconds, Tor switches to a new exit node = new public IP. SendGrid/Brevo sees each batch of emails coming from a different IP around the world.

---

## Part 1: VPS Setup — Deploy IPGhost

### Step 1: SSH into VPS

```bash
ssh root@187.127.138.51
```

### Step 2: Clone IPGhost repo

```bash
cd /opt
git clone https://github.com/s-r-e-e-r-a-j/IPGhost.git
cd IPGhost/IPGhost
```

### Step 3: Install IPGhost (Tor + dependencies)

```bash
sudo bash install.sh
# When prompted, enter 'y' to install
```

This installs:
- **Tor** — the SOCKS5 proxy (runs on `127.0.0.1:9050`)
- **curl** — for IP checking
- **jq** — for JSON parsing

### Step 4: Verify Tor is running

```bash
systemctl status tor
# Should show: active (running)

curl --socks5 127.0.0.1:9050 https://api.ipify.org
# Should return a Tor exit IP (not your VPS IP)
```

### Step 5: Configure Tor control port (required for automated IP switching)

Edit Tor config:

```bash
nano /etc/tor/torrc
```

Uncomment or add these lines:

```
ControlPort 9051
CookieAuthentication 0
```

Restart Tor:

```bash
systemctl restart tor
```

### Step 6: Test IP rotation manually

```bash
# Send NEWNYM signal to get a new IP
echo -e "AUTHENTICATE \"\"\r\nSIGNAL NEWNYM\r\n" | nc 127.0.0.1 9051

# Wait 3 seconds, then check new IP
sleep 3
curl --socks5 127.0.0.1:9050 https://api.ipify.org
```

You should see a different IP each time.

---

## Part 2: IPTor Node.js Backend Controller

The Express server will manage Tor directly — no bash script needed. The controller spawns/manages the rotation loop in pure Node.js.

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    VPS (187.127.138.51)                    │
│                                                            │
│  ┌──────────────────┐     ┌────────────────────────────┐  │
│  │  Node.js Server  │────▶│  Tor SOCKS5 (127.0.0.1:9050)│  │
│  │                  │     │                            │  │
│  │  /api/ip-changer │     │  Exit Node A (India)       │  │
│  │  /api/ip-changer │     │  Exit Node B (Netherlands) │  │
│  │  /events (SSE)   │     │  Exit Node C (USA)         │  │
│  └──────────────────┘     └───────────┬────────────────┘  │
│                                       │                    │
│                                       ▼                    │
│                              ┌──────────────────┐          │
│                              │    SendGrid SMTP  │          │
│                              │  (sees Tor exit IP)│          │
│                              └──────────────────┘          │
└────────────────────────────────────────────────────────────┘
```

### Controller Logic

**Start Sequence (`POST /api/ip-changer/start`):**

```
1. Check if Tor is running (verify 127.0.0.1:9050 is open)
2. If not, spawn Tor as child process
3. Load saved interval from DB (default: 30 seconds)
4. Start rotation loop:
   setInterval({
     a. Connect to Tor control port (127.0.0.1:9051)
     b. Send: AUTHENTICATE ""
     c. Send: SIGNAL NEWNYM
     d. Wait 3s for new circuit
     e. Fetch https://api.ipify.org through SOCKS5
     f. Fetch IP location from ip-api.com through SOCKS5
     g. Store: { currentIp, country, city, lastChanged }
     h. Broadcast SSE event to all connected browsers
     i. Update status record
   }, interval * 1000)
5. Return { status: "started" }
```

**Stop Sequence (`POST /api/ip-changer/stop`):**

```
1. Clear rotation interval
2. Store: running = false
3. Broadcast SSE event: { type: "stopped" }
4. Return { status: "stopped" }
```

**SSE Stream (`GET /api/ip-changer/events`):**

```
Keeps connection open. Pushes events:

event: ip-changed
data: {"ip":"185.129.61.4","country":"Netherlands","city":"Amsterdam","timestamp":"..."}

event: ip-changed
data: {"ip":"103.251.167.20","country":"India","city":"Mumbai","timestamp":"..."}

event: stopped
data: {}

event: error
data: {"message":"Tor not reachable"}
```

---

## Part 3: Email Sending Through Tor

### How Nodemailer routes through Tor

When IP Changer is running, the worker creates Nodemailer transports with a SOCKS5 proxy agent:

```
worker.js logic:

1. Check: is ipChanger running? (in-memory flag)
2. If YES:
   - create Nodemailer transport with:
     {
       host: smtpHost,
       port: smtpPort,
       auth: { user, pass },
       pool: false,
       socksProxy: 'socks5://127.0.0.1:9050',
       connectionTimeout: 30000,
       greetingTimeout: 30000
     }
   - Each email creates a new TCP connection through Tor
3. If NO:
   - Normal transport without SOCKS5 (direct connection)
```

### Timing Example (30s interval, 5s email delay)

```
T+0s:    NEWNYM signal → Exit IP 103.251.167.20 (India)
T+0s:    Send email 1 → SendGrid sees 103.251.167.20
T+5s:    Send email 2 → SendGrid sees 103.251.167.20
T+10s:   Send email 3 → SendGrid sees 103.251.167.20
T+15s:   Send email 4 → SendGrid sees 103.251.167.20
T+20s:   Send email 5 → SendGrid sees 103.251.167.20
T+25s:   Send email 6 → SendGrid sees 103.251.167.20
T+30s:   NEWNYM signal → Exit IP 185.129.61.4 (Netherlands)
T+30s:   Send email 7 → SendGrid sees 185.129.61.4
T+35s:   Send email 8 → SendGrid sees 185.129.61.4
...cycles...
```

**6 emails per IP, then switches.** At higher intervals, more emails per IP.

---

## Part 4: Frontend UI

### 4a. Settings Page — IP Changer Section

```
┌──────────────────────────────────────────────────────────────┐
│  🔄 IP Changer                                               │
│                                                              │
│  ── Configuration ─────────────────────────────────────────  │
│                                                              │
│  IP Change Interval: [  30  ] seconds (range: 10-300)       │
│                                                              │
│  ── Status ────────────────────────────────────────────────  │
│                                                              │
│  Status:     ● RUNNING                                       │
│  Current IP: 185.129.61.4                                    │
│  Location:   Netherlands, Amsterdam                          │
│  Changed:    12 seconds ago                                  │
│  Next change: in 18 seconds                                  │
│  Uptime:     3 minutes 24 seconds                            │
│                                                              │
│  [Save Settings]                     [Stop IP Changer]       │
│                                                              │
│  -- OR --                                                    │
│                                                              │
│  Status:     ○ STOPPED                                       │
│  [Start IP Changer]                                          │
│                                                              │
│  ⚠ Warning: Tor exit IPs are on blocklists. Emails may      │
│   land in spam or be rejected by some providers.             │
└──────────────────────────────────────────────────────────────┘
```

### 4b. Campaigns Page — Top Banner (Live)

When IP Changer is running, a banner appears at the top:

```
┌──────────────────────────────────────────────────────────────┐
│  🔄 IP Changer ACTIVE                                        │
│  IP: 185.129.61.4 (Netherlands)  —  next change in 18s      │
│  [Stop IP Changer]                                            │
└──────────────────────────────────────────────────────────────┘
```

When stopped, no banner shown.

### 4c. Compose Page — Toggle Before Launch

```
┌──────────────────────────────────────────────────────────────┐
│  🔄 IP Protection                                            │
│                                                              │
│  [● ON — 185.129.61.4 → switches in 18s]                    │
│  [○ OFF — direct connection]                                 │
│                                                              │
│  ⚠ May affect deliverability                                 │
│                                                              │
│  [← Back]                                 [Save & Launch]    │
└──────────────────────────────────────────────────────────────┘
```

Toggling ON calls `/api/ip-changer/start`. Toggling OFF calls `/api/ip-changer/stop`.

### 4d. Real-time IP Display (All Pages)

Every page connects to the SSE endpoint `GET /api/ip-changer/events` when the user is authenticated. When a new IP event arrives:

```
1. Update the IP display everywhere (Settings, Campaigns, Compose)
2. Show a brief toast/notification: "IP changed to 185.129.61.4"
3. Restart the countdown timer to next change
```

The counter decreases every second: "next change in 18s" → "17s" → "16s" → ... → "0s" → IP changes → resets.

---

## Part 5: Files to Create/Modify

### Backend (5 files)

| # | File | Action | Lines |
|---|---|---|---|
| 1 | `backend/src/models/IpChangerSettings.js` | Create | ~25 lines — schema with intervalSeconds, userId |
| 2 | `backend/src/controllers/ipChangerController.js` | Create | ~250 lines — start/stop/status, Tor child process, rotation loop, SSE broadcast |
| 3 | `backend/src/routes/api.js` | Edit | ~12 lines — add 6 routes |
| 4 | `backend/src/server.js` | Edit | ~15 lines — SSE endpoint |
| 5 | `backend/src/config/relays.js` | Edit | ~8 lines — add socksProxy support to createTransportForUser |
| 6 | `backend/src/queues/worker.js` | Edit | ~15 lines — check ipChanger flag, add socksProxy if active |

### Frontend (4 files)

| # | File | Action | Lines |
|---|---|---|---|
| 7 | `frontend/src/components/SettingsView.jsx` | Edit | ~120 lines — add IP Changer section with interval/start/stop/realtime IP |
| 8 | `frontend/src/components/ComposeView.jsx` | Edit | ~60 lines — add toggle bar with live IP display |
| 9 | `frontend/src/components/CampaignsView.jsx` | Edit | ~40 lines — add top banner when running |
| 10 | `frontend/src/App.jsx` | Edit | ~30 lines — add ipChanger state, pass to components |

### Total: ~575 lines of new/modified code

---

## Part 6: Full Deployment Checklist

### VPS Preparation

| Step | Action | Verify |
|---|---|---|
| 1 | `apt update && apt install -y tor` | Tor installed |
| 2 | `systemctl enable --now tor` | Tor running on port 9050 |
| 3 | Add `ControlPort 9051` and `CookieAuthentication 0` to `/etc/tor/torrc` | Can send NEWNYM signals |
| 4 | `systemctl restart tor` | Port 9051 open |
| 5 | Test: `curl --socks5 127.0.0.1:9050 https://api.ipify.org` | Returns Tor exit IP (not VPS IP) |

### Application Deployment

| Step | Action |
|---|---|
| 6 | Pull latest code with IP Changer changes |
| 7 | `cd /opt/mailer-us/backend && npm install socks` |
| 8 | `pm2 restart mailer-api mailer-worker` |
| 9 | Open web app → Settings → IP Changer → Click Start |

### User Workflow

| Step | Action |
|---|---|
| 10 | Go to Settings → set interval → Save → Start |
| 11 | Campaigns page shows live IP banner |
| 12 | Create campaign → Compose page shows toggle |
| 13 | Toggle ON → Start campaign → emails go through Tor |
| 14 | Watch IP change in real-time every N seconds |

---

## Part 7: Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tor exit IPs on blocklists | Emails rejected or spam | Test with a small campaign first. Use if deliverability doesn't matter (testing/dev) |
| SendGrid flags erratic IPs | Account suspension | Keep interval high (60-120s). Don't use this for production sending to Gmail/Outlook |
| Tor connection slow | 10-30s per email instead of 1-2s | Increase Nodemailer timeouts to 30s+ |
| Tor not available in some regions | Start fails | Controller checks Tor availability before starting; shows error if missing |
| NEWNYM signal fails | IP doesn't change | Controller catches errors, retries, shows error in SSE stream |
| Tor process crashes mid-campaign | Emails stop going through proxy | Controller detects Tor disconnect, stops rotation, alerts user via SSE |

---

## Part 8: What Won't Work

| Scenario | Result |
|---|---|
| Sending to Gmail through Tor | ❌ 99% goes to spam |
| Sending to Outlook through Tor | ❌ 99% goes to spam |
| Sending to Yahoo through Tor | ❌ 99% goes to spam |
| Using Tor for high-volume campaigns | ❌ Too slow, timeouts likely |
| Expecting inbox delivery | ❌ Tor exit IPs have zero reputation |

**Realistic use case:** Testing, internal tools, or sending to servers that don't check blocklists. Not for production marketing campaigns to major email providers.
