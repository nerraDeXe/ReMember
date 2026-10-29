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
| `frontend/src/styles/interface.css` | Shared headings, fields, tables and icons, followed by component/page sections labelled with their JSX file paths |
| `frontend/src/styles/navigation.css` | Navbar, sidebar, country selector, organisation images and toast notifications |
| `frontend/src/styles/event-display.css` | Event schedules, locations, event statuses and membership status badges |

Search the CSS files for the class shown in JSX. Names describe the element's purpose: `profile-avatar-section`, `membership-summary`, `post-card-title` or `navbar-account-menu`.

Shared names such as `page-title`, `field-label`, `data-table-cell` and `icon-small` intentionally appear in several components. Changing their definition updates all their consumers.

## Editing styles

Change the utilities in the relevant CSS rule. For example, changing `gap-x-3` to `gap-x-4` in `event-schedule-day` increases horizontal spacing without editing the component.

Responsive and interactive styling also belongs in CSS:

```css
.profile-save-button {
  @apply py-2.5 px-6 rounded-lg bg-brand-primary text-brand-ink;
  @apply hover:bg-brand-secondary active:scale-[0.99];
}
```

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

Font-size utilities also set line height. When combining base and variant classes, check the result at each breakpoint. The post-card title rules preserve the previous compact line height and responsive title sizes explicitly.

Two small Tailwind markers remain where appropriate: `group` connects a parent's hover state to its children, and `sr-only` provides accessible text without visible layout. They do not contain the long appearance configurations removed from JSX.

Values calculated at runtime, such as chart colours, progress-bar widths and an organisation's selected badge colour, remain inline styles. Their values depend on application data rather than a fixed CSS class.

The active pipeline uses Tailwind 3 through PostCSS. Several legacy strings (including `shadow-xs`, `border-3`, `backdrop-blur-xs`, `no-scrollbar`, `h-15`, `animate-fadeIn` and `animate-scaleUp`) produced no styles in that configuration. They were omitted during extraction instead of adding new visual effects.

## Scope and tradeoff

This change reorganises styling across the frontend; it does not reduce the total number of visual rules. Named component rules expand to CSS declarations, so the generated stylesheet is larger than a stylesheet made from highly reused atomic utilities. The production CSS changed from approximately 44.91 kB (8.56 kB gzip) to 353 kB (32 kB gzip). The purpose of this pass is easier-to-read JSX and an explicit place to edit appearance, rather than a smaller CSS bundle.

No JSX files or dependencies were added for the styling migration. Existing page logic, validation, API operations and routing remain in their components.

## Verification

The migration passed all 70 frontend tests, all 45 browser regression scenarios and the production build. Lint completed with existing warnings and no errors. Computed styles matched the saved build in 208 broad state comparisons and 48 final focused comparisons, covering desktop and mobile widths.

Run these commands inside `frontend`:

```text
npm test
npm run lint
npm run build
```

The browser regression suite is `frontend/tests/navigation-browser.mjs`; its header describes how to start the application and headless Chrome. Its event-card lookup now uses `data-event-card` rather than a Tailwind layout class.

The migration also compared computed browser styles with a saved production build at desktop and mobile widths, including focus, hover, disabled controls, selected states, rich-text posts and dialogs. These are representative fixture checks, not an assertion that every possible live data combination was exhaustively tested.
