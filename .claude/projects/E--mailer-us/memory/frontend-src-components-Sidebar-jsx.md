---
name: frontend-src-components-Sidebar-jsx
description: Collapsible navigation sidebar providing access to all main application sections with user information, pending approvals badge for admins, and domain listing.
metadata:
  type: project
---

**Purpose**: Provides persistent navigation sidebar with access to Dashboard, Domains, Live Logs, Email Templates, Settings, Rules, and Employees (for admins). Includes user profile, logout functionality, and domain quick-access list.

**Dependencies**:
- React hooks (useState, useEffect)
- useNavigate and useLocation hooks from react-router-dom
- @solar-icons/react-perf for icons
- LocalStorage for auth token retrieval

**Inputs**:
- searchQuery (string) and setSearchQuery (function) for search synchronization
- domains (array) of domain objects for quick access list
- user (object) with role and email properties
- onLogout (function) for handling logout
- showToast (function) for displaying notifications
- sidebarOpen (boolean) and onCloseSidebar (function) for sidebar state control

**Outputs**: Renders UI; interacts with:
- LocalStorage to retrieve mailerToken for API calls
- FETCH API to /api/users/pending (for admin pending count)
- Navigation via useNavigate hook to various routes
- onCloseSidebar callback to close sidebar
- onLogout callback to handle logout
- showToast callback for notifications

**Potential Risks**:
- Direct use of localStorage for token retrieval (couples to browser storage)
- No error handling for failed fetch to /api/users/pending (silent failure)
- No loading state for pending count fetch
- No caching of pending count - fetches on every user change
- No optimization: mainMenuNav and preferencesNav objects recreated on every render
- No validation on domain objects before mapping to list items
- No handling of extremely long domain lists in sidebar
- No accessibility labels on icon-only buttons
- No keyboard navigation support for sidebar
- No trap focus when sidebar is open
- No closing of sidebar on escape key press
- No persistence of sidebar state across sessions
- No handling of resize events for sticky positioning
- No validation on user object before accessing properties
- No handling of missing user data
- No optimization: userInitial computed on every render despite being derivable from user state
- No handling of extremely long user names for initial display
- No validation on pathname parsing for activeView determination
- No handling of edge cases in URL parsing
- No loading states for navigation
- No error handling for navigation failures