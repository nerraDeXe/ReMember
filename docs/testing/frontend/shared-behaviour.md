# Shared frontend behaviour — workflow checks

Run these **seven shared cases once per relevant role, browser/environment or distinct layout**, reusing evidence from module workflows. They cover common behavior and are not extra page modules. Named variants remain part of their case: mark PASS only when every applicable variant passes; otherwise identify the failed variant.

Use test organisations A/B, real test record IDs and disposable accounts. Targeted failure/delay and precise expiry tests need controlled fixtures or request interception. All statuses remain **Not run**. See the [main guide](../../FRONTEND_TEST_CASES.md) for setup/evidence naming. Source references describe the reviewed workspace.

### SH-01 — Access rules and available navigation

1) **Test Case Title (Test Scenario):** Access rules and available navigation. **Steps:** Use signed-out, unverified, onboarding-incomplete, owner, active-member and pending-member accounts. Attempt `/member/dashboard?organisation=A` and `/admin/members?organisation=A`; inspect the account/portal navigation after each allowed transition.

   - Signed out → login; unverified → verification; verified but onboarding incomplete → onboarding. Verified users may open organisation setup during onboarding. Onboarded users with no selected organisation return to the permitted account home.
   - An ordinary member cannot open owner administration. A pending paid member is sent to checkout from dashboard/events/invoices/communication/membership and has no portal sidebar. Owners opening their own member checkout/membership routes return to account memberships.
   - Badges show My Account, Admin Console or Member Portal for the current area. Account-menu details identify the signed-in account; Profile/My Organisations/Find Organisations/Create Organisation links work and close the menu. The brand link returns to that area's home.
   - Owner Communication exposes Posts and Email Settings. Member Events is offered only for active membership with no expiry or a future expiry; test actual event eligibility in the events module. Desktop sidebar/mobile selector must expose the same allowed destinations and selected page.

2) **Screenshot of test + screenshot of code:** Capture the attempted/final URLs and state-specific screen/menu. Reuse account-state and mobile screenshots across these variants. Label evidence with `SH-01` and its variant. **Code:** [access/home/context rules — frontend/src/navigation.js, lines 64–95](../../../frontend/src/navigation.js#L64); [access gate and pending layout — frontend/src/App.jsx, lines 130–174](../../../frontend/src/App.jsx#L130); [brand/badge/account menu — frontend/src/components/Navbar.jsx, lines 12–109](../../../frontend/src/components/Navbar.jsx#L12); [role links and navigation controls — frontend/src/components/Sidebar.jsx, lines 19–105](../../../frontend/src/components/Sidebar.jsx#L19).

3) **Expected outcome:** The destination, visible actions, selected navigation and organisation role agree with the account state. Direct entry enforces the same frontend access rules as navigation. Hidden controls alone do not prove server authorisation.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### SH-02 — Direct links, sign-in return and route recovery

1) **Test Case Title (Test Scenario):** Direct links, sign-in return and route recovery. **Steps:** Open a protected own-invoice link while signed out, sign in as an eligible member, then repeat the URL variants below. Use real test IDs and hide reset tokens in evidence.

   - `/member/invoices?organisation=A&invoice=<OWN_INVOICE_ID>` must retain organisation/receipt through login and open that permitted destination. External `next` values (`https://example.com` and `//example.com`) must be ignored.
   - Refresh a valid pathname in the hosted app. A server HTTP 404 before React loads is a hosting failure; valid paths should reach session validation and the allowed screen.
   - `/member/pass?organisation=A` and `/member/renew?organisation=A` migrate to membership overview. `/#reset-password?token=<TEST_TOKEN>` migrates to the reset form without dropping its token.
   - An unknown path shows Page not found. Go to home reaches public landing when signed out or the permitted account home when signed in.

2) **Screenshot of test + screenshot of code:** Capture the login next value, restored/canonical destinations and unknown-page recovery. Include the HTTP result if direct refresh fails. Label evidence with `SH-02` and its variant. **Code:** [safe return destination — frontend/src/App.jsx, lines 69–92](../../../frontend/src/App.jsx#L69); [URLs and aliases — frontend/src/navigation.js, lines 35–61](../../../frontend/src/navigation.js#L35); [legacy replacement — frontend/src/routing.jsx, lines 13–19](../../../frontend/src/routing.jsx#L13); [not-found/recovery rendering — frontend/src/App.jsx, lines 143–150](../../../frontend/src/App.jsx#L143).

3) **Expected outcome:** Valid URLs and protected return destinations resolve with their relevant queries and current permissions. Legacy paths remain usable, external return URLs are rejected and unknown paths offer working recovery.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### SH-03 — History, URL-backed state and dialog closing

1) **Test Case Title (Test Scenario):** History, URL-backed state and dialog closing. **Steps:** On a long list page, set a URL-backed search/filter and open a query-driven receipt/editor. Navigate between pages, close/reopen the dialog, use Back/Forward and refresh. Also open the full dialog URL in a new tab.

   - Page/URL filters restore through history and refresh. Search configured with `replace:true` preserves unrelated query values and does not create a history entry per character. Unsaved form text is not assumed to survive reload and must not be serialized into the URL.
   - New page navigation starts at the top; Back restores the recorded scroll. The browser tab title follows the route.
   - An in-app dialog closes to its parent and Forward reopens it; a directly loaded dialog closes by removing its query without leaving the app or looping. All visible close controls preserve unrelated parent filters. Missing records and save behavior remain in module cases.
   - Ctrl-click/copy a portal link and open it in another tab: the native link behavior and required organisation context must be preserved.

2) **Screenshot of test + screenshot of code:** Capture before/after filters, URLs, scroll position, reopened dialog, direct-close result and copied/new-tab link. Reuse the owning module's dialog screenshots. Label evidence with `SH-03` and its variant. **Code:** [navigation/query/scroll/closeQuery — frontend/src/browserHistory.js, lines 14–60](../../../frontend/src/browserHistory.js#L14); [URL state and PageLink — frontend/src/routing.jsx, lines 23–48](../../../frontend/src/routing.jsx#L23); [page title — frontend/src/App.jsx, lines 98–100](../../../frontend/src/App.jsx#L98).

3) **Expected outcome:** The URL, screen and history entry stay consistent. Dialogs return to their appropriate parent; ordinary link actions, page titles and scroll restoration work.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### SH-04 — Organisation switching and late responses

1) **Test Case Title (Test Scenario):** Organisation switching and late responses. **Steps:** Use one account that owns A and belongs to B as a member. Open B from A through a valid portal URL with B's selection delayed, then exercise an inaccessible organisation and delayed reads/saves.

   - Show initialisation until B is selected; then check B's name, data, role and allowed page. An unavailable/deleted organisation must show an error and recover to the permitted home.
   - Delay an A read/save, switch to B and release A's response. It must not replace B data, close a new B editor or force navigation away.
   - For a representative editor, delay a save, close/reopen a different record in the same organisation, then release the old save: the newer editor/draft/query must remain. The old server action may still finish; inspect stored records before retrying.
   - Keep module-specific filter races, such as audit action response ordering, in the relevant module's filter case.

2) **Screenshot of test + screenshot of code:** Capture loading, final context/menu, selection error and request completion order. Include the affected module handler when checking a module-specific stale response. Label evidence with `SH-04` and its variant. **Code:** [organisation restoration — frontend/src/App.jsx, lines 50–67](../../../frontend/src/App.jsx#L50); [keyed portal context — frontend/src/App.jsx, lines 172–174](../../../frontend/src/App.jsx#L172); [refresh/request revision guards — frontend/src/context/AuthContext.jsx, lines 126–148](../../../frontend/src/context/AuthContext.jsx#L126); [context-change destination — frontend/src/navigation.js, lines 89–95](../../../frontend/src/navigation.js#L89).

3) **Expected outcome:** Organisation context is selected before the page mounts and permissions/data follow that context. Late client responses cannot overwrite a newer context, draft or destination.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### SH-05 — Session persistence, expiry and sign-out

1) **Test Case Title (Test Scenario):** Session persistence, expiry and sign-out. **Steps:** Sign in with and without Remember Me, refresh a protected page, test controlled expiry and sign out across two same-origin tabs. Repeat sign-out while a tab has a delayed authenticated response.

   - Valid sessions survive refresh after `/auth/me` validation. The client cap is one day normally or 30 days with Remember Me, bounded by `exp`. Fixtures require numeric `iat`/`exp` and the appropriate `rememberMe` flag; absent `iat` tests only the `exp` fallback. Both session types use localStorage, so closing a tab alone is not an expiry test.
   - Exercise expiry at the boundary, after returning tab focus, with a malformed token and with a controlled expiry response. While authenticated, return non-2xx (for example HTTP 401) with JSON `{"code":"SESSION_EXPIRED","message":"Session expired"}`; a 200 body containing that code does not exercise expiry. Protected access ends and the expiry path displays Your session has ended. Please sign in again.
   - Sign Out clears the session in both tabs. Back/refresh cannot restore an interactive protected page.
   - Delay verification/refresh/organisation selection in tab 1, sign out in tab 2, then release tab 1's response. Use the second tab because pending verification disables its sign-out button and context selection replaces navigation. The response must not recreate the session.

2) **Screenshot of test + screenshot of code:** Capture Remember Me selection, restored page, expiry message and both tabs after sign-out/late response. Record fixture duration and response order without exposing tokens. Label evidence with `SH-05` and its variant. **Code:** [session apply/load/login — frontend/src/context/AuthContext.jsx, lines 18–70](../../../frontend/src/context/AuthContext.jsx#L18); [logout/expiry/storage/request guards — frontend/src/context/AuthContext.jsx, lines 81–148](../../../frontend/src/context/AuthContext.jsx#L81); [expiry limits — frontend/src/session.js, lines 1–9](../../../frontend/src/session.js#L1); [expired-session event — frontend/src/api.js, lines 26–34](../../../frontend/src/api.js#L26); [Sign Out — frontend/src/components/Navbar.jsx, lines 112–122](../../../frontend/src/components/Navbar.jsx#L112); [expiry feedback — frontend/src/App.jsx, lines 94–96](../../../frontend/src/App.jsx#L94).

3) **Expected outcome:** Only valid unexpired sessions grant protected access. Sign-out and expiry clear the session, synchronise as implemented across tabs and resist late authenticated responses.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### SH-06 — Loading and action feedback

1) **Test Case Title (Test Scenario):** Loading and action feedback. **Steps:** During normal module runs, throttle a first-visit portal JavaScript chunk and trigger success, error and informational feedback. Dismiss one toast; let another expire.

   - With browser cache disabled, a not-yet-loaded portal chunk shows Loading page; the authenticated shell remains where applicable and the requested screen appears when loading completes.
   - Capture the relevant success/error/info toast from actual module actions. X removes only that message; default-duration feedback disappears after approximately four seconds.
   - Data-request failures remain in the module's own load/action case. A success toast alone does not prove a saved record, email arrival or external action.

2) **Screenshot of test + screenshot of code:** Reuse module screenshots showing loading, final page and each feedback type. Add manual/timed dismissal evidence once for the shared toast implementation. Label evidence with `SH-06` and its variant. **Code:** [lazy page imports — frontend/src/App.jsx, lines 9–36](../../../frontend/src/App.jsx#L9); [persistent shell/Suspense — frontend/src/App.jsx, lines 163–174](../../../frontend/src/App.jsx#L163); [toast creation/dismissal/rendering — frontend/src/context/ToastContext.jsx, lines 9–57](../../../frontend/src/context/ToastContext.jsx#L9).

3) **Expected outcome:** The user receives accurate loading and action feedback; loading completes, dismiss/timeout behavior works and messages are not mistaken for persistence/delivery evidence.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### SH-07 — Keyboard and responsive operation

1) **Test Case Title (Test Scenario):** Keyboard and responsive operation. **Steps:** Reuse each distinct form/layout's main workflow with Tab, Shift+Tab, Enter and Space, then inspect it at 360px width and 200% zoom using long accepted text. Module-specific country/tab/chart keyboard controls remain in their own feature cases.

   - Check visible focus, usable labels and keyboard activation of essential actions.
   - Check desktop/mobile navigation, content clipping, scrolling and access to modal footer actions. Reuse functional-run screenshots rather than repeating a separate full suite.
   - Capture the responsible page/control when a layout or accessibility problem appears, even if current source lacks explicit handling.

2) **Screenshot of test + screenshot of code:** Capture focus, narrow/zoomed layout and any blocked or clipped control, with its owning source block. Label evidence with `SH-07` and its variant. **Code:** [native-link behavior — frontend/src/routing.jsx, lines 39–48](../../../frontend/src/routing.jsx#L39); [account-menu semantics — frontend/src/components/Navbar.jsx, lines 57–63](../../../frontend/src/components/Navbar.jsx#L57); [navigation controls — frontend/src/components/Sidebar.jsx, lines 79–111](../../../frontend/src/components/Sidebar.jsx#L79); [responsive navigation — frontend/src/styles/navigation.css, lines 48–51](../../../frontend/src/styles/navigation.css#L48); [responsive shell — frontend/src/App.jsx, lines 162–173](../../../frontend/src/App.jsx#L162).

3) **Expected outcome:** Essential controls remain readable, labelled, reachable and operable across the tested layout/input variants. This is a manual quality check; no accessibility audit is claimed.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.
