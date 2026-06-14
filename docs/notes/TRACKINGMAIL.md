# Email Tracking System — Implementation Plan

> Open tracking (pixel) + Click tracking (redirect) + Analytics Dashboard
> Current status: ❌ NOT IMPLEMENTED

---

## Overview

Two tracking mechanisms need to be added:

1. **Open Tracking** — Invisible 1×1 pixel embedded in email HTML.
   When the recipient loads images, the pixel request hits our server,
   logging the open event.

2. **Click Tracking** — Every link in the email body gets wrapped with
   a redirect URL that goes through our server first (logs the click),
   then forwards to the original destination.

Both feed into a stats dashboard showing open rates, click rates, and
per-campaign performance.

---

## 1. Data Model — `backend/src/models/Tracking.js` (NEW)

```js
const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    type: {
      type: String,
      enum: ['open', 'click'],
      required: true,
      index: true
    },
    url: {
      type: String,
      default: null
      // populated only for 'click' events — the original destination
    },
    metadata: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
      country: { type: String, default: null } // optional geoip later
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast per-campaign aggregation
trackingEventSchema.index({ campaignId: 1, type: 1 });

// TTL index: auto-delete events older than 90 days
trackingEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('Tracking', trackingEventSchema);
```

---

## 2. Tracking Endpoints — `backend/src/routes/tracking.js` (NEW)

These are **public** routes (no auth). They need to be fast and lightweight.

### 2a. Open Pixel

```
GET /track/open/:campaignId/:recipientId
```

- Returns a 1×1 transparent GIF (43 bytes)
- Logs `{ type: 'open', campaignId, recipientId }` to Tracking collection
- Ignores duplicate opens from same recipient (check if already logged)

**Response:**
```
Content-Type: image/gif
Cache-Control: no-store, no-cache, must-revalidate
```
```
GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;
```

### 2b. Click Redirect

```
GET /track/click/:campaignId/:recipientId
```

Query param: `?url=https://original-destination.com/page`

- Logs `{ type: 'click', campaignId, recipientId, url }` to Tracking
- Returns `302 Redirect` to the original `url` parameter
- Validates the URL parameter is present (400 if missing)

### 2c. Register routes in server.js

```js
const trackingRoutes = require('./routes/tracking');
app.use('/track', trackingRoutes);
```

**Must be registered BEFORE the catch-all `*` handler** in `backend/src/server.js`.

---

## 3. Content Injection — `backend/src/controllers/campaignController.js`

### 3a. Inject Tracking Pixel (in `createCampaign`)

After receiving `htmlContent`, append the tracking pixel.

The pixel URL is constructed using the server's base URL from env:

```
BASE_URL=https://mailer.yourvps.com
```

```js
const injectTrackingPixel = (htmlContent, campaignId, baseUrl) => {
  const pixelUrl = `${baseUrl}/track/open/${campaignId}/{{recipientId}}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
  return htmlContent + pixel;
};
```

Note: `{{recipientId}}` is a placeholder. The actual recipient ID is
substituted at send time by the worker.

### 3b. Wrap Links for Click Tracking (in `createCampaign`)

Parse the HTML content for all `<a href="...">` tags and wrap them:

```js
const wrapLinksForTracking = (htmlContent, campaignId, baseUrl) => {
  return htmlContent.replace(
    /<a\s+(?:[^>]*?\s+)?href="([^"]+)"/gi,
    (match, url) => {
      // Skip already-wrapped links
      if (url.startsWith(baseUrl + '/track/')) return match;
      // Skip mailto: links
      if (url.startsWith('mailto:')) return match;
      const encoded = encodeURIComponent(url);
      const trackUrl = `${baseUrl}/track/click/${campaignId}/{{recipientId}}?url=${encoded}`;
      return match.replace(`href="${url}"`, `href="${trackUrl}"`);
    }
  );
};
```

Apply both in `createCampaign` before saving:

```js
const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
let processedHtml = injectTrackingPixel(htmlContent, null, baseUrl);
processedHtml = wrapLinksForTracking(processedHtml, null, baseUrl);
// Store the template WITH placeholders, not actual IDs
// The {{recipientId}} gets replaced at send time
```

### 3c. Recipient ID Substitution (in `processEmailJob` in worker.js)

In the worker, before sending, replace `{{recipientId}}` with the actual ID:

```js
const finalHtml = htmlContent.replace(
  /\{\{recipientId\}\}/g,
  recipientId.toString()
);
```

This must happen AFTER the tracking pixel and link wrapping were already
injected (at campaign creation time).

---

## 4. Aggregation API — `backend/src/controllers/statsController.js` (NEW)

### 4a. Campaign Stats

```
GET /api/campaigns/:id/stats
```

Response:
```json
{
  "campaignId": "...",
  "totalRecipients": 100,
  "sent": 95,
  "opens": 42,
  "uniqueOpens": 38,
  "openRate": "42.0%",
  "clicks": 15,
  "uniqueClicks": 12,
  "clickRate": "15.0%",
  "clickThroughRate": "31.6%",
  "events": [
    { "type": "open", "timestamp": "...", "metadata": { ... } }
  ]
}
```

### 4b. Overview Stats

```
GET /api/stats/overview
```

Response:
```json
{
  "totalCampaigns": 12,
  "totalSent": 4500,
  "totalOpens": 1200,
  "totalClicks": 340,
  "averageOpenRate": "26.7%",
  "averageClickRate": "7.6%"
}
```

### 4c. Register in routes

Add to `backend/src/routes/api.js`:

```js
const {
  getCampaignStats,
  getOverviewStats
} = require('../controllers/statsController');

router.get('/campaigns/:id/stats', protect, getCampaignStats);
router.get('/stats/overview', protect, getOverviewStats);
```

---

## 5. Base URL Config

Add to `backend/.env` / `backend/.env.example`:

```env
# Used for constructing tracking pixel and redirect URLs
# Must be the public URL where your API is accessible
BASE_URL=https://mailer.yourvps.com
```

---

## 6. Frontend — Dashboard Analytics Cards

### 6a. New Stats Summary in `DashboardView.jsx`

Add after the existing 4 summary cards:

```jsx
<article className="bg-white rounded-[24px] p-6 shadow-sm border border-border-light">
  <h3 className="text-base font-bold text-fg mb-4">Engagement</h3>
  <div className="grid grid-cols-3 gap-4">
    <div>
      <span className="text-[10px] font-bold text-fg-muted uppercase">Opens</span>
      <p className="text-2xl font-extrabold text-fg">{overview.totalOpens}</p>
      <span className="text-xs text-fg-muted">{overview.averageOpenRate} avg</span>
    </div>
    <div>
      <span className="text-[10px] font-bold text-fg-muted uppercase">Clicks</span>
      <p className="text-2xl font-extrabold text-fg">{overview.totalClicks}</p>
      <span className="text-xs text-fg-muted">{overview.averageClickRate} avg</span>
    </div>
    <div>
      <span className="text-[10px] font-bold text-fg-muted uppercase">CTR</span>
      <p className="text-2xl font-extrabold text-fg">
        {overview.totalOpens > 0
          ? Math.round((overview.totalClicks / overview.totalOpens) * 100) + '%'
          : '0%'}
      </p>
      <span className="text-xs text-fg-muted">click-through rate</span>
    </div>
  </div>
</article>
```

### 6b. Campaign Row Stats in Kanban / Table

In each campaign card (Kanban view), add:

```jsx
<div className="flex gap-3 text-[10px] font-bold text-fg-muted">
  <span>👁 {campaignStats.uniqueOpens} opens</span>
  <span>🖱 {campaignStats.uniqueClicks} clicks</span>
</div>
```

### 6c. Fetch Overview Stats

In `App.jsx`, add a new state + fetch alongside `loadDashboard()`:

```js
const [overviewStats, setOverviewStats] = useState(null);

const loadOverviewStats = async () => {
  try {
    const res = await apiFetch('/stats/overview');
    setOverviewStats(res);
  } catch { /* silent fail — non-critical */ }
};

// Call it in the session check alongside loadDashboard
```

---

## 7. Frontend — Campaign Detail Stats (New View)

### 7a. View File — `frontend/src/components/CampaignDetailView.jsx` (NEW)

Shows:
- Campaign name, subject, status
- Open / click timeline (list of events)
- Open rate gauge
- Click-through rate
- List of all tracked URLs with click counts

### 7b. Router Update — Add to `App.jsx`

```js
case 'campaign-detail':
  return (
    <CampaignDetailView
      campaignId={selectedCampaignId}
      onBack={() => setActiveView('overview')}
    />
  );
```

Add `selectedCampaignId` state.

### 7c. Add click handler in `DashboardView.jsx`

Make campaign cards/rows clickable to navigate to detail view.

---

## 8. Implementation Order

| Step | What | Files | Est. Complexity |
|---|---|---|---|
| 1 | Create Tracking model | `backend/src/models/Tracking.js` | Low |
| 2 | Create tracking routes (pixel + redirect) | `backend/src/routes/tracking.js` | Low |
| 3 | Register tracking routes in server.js | `backend/src/server.js` | Low |
| 4 | Add env var `BASE_URL` | `backend/.env.example` | Low |
| 5 | Inject pixel + wrap links in campaignController | `backend/src/controllers/campaignController.js` | Medium |
| 6 | Replace `{{recipientId}}` in worker | `backend/src/queues/worker.js` | Low |
| 7 | Create stats controller + aggregation queries | `backend/src/controllers/statsController.js` | Medium |
| 8 | Register stats routes | `backend/src/routes/api.js` | Low |
| 9 | Add overview stats fetch in App.jsx | `frontend/src/App.jsx` | Low |
| 10 | Add engagement cards to DashboardView | `frontend/src/components/DashboardView.jsx` | Low |
| 11 | Create CampaignDetailView | `frontend/src/components/CampaignDetailView.jsx` | High |
| 12 | Wire navigation to campaign detail | `frontend/src/App.jsx` | Low |

---

## 9. Duplicate & Edge Case Handling

| Edge Case | Handling |
|---|---|
| **Recipient opens email multiple times** | First open is logged. Subsequent opens update the timestamp of the existing record (or create a "re-open" count). Use `findOneAndUpdate` with `upsert`. |
| **Recipient clicks same link twice** | Log each click as a separate event (multiple clicks = genuine engagement signal). |
| **Email client pre-fetches pixel** | Some mail clients (Gmail, Outlook) cache images before the user opens. This inflates open rates. Acceptable limitation — industry standard. |
| **Link wrapping breaks email rendering** | Some email clients block links with complex redirect URLs. Use short, clean URLs: `/track/click/{campaignId}/{recipientId}?url={base64}` |
| **Missing recipientId in URL** | The pixel/click URL contains `{{recipientId}}`. If the worker fails to replace it (edge case), just log the event without recipientId rather than crashing. |
| **Rate limiter needed** | The `/track/*` routes are public. Add `express-rate-limit` with a generous limit (e.g., 100 req/min per IP) to prevent abuse. |
| **Bot / preview scans** | Services like LinkCheckers, Gmail link scanners will trigger the click endpoint. These are logged but can be filtered out in stats by user-agent patterns. |

---

## 10. Future Improvements (Out of Scope for v1)

- **Geolocation** — Use `request-ip` + `geoip-lite` to log country per open/click
- **Unsubscribe link tracking** — Track who unsubscribed and from which campaign
- **Real-time stats** — WebSocket push of open/click events to the dashboard
- **Export reports** — CSV export of tracking data per campaign
- **AMP for Email** — Interactive elements for real-time engagement
