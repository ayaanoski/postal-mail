# Task

## Design Context

### Users
Email operators, marketing professionals, and system administrators managing outbound email campaigns. They need precise controls (domain rotation, throttling) but expect a premium, visual tool that makes operations feel intuitive and satisfying.

### Brand Personality
Precise, modern, premium. Inspired by the Vendify layout: a friendly, highly-polished light-mode dashboard that uses organic curved shapes, soft shadows, vibrant pastel accent highlights, and clean typography to stand out from generic enterprise tools.

### Aesthetic Direction
- **Theme**: Light Mode with an ultra-clean, pale blue-grey background (`#f3f7f9`).
- **Typography**: Rounded, modern, professional sans-serif font ("Plus Jakarta Sans" or "Outfit").
- **Shapes**: High border-radius (`rounded-[24px]` to `rounded-[32px]`) for cards and inputs, conveying a premium and soft design language.
- **Accents**: 
  - Vibrant Lime Green (`#c4f772`) for active/primary card background, selected states, and highlighted tags.
  - Soft Orange (`#ff8243`) for charts and warning status.
  - Rich Charcoal/Black (`#131416`) for active navigation capsules and headers.
  - Soft pastel shadows and very light borders.

### Design Principles
1. **Wow at first glance**: A cohesive visual language with curated colors, professional iconography, and unified shape parameters.
2. **Clear visual hierarchy**: Large bold headers, structured information containers (white cards on light blue background), and distinct secondary elements.
3. **Immersive feedback**: Smooth micro-interactions on hover/focus, transition effects, and clean status representations.
4. **Data storytelling**: Custom interactive metrics, visual SVG representations (bar/donut charts), and clean calendar activity indicators.

---

## Todo List
- [x] Prepare styling foundation (fonts, colors, theme variables) in `index.html` and `index.css`
- [x] Update `Sidebar.jsx` to match the exact mockup sidebar design (white background, dark active capsules, badges, and chevrons)
- [x] Update `DashboardView.jsx` to build the full dashboard structure:
  - Welcome banner with user greeting and date/action controls
  - Stat cards grid (including one lime green highlight card and three white cards)
  - Layout switch (Table/Kanban) and search bar matching mockup
  - Premium custom SVG bar chart ("Delivery Activity") and donut chart ("Campaign Status Summary")
  - Calendar widget with styled active date highlights
  - Restyled Kanban columns and list view with rounded cards
- [x] Refactor `DomainsView.jsx` and `ComposeView.jsx` to use the premium input styling, rounded containers, and domain checklist cards
- [x] Apply the login/register aesthetic updates to match the overall design language
- [x] Verify the application works correctly and looks spectacular
