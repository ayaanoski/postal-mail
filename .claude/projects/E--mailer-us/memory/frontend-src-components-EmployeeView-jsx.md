---
name: frontend-src-components-EmployeeView-jsx
description: Employee management interface for admin users to approve pending registrations and manage approved employees/campaigns.
metadata:
  type: project
---

**Purpose**: Allows admin users to manage employee accounts - approve pending registrations, view approved employees with their campaign counts, and delete employees (with associated campaigns).

**Dependencies**:
- React hooks (useState, useEffect)
- useNavigate hook from react-router-dom
- ../utils/api (apiFetch)
- showToast prop for notifications

**Inputs**:
- showToast prop (function for displaying notifications)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /users/pending (load pending user registrations)
- GET /users/employees (load approved employees)
- POST /users/approve/{userId} (approve pending user)
- POST /users/reject/{userId} (reject pending user)
- DELETE /users/{userId} (delete employee and their campaigns)

**Potential Risks**:
- No validation on userId parameters in API calls
- Delete employee endpoint deletes user and all their campaigns without confirmation beyond window.confirm
- No loading states for individual approve/reject/delete operations
- No pagination for employees/pending lists - could become slow with many users
- No search/filter functionality for employees list
- No optimization: loadPending() and loadEmployees() called separately despite being independent
- No error handling for API calls in approve/reject/delete (reliant on apiFetch error handling)
- No accessibility labels on action buttons
- No confirmation for reject operation (only approve and delete have confirmations)
- No handling of extremely large user lists
- No soft delete functionality - permanent deletion of data
- No audit trail for employee approval/rejection/deletion actions