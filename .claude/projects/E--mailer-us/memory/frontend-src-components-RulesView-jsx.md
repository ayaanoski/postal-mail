---
name: frontend-src-components-RulesView-jsx
description: Reference guide for email HTML deliverability rules, compliance guidelines, and best practices for avoiding spam filters.
metadata:
  type: project
---

**Purpose**: Provides comprehensive reference documentation for email deliverability including HTML rules, sender/domain requirements, merge tag usage, tracking pixel guidelines, content rules, legal compliance, and pre-send audit checklists. Available in English and Bengali.

**Dependencies**:
- React hooks (useState)
- ReactMarkdown component for rendering markdown content
- remarkGfm plugin for GitHub-flavored markdown support
- showToast prop for notifications

**Inputs**:
- showToast prop (function for displaying notifications)

**Outputs**: Renders UI; provides clipboard copy functionality for:
- Email HTML Deliverability Rules (EN/BN)
- Example Compliant Invoice HTML
- Email Sending Tips to Avoid Spam (EN/BN)
- What Domain to Buy guide (EN/BN)

**Potential Risks**:
- No validation on clipboard content before copying
- No error handling for clipboard API failures beyond toast notification
- Large amount of static text content bundled in component (could impact bundle size)
- No search/filter functionality within the rules content
- No accessibility labels on language toggle buttons
- No optimization: rules object recreated on every render despite being static
- No handling of extremely long content rendering performance
- No markdown security considerations (though content is trusted/static)
- No responsive design considerations for very long code examples
- No syntax highlighting for code blocks in markdown
- No ability to expand/collapse all sections at once
- No persistence of expanded/collapsed state
- No loading states for markdown rendering