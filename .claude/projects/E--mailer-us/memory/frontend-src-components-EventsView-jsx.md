---
name: frontend-src-components-EventsView-jsx
description: Real-time delivery event monitoring interface with Server-Sent Events connection, filtering, statistics, and queue management capabilities.
metadata:
  type: project
---

**Purpose**: Provides real-time monitoring of email delivery events (sent, deferred, bounced) via Server-Sent Events connection, with capabilities to filter, search, export failed emails, clear/flush queues, and delete events.

**Dependencies**:
- React hooks (useState, useEffect, useRef, useCallback)
- EventSource API for SSE connection
- ../utils/api (apiFetch)
- localStorage for token retrieval
- Various inline SVG icon components

**Inputs**:
- user prop (object with role property)
- showToast prop (function for displaying notifications)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /api/events/stream?token={token} (SSE connection for real-time events)
- POST /api/events/clear-queue (clear deferred messages)
- POST /api/events/flush-queue (flush queue immediately)
- GET /api/events/export-failed?token={token} (export failed emails as CSV)
- DELETE /api/events (delete all events)
- DELETE /api/events/:id (delete specific event)

**Potential Risks**:
- SSE connection creates new EventSource on every mount without cleanup of previous connections (though useEffect cleanup function exists)
- Client-side event storage limited to 1000 events (shift() when exceeded) - may lose historical data
- Uses localStorage directly for token retrieval (couples to browser storage)
- No validation on campaignId/recipientId in SSE events before storing
- Delete all events endpoint uses raw fetch with token from localStorage instead of apiFetch (duplicates auth logic)
- No rate limiting on queue clearing/flushing operations
- No confirmation for individual event deletion beyond window.confirm
- No optimization: filteredEvents recomputed on every render despite useCallback potential
- No virtualized list for large event sets - could cause performance issues with many events
- No error handling for SSE reconnection attempts (just logs errors)
- No metrics or monitoring of SSE connection health
- No accessibility labels on some icon buttons
- No optimization: formatTime/formatDate functions recreate Date objects on every render
- No cleanup of eventSourceRef on component unmount beyond closing connection