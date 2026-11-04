# Frontend styling

JSX uses short, descriptive class names. The styling configuration lives in CSS and uses Tailwind's `@apply` directive. Tailwind expands those utilities during the build; no runtime styling library is needed.

For example, the event schedule now reads:

```jsx
<li className="event-schedule-day">
```

Its appearance is defined in `frontend/src/styles/event-display.css`:

```css
@layer components {
  .event-schedule-day {
    @apply flex flex-wrap items-center justify-between gap-x-3 gap-y-1;
  }
}
```

## Finding a style

| File | Contents |
| --- | --- |
| `frontend/src/index.css` | Stylesheet imports, theme variables, fonts, base styles, scrollbars, rich-text editor internals and email previews |
| `frontend/src/styles/interface.css` | Shared headings, labels, stacks, rows, panels, tables and directory filters |
| `frontend/src/styles/controls.css` | Reusable inputs, focus treatments, buttons, choices, badges and control sizing |
| `frontend/src/styles/components.css` | Dialogs, checkout, membership cards, post cards, editor controls and other component details |
| `frontend/src/styles/analytics.css` | Shared charts, dashboard and event analytics controls, metrics and loading states |
| `frontend/src/styles/invoice.css` | Invoice receipts and print presentation |
| `frontend/src/styles/pages.css` | Authentication, account tabs, organisation setup and posts pages |
| `frontend/src/styles/directory-pages.css` | Public organisation directory, organisation management and directory dialogs |
| `frontend/src/styles/admin-pages.css` | Admin lists, analytics, email settings, tier management and badge controls |
| `frontend/src/styles/member-pages.css` | Member dashboard, membership actions, events, organisations and profile |
| `frontend/src/styles/navigation.css` | Navbar, sidebar, country selector, organisation images and toast notifications |
| `frontend/src/styles/event-display.css` | Event schedules, locations, event statuses and membership status badges |

Appearance configurations live in the styles folder across member, admin, public and shared JSX files, including conditional states. One or two local utilities remain for small adjustments. Shared names such as `page-title`, `field-label`, `form-grid`, `panel-card`, `control-input` and `button-primary` appear across multiple components, so changing their definition updates all their consumers.

## Editing styles

Change the utilities in the relevant CSS rule. For example, changing `gap-x-3` to `gap-x-4` in `event-schedule-day` increases horizontal spacing without editing the component.

Responsive and interactive styling also belongs in CSS:

Common appearance, alignment and component details compose as short names:

```jsx
<button className="button-primary row-inline profile-save">Save Profile</button>
```

```css
.button-primary { @apply rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold; }
.row-inline { @apply flex items-center gap-2; }
.profile-save { @apply py-2.5 px-6 text-sm transition-colors shadow-sm active:scale-[0.99]; }
```

Reuse an existing class before adding another rule. Keep component rules focused on their remaining details; applying the shared classes in JSX avoids repeatedly expanding them inside other CSS rules. Identical CSS rules can share selectors, as with `panel-compact`, `analytics-chart` and `analytics-card`.

Repeated text, state and layout patterns also have shared names: `text-strong`, `text-identifier`, `tab-selected`, `state-inactive`, `progress-track`, `panel-body` and `form-actions`. Prefer those names to page-specific copies of the same declarations. Keep related rules in their focused stylesheet instead of growing a single page or component file.

JSX still chooses which state applies:

```jsx
<span className={`membership-status-badge ${active
  ? 'membership-status-active'
  : 'membership-status-inactive'}`}>
```

The state names refer to CSS rules; they do not contain the colours or layout configuration themselves.

Keep complete class names in JSX or configuration objects. Constructing part of a class name dynamically can prevent Tailwind from detecting that the corresponding component-layer rule is used.

## Cascade and existing conventions

The reusable navigation/event styles are imported before the page styles, allowing explicit page classes passed to shared components to override defaults. The keyboard-focus fallback is in the base layer so component focus styles retain their previous precedence.

Font-size utilities also set line height. When combining base and variant classes, check the result at each breakpoint. Preserve existing responsive sizes, explicit line heights and state-specific overrides when extracting a new pattern.

Place the base `post-title` rule before its featured variant. This lets `sm:text-2xl` retain its original 32px line height instead of inheriting the base `leading-snug` value at that breakpoint.

Two small Tailwind markers remain where appropriate: `group` connects a parent's hover state to its children, and `sr-only` provides accessible text without visible layout. They do not contain the long appearance configurations removed from JSX.

Values calculated at runtime, such as chart colours, progress-bar widths and an organisation's selected badge colour, remain inline styles. Their values depend on application data rather than a fixed CSS class.

The active pipeline uses Tailwind 3 through PostCSS. Extract the existing supported utilities without introducing a different framework or new visual effects. The event editor overlay resets its margin in CSS to preserve its positioning inside pages with sibling spacing.

## Scope and tradeoff

The latest cleanup changes 42 JSX files and shortens 506 class string/template fragments. An audit of all 53 JSX files, including image class props, conditional styles and configuration objects, found no class fragment containing three or more raw utility names. Shared patterns and small local adjustments keep class lists short. The shared and page/component stylesheets changed in this pass are each under 150 lines; the pre-existing navigation and event-display files retain their own organization. Rules use one readable declaration block per line, and matching definitions share selectors or use a shared class.

Named rules have a compiled-size tradeoff: the production stylesheet is approximately 211.8 kB (23.4 kB gzip), compared with approximately 164.6 kB (18.9 kB gzip) at the start of this cleanup. JSX source shrinks by about 7.3 kB, and CSS source grows by about 27.8 kB. These are source and bundle measurements, not measured page-load performance. The goal is compact, reusable source styles and readable JSX; extracting utilities into named rules does not guarantee a smaller production bundle. Composing shared classes directly in JSX reduces expansion compared with nesting shared `@apply` rules.

No JSX files or dependencies were added for the styling migration. Existing page logic, validation, API operations and routing remain in their components.

## Verification

The cleanup passed all 72 frontend tests, all 45 browser regression scenarios and the production build. Lint completed with existing warnings and no errors. A comparison against the source saved immediately before this cleanup confirmed unchanged component logic, non-style attributes and expanded utility sets across all 506 changed fragments.

Run these commands inside `frontend`:

```text
npm test
npm run lint -- src tests
npm run build
```

The browser regression suite is `frontend/tests/navigation-browser.mjs`; its header describes how to start the application and headless Chrome. Its event-card lookup now uses `data-event-card` rather than a Tailwind layout class.

Browser style checks passed 22,239 class-combination comparisons with no computed-style differences. They compare full class combinations and their styled ancestors at 390, 768 and 1440 pixels, including normal, disabled, focus, hover, active and print configurations. The final source sweep covers 1,093 combinations; additional checks cover the final directory/image changes. These checks caught and verified the fix for the featured post title's responsive line-height precedence during extraction. Mobile membership and checkout screenshots were also inspected. The comparisons cover representative fixtures and class combinations rather than every possible live data combination.
