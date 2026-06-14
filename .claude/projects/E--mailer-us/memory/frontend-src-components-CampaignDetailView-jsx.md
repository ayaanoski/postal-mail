---
name: frontend-src-components-CampaignDetailView-jsx
description: React view for displaying detailed statistics and actions for a specific campaign, including open/click tracking, failed deliveries, and email import.
metadata:
  type: project
---

**Purpose**: Shows analytics for a single campaign: delivery stats, open/click rates, link click breakdown, timeline of events, failed deliveries, and allows importing emails from failed lists into a new campaign.

**Dependencies**:
- react, react-router-dom hooks (useParams, useNavigate)
- ../utils/api (apiFetch)
- xlsx library (for export/import)
- Uses localStorage for token in fetch delete tracking.

**Inputs**:
- URL param campaignId (via useParams)
- Prop showToast (function)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /campaigns/:id/stats (loads data)
- DELETE /tracking/:id (delete tracking event)
- DELETE /campaigns/:id (delete campaign)
- POST /compose (via navigate with state importedEmails)

**Potential Risks**:
- Large amounts of data: stats.events could be large; component maps and filters client-side; could cause performance issues.
- Import/export uses client-side XLSX; large files may cause memory hog.
- Delete tracking event uses raw fetch with token from localStorage (instead of apiFetch); duplicates auth logic; missing error handling for network.
- Import modal uses regex to extract emails from txt/chunked processing; could be inefficient for huge files.
- No pagination for events timeline; could render thousands of rows.
- No lazy loading or virtualized list.
- No confirmation for bulk delete? Not present.
- No sanitization of recipient/URL before rendering (XSS risk if email contains HTML? but rendered as text).
- The unsubscribe tracking type uses same open icon? Actually uses different SVG.
- The status badge colors are hardcoded.
- No loading states for delete actions.
- No optimization: useMemo for filteredEvents depends on events and searchQuery; events may change on each load causing recompute.
- The chunked file reading uses setTimeout recursion; could block UI.
- No validation that imported emails are unique or belong to domain.
- No error handling for export (writeFile may fail silently).
- Uses window.localStorage directly in component; couples to browser.
- No accessibility labels on some icons.