---
name: frontend-src-components-EmployeeDetailView-jsx
description: Detailed view of a specific employee showing their campaigns, sending statistics, and campaign list with navigation capabilities.
metadata:
  type: project
---

**Purpose**: Displays detailed information about a specific employee/user including their campaigns, sending statistics (sent/failed/running/completed counts), and a navigable list of their campaigns.

**Dependencies**:
- React hooks (useState, useEffect)
- useParams and useNavigate hooks from react-router-dom
- ../utils/api (apiFetch)
- showToast prop for notifications

**Inputs**:
- id parameter from URL (via useParams)
- showToast prop (function for displaying notifications)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /users/employees/{id} (load employee details)
- GET /users/employees/{id}/campaigns (load employee's campaigns)

**Potential Risks**:
- No validation on employee ID parameter from URL
- No loading states for individual API calls (only overall loading state)
- No error handling for individual API calls in Promise.all (reliant on apiFetch error handling)
- No pagination for campaigns list - could become slow with many campaigns
- No search/filter functionality for campaigns list
- No optimization: totalSent/totalFailed/draftCount/etc. computed on every render despite being derivable from campaigns state
- No handling of extremely large campaign lists
- No accessibility labels on campaign cards
- No confirmation for navigation actions
- No loading states for campaign navigation
- No error handling for navigation failures