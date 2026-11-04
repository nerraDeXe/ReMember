# ReMember refactoring notes

These changes reduce duplication and unnecessary work while keeping the existing account, organisation and portal flows.

## Styling follow-up — concise component design system

The frontend uses shared component and pattern classes in `frontend/src/styles/*.css` for common elements (headings, stacks, tables, badges, cards, filters), with short utilities for local adjustments. A follow-up extracts the remaining long class lists across 41 JSX files into shared controls and focused component, public/account, admin and member stylesheets. Each affected stylesheet stays under 150 lines; common button, input, card and layout styles compose as short class names in JSX.

See [the styling guide](docs/STYLING.md) for the stylesheet map, examples, state handling, cascade considerations and bundle metrics.

## Frontend structure and loading review — 29 October 2026

This pass focuses on `frontend/src/components`, `context`, `pages` and routing. Separate admin and member screens retain their responsibilities and URLs. Related small components now share a module where that makes the code easier to find.

### Measured changes in this pass

| Measure | Before | After |
| --- | ---: | ---: |
| JSX source files | 57 | 53 |
| JSX source lines | 8,889 | 8,767 |
| Main production JavaScript bundle | 565.27 kB | 273.82 kB |
| Main bundle with gzip | 150.53 kB | 83.94 kB |

Source counts cover `frontend/src`, including blank lines, and exclude tests, documentation, dependencies and generated files. The 11 plain JavaScript source files retain their original 494 lines. This is a net reduction of 122 implementation lines; it includes the replacement module and shared tier-loading hook.

The bundle comparison uses Vite's build output. The main bundle is about 52% smaller before compression and 44% smaller with gzip. This measures the entry bundle, not total JavaScript across every page or a measured page-load speed. Page chunks load on first visit and can then be reused by the browser. Splitting code produces more generated chunks even though there are fewer JSX source files.

### Where to find the combined code

| Previous file | Current location |
| --- | --- |
| `pages/ForgotPasswordPage.jsx` | `pages/PasswordRecoveryPage.jsx`, internal `ForgotPasswordPage` component |
| `pages/ResetPasswordPage.jsx` | `pages/PasswordRecoveryPage.jsx`, internal `ResetPasswordPage` component |
| `pages/member/CheckoutPage.jsx` | Named `CheckoutPage` export in `pages/member/MembershipPage.jsx` |
| `components/EventStatusBadge.jsx` | Named `EventStatusBadge` export in `components/EventSchedule.jsx` |
| `components/PageLink.jsx` | Named `PageLink` export in `routing.jsx` |

Both password forms keep their own state and validation. Switching between them discards form drafts as before. Checkout remains a separate routed component with its existing pending-membership, upgrade, renewal and receipt handling; sharing its source file does not combine these screens into one UI.

### What was simplified and optimised

- **Page loading:** `App.jsx` uses React's existing `lazy` and `Suspense` facilities for all page modules. The navigation bar and sidebar stay visible while authenticated pages load. Features such as event editing and analytics no longer need to load with the first public page.
- **Tier requests:** the internal `useMembershipTiers` hook lives beside membership management and checkout. It requests tiers only when one of those screens mounts, includes the captured organisation ID, and ignores completed requests after cleanup. Invoices and unrelated pages no longer trigger the app-wide tier request. Entering either membership screen fetches current tiers again; there is no long-lived cache that could retain another organisation's data.
- **Membership actions:** `updateMembership` shares the busy state, error handling, account refresh and completion steps used by cancellation and downgrade actions. The action callbacks still specify their own API operation, message and dialog query keys. Existing organisation and mounted-component checks remain in that shared path.
- **Status and audit labels:** small lookup tables replace the long activity switch and duplicate filter options. Status styles are defined once outside the component rather than rebuilt for each badge render. Labels, ordering, icons and styles are preserved.
- **Profile controls:** the address fields and notification checkboxes render from short lists of values and setters. Their state and submitted payload stay the same. The repeated address labels now also identify their inputs explicitly.
- **Contexts:** the toast provider keeps a stable context value so adding or removing a toast does not itself notify every toast-context consumer. Organisation selection reuses the existing authenticated-request helper, preserving its session-token checks.

**How to explain it:** "I grouped closely related components, replaced repeated presentation rules with small data tables, and kept shared request and update logic in one place. I also load page code and membership tiers when the relevant screen needs them. The purpose is code that is easier to follow and less unnecessary work on the initial visit."

### Verification for this pass

- All 70 frontend tests and 381 backend tests pass. Backend application code is unchanged.
- The browser suite covers 45 scenarios, including password history, organisation switching, invoice links, admin editing, demo payments, upgrades, cancellations, scheduled downgrades and event timing. Two added scenarios check tier requests on demand and password-form transitions. Its sign-in redirect check now waits for the loaded form as well as the URL.
- The production frontend build completes. Lint completes with warnings in the existing React code and no errors.
- Browser API calls use fixtures; backend tests mock database and delivery integrations. These checks do not constitute a production load test.

Run `npm test` in `frontend` and `backend`, and `npm run lint` and `npm run build` in `frontend`. The browser runner's setup instructions are at the top of `frontend/tests/navigation-browser.mjs`.

### Further refactoring boundaries

Large pages such as organisation management and the member directory contain different forms, permissions and asynchronous operations. Keeping those screens separate makes their behaviour easier to trace. Future improvements can target repeated form sections or request lifecycles individually, with coverage for loading errors, delayed responses and organisation changes. A single generic page or request hook would need to represent those differences explicitly and could increase complexity.

The rich-text editor also stays separate from its read-only renderer: members viewing posts do not need to download the editing tools. Fewer files and fewer lines are useful only while those boundaries remain clear.

## Earlier refactoring passes

## 1. One place for API request setup

File: `frontend/src/api.js`

Previously, each write request repeated its HTTP method and `JSON.stringify` call. Several list requests also repeated query-string construction, and CSV export had its own fetch and authentication code.

Small internal helpers now handle JSON writes and query strings. Named methods such as `api.updateProfile(...)` remain available to pages, so pages do not need to know how requests are assembled. CSV export uses the same authentication and error handling as other requests, including expired-session notifications.

**How to explain it:** "I applied DRY, meaning Don't Repeat Yourself, to the request setup. One place handles authentication, encoding and errors, while each named API method states the operation it performs. This makes future changes less likely to introduce inconsistencies."

This mainly improves maintenance and consistency; shorter request code does not itself reduce the number of HTTP calls.

## 2. Reuse organisation search logic

Files: `frontend/src/organisationDirectory.js`, `LandingPage.jsx`, `OrganisationsManagementPage.jsx`, and `member/MemberOrganisationsPage.jsx`.

Three pages previously implemented their own organisation filtering. They now call the pure `filterOrganisations` function with their search, category, visibility and searchable-field options. Their existing search fields are preserved. The function does not modify the input records.

The search query is trimmed and lowercased once per filtering operation, rather than repeatedly inside record comparisons. The pages use `useMemo` to reuse filtered results until the organisation data or filter inputs change; opening a dialog or changing a busy indicator does not require another list search.

**How to explain it:** "I separated data filtering from the page layout. The pages decide which filters apply, while a shared function performs the comparisons. This gives me one implementation to maintain and test. Memoization avoids repeating that work during unrelated renders."

Filtering still checks the supplied list. These changes do not replace pagination or server-side search for a much larger directory. Frontend visibility filtering also does not replace the backend's access checks.

## 3. Ask the database for the records the dashboard needs

File: `backend/routes/members.js`

Previously, the dashboard fetched every event in the selected organisation, then filtered for the member's RSVPs in JavaScript. It also fetched all the member's invoices, sorted them and kept five. The tier, event and invoice reads were awaited sequentially.

The event query now includes both `organisationId` and `'rsvps.userId'`. The invoice query includes the organisation and user, then uses `.sort({ createdAt: -1 }).limit(5)`. Invoice history also uses database sorting, while retaining its full list. `Promise.all` starts the independent dashboard reads together. Obsolete local-database compatibility and an unused variable were removed.

**How to explain it:** "I moved record selection, sorting and limiting to the database so the Node.js application receives only the dashboard records it needs. I also run independent reads concurrently. I kept user and organisation restrictions in the queries, and tests check both the returned data and the query constraints."

The dashboard still performs the same three kinds of reads. The improvement is less data returned to Node.js and fewer sequential waits, not a reduction in query count. MongoDB still performs the filtering and sorting. Actual latency depends on data size, indexes and network conditions; no production speed percentage has been measured.

## Code size

The first refactor changed the affected implementation files from 1,678 lines to 1,637, including the new shared filtering helper: a net reduction of 41 lines. This excludes tests, documentation and generated build files. Tests and explanations add lines deliberately; they make the smaller implementation easier to verify and maintain.

## Removing unused code

A separate cleanup removed another 236 implementation lines, without removing features:

- Deleted the 184-line Vite starter `frontend/src/App.css`. No file imported it. The stylesheet is tracked in Git, so its previous version remains recoverable from the repository history.
- Removed 23 lines of unused `.flat-card`, `.flat-panel` and `.flat-input` styling and the now-unused border variable from `index.css`. No component, HTML template or generated email uses those classes. Active focus and email-preview styles remain.
- Removed 21 unused Lucide icon imports, unused status-modal and activity-log state, and an unused expiration calculation. Replaced an event category state value that never changed with the same literal in the request payload. These frontend changes remove 21 physical lines; some import removals shorten an existing line.
- Removed an unreferenced backend function that only returned its input, an unused wallet-object binding, and the unused `config.JWT_EXPIRES_IN` property. Session durations still come from `services/sessions.js`. These remove five lines and the unused binding.
- Removed the immediately overwritten empty-array initialization and redundant user alias from the email-list route, saving three lines. Its query, sorting and authentication are unchanged.

Source references and JavaScript scope bindings were checked before removal. Active features, validation and access checks were retained. Removing code that was never imported or executed primarily reduces maintenance noise; it does not imply a significant measured speed improvement.

**How to explain it:** "I removed dead code after checking that it had no active callers or consumers. This reduces misleading state and obsolete styling, making the code easier to follow. I kept the existing feature paths and used automated tests and a production build to check for regressions."

## Verification

- Frontend tests cover request methods, bodies, query encoding, CSV downloads, session errors and organisation search combinations.
- Backend tests check RSVP privacy, organisation isolation, invoice ordering, the five-invoice dashboard limit and full invoice history.
- The production frontend build checks that the refactored components compile together.
- Database and email interactions in the automated backend tests are mocked; they do not use live member records or send emails.

Run `npm test` inside both `backend` and `frontend`, and `npm run build` inside `frontend`.

After both the refactor and unused-code cleanup, all 49 backend tests and 17 frontend tests passed, and the production build completed. The cleanup also passed JavaScript scope/reference checks and Git's whitespace check. Lint could not run during the earlier refactor because the existing Oxlint installation is missing its Windows native binding.

**A short explanation for the examination:** "I refactored repeated request and search logic into small reusable functions, and changed dashboard queries to retrieve only the required records. My goal was clearer responsibilities, consistent behaviour and less unnecessary work. I used regression tests to check that permissions, privacy and expected results were preserved. Fewer lines are a useful result, but readability and correctness are the main reasons for the changes."
