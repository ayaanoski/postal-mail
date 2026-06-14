---
name: frontend-src-components-SettingsView-jsx
description: SMTP configuration management interface for setting up multiple personal SMTP servers for rotative campaign delivery.
metadata:
  type: project
---

**Purpose**: Allows users to configure and manage multiple personal SMTP configurations (Brevo, SparkPost, VPS/Postal, Custom) for use in campaign sending rotations, with testing capabilities and global/server-wide configuration toggle.

**Dependencies**:
- React hooks (useState, useEffect)
- ../utils/api (apiFetch)
- showToast prop for notifications

**Inputs**:
- showToast prop (function for displaying notifications)

**Outputs**: Renders UI; interacts with API endpoints:
- GET /smtp-config (load all SMTP configurations)
- POST /smtp-config (create new SMTP configuration)
- PUT /smtp-config/{id} (update existing SMTP configuration)
- DELETE /smtp-config/{id} (delete SMTP configuration)
- POST /smtp-config/test (test SMTP connection for form or specific config)

**Potential Risks**:
- No validation on form fields beyond basic HTML5 validation
- Password field shows/hides but doesn't prevent autocomplete in some browsers
- VPS HTTP API URL field only appears for VPS provider but SMTP port/host fields remain editable
- No loading states for individual test operations (only overall testing state)
- No optimization: handleProviderChange resets form fields but could cause unnecessary re-renders
- No validation that VPS API URL is actually a valid URL
- No confirmation for delete operation beyond window.confirm
- No handling of extremely large number of SMTP configurations
- No accessibility labels on action buttons
- No optimization: form state variables updated individually despite being related
- No handling of duplicate configuration names
- No validation that SMTP port is within valid range (1-65535)
- No masking of password in logs/network requests (though apiFetch may handle this)
- No rate limiting on test connection attempts
- No feedback on password strength or requirements
- No handling of special characters in SMTP credentials