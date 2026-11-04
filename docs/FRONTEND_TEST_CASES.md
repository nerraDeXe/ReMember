# ReMember frontend manual test cases

Reviewed against the current workspace source on **2 November 2026**.

This checklist covers **all 24 frontend page source modules**, including screens exported from the same file and pages embedded in the account home. **Every module has at most eight cases.** Each case follows a user workflow with its related input and failure variants; repeated app-wide checks appear in a short shared checklist. Each case retains steps, UI/code screenshot instructions, source locations, expected results and an unmarked PASS/FAIL field.

**These are prepared manual cases; screenshots and observed results still need to be added after execution.** Source concerns remain identified in the relevant cases and do not establish a recorded manual FAIL. Coverage focuses on distinct behavior and relevant boundary/failure variants.

**Coverage:** 116 module cases + 7 shared cases = **123 workflow cases**. Related validation and failure variants stay within their workflow; every module has at most eight cases.

## Open the detailed checklists

| Checklist | Cases | Scope |
| --- | ---: | --- |
| [Public and account cases](testing/frontend/public-account.md) | 34 | Landing, login, registration, verification, recovery, onboarding, organisation setup and account tabs |
| [Member and shared-page cases](testing/frontend/member-shared.md) | 42 | Organisation management, posts, profile, membership/checkout, discovery, member dashboard, invoices and events |
| [Admin cases](testing/frontend/admin.md) | 40 | All eight admin page modules |
| [Shared frontend behaviour](testing/frontend/shared-behaviour.md) | 7 | Authentication gates, organisation context, sessions, browser history, navigation, loading, responsive layout and keyboard use |

The checklist groupings are for convenient reading. The source-directory counts remain **10 top-level page modules + 6 member modules + 8 admin modules = 24**. Checkout is part of `MembershipPage.jsx`; forgot/reset forms are both part of `PasswordRecoveryPage.jsx`. Organisation management and membership discovery are rendered inside `AccountHomePage.jsx` and can be reached from its tabs.

## Module index

Portal paths below normally include `?organisation=<test-organisation-id>`. Replace example IDs with records from your test environment. The account-profile page is an account route even though its source lives under `pages/member`.

### Public, account and shared pages

| No. | Module / test cases | Cases / IDs | Source file | Where to open it |
| --- | --- | --- | --- | --- |
| 1 | [Landing / public organisation directory](testing/frontend/public-account.md#landingpage) | 5 (LP-01–LP-05) | [LandingPage.jsx](../frontend/src/pages/LandingPage.jsx) | `/` |
| 2 | [Login](testing/frontend/public-account.md#loginpage) | 4 (LI-01–LI-04) | [LoginPage.jsx](../frontend/src/pages/LoginPage.jsx) | `/login` |
| 3 | [Registration (email and Google)](testing/frontend/public-account.md#registerpage) | 6 (RG-01–RG-06) | [RegisterPage.jsx](../frontend/src/pages/RegisterPage.jsx) | `/register`<br>`/register/google` |
| 4 | [Email verification](testing/frontend/public-account.md#verifyemailpage) | 4 (VE-01–VE-04) | [VerifyEmailPage.jsx](../frontend/src/pages/VerifyEmailPage.jsx) | `/verify-email` |
| 5 | [Password recovery (forgot and reset)](testing/frontend/public-account.md#passwordrecoverypage) | 5 (PR-01–PR-05) | [PasswordRecoveryPage.jsx](../frontend/src/pages/PasswordRecoveryPage.jsx) | `/forgot-password`<br>`/reset-password` |
| 6 | [Account onboarding](testing/frontend/public-account.md#accountonboardingpage) | 2 (AO-01–AO-02) | [AccountOnboardingPage.jsx](../frontend/src/pages/AccountOnboardingPage.jsx) | `/onboarding` |
| 7 | [Organisation setup](testing/frontend/public-account.md#organisationsetuppage) | 6 (OS-01–OS-06) | [OrganisationSetupPage.jsx](../frontend/src/pages/OrganisationSetupPage.jsx) | `/account/organisations/new` |
| 8 | [Account home / tabs](testing/frontend/public-account.md#accounthomepage) | 2 (AH-01–AH-02) | [AccountHomePage.jsx](../frontend/src/pages/AccountHomePage.jsx) | `/account/organisations`<br>`/account/memberships` |
| 9 | [Owned organisation management](testing/frontend/member-shared.md#organisationsmanagementpage) | 6 (ORG-01–ORG-06) | [OrganisationsManagementPage.jsx](../frontend/src/pages/OrganisationsManagementPage.jsx) | `Embedded in /account/organisations` |
| 10 | [Posts / communication](testing/frontend/member-shared.md#postspage) | 7 (POST-01–POST-07) | [PostsPage.jsx](../frontend/src/pages/PostsPage.jsx) | `/member/communication`<br>`/admin/posts` |

### Member pages

| No. | Module / test cases | Cases / IDs | Source file | Where to open it |
| --- | --- | --- | --- | --- |
| 11 | [Personal profile](testing/frontend/member-shared.md#profilepage) | 5 (PROF-01–PROF-05) | [member/ProfilePage.jsx](../frontend/src/pages/member/ProfilePage.jsx) | `/account/profile` |
| 12 | [Membership management and checkout](testing/frontend/member-shared.md#membershippage) | 8 (MEM-01–MEM-08) | [member/MembershipPage.jsx](../frontend/src/pages/member/MembershipPage.jsx) | `/member/membership`<br>`/member/checkout` |
| 13 | [My Memberships / organisation discovery](testing/frontend/member-shared.md#memberorganisationspage) | 4 (MORG-01–MORG-04) | [member/MemberOrganisationsPage.jsx](../frontend/src/pages/member/MemberOrganisationsPage.jsx) | `Embedded in /account/memberships` |
| 14 | [Member dashboard](testing/frontend/member-shared.md#memberdashboard) | 3 (MDASH-01–MDASH-03) | [member/MemberDashboard.jsx](../frontend/src/pages/member/MemberDashboard.jsx) | `/member/dashboard` |
| 15 | [Invoices and receipts](testing/frontend/member-shared.md#invoicespage) | 4 (INV-01–INV-04) | [member/InvoicesPage.jsx](../frontend/src/pages/member/InvoicesPage.jsx) | `/member/invoices` |
| 16 | [Events calendar and RSVP](testing/frontend/member-shared.md#eventscalendarpage) | 5 (EVT-01–EVT-05) | [member/EventsCalendarPage.jsx](../frontend/src/pages/member/EventsCalendarPage.jsx) | `/member/events` |

### Admin pages

| No. | Module / test cases | Cases / IDs | Source file | Where to open it |
| --- | --- | --- | --- | --- |
| 17 | [Admin dashboard](testing/frontend/admin.md#admindashboard) | 6 (AD-01–AD-06) | [admin/AdminDashboard.jsx](../frontend/src/pages/admin/AdminDashboard.jsx) | `/admin/dashboard` |
| 18 | [Member directory](testing/frontend/admin.md#memberslistpage) | 6 (ML-01–ML-06) | [admin/MembersListPage.jsx](../frontend/src/pages/admin/MembersListPage.jsx) | `/admin/members` |
| 19 | [Tiers and pricing](testing/frontend/admin.md#tiersmanagementpage) | 6 (TM-01–TM-06) | [admin/TiersManagementPage.jsx](../frontend/src/pages/admin/TiersManagementPage.jsx) | `/admin/tiers` |
| 20 | [Event management](testing/frontend/admin.md#eventmanagementpage) | 8 (EM-01–EM-08) | [admin/EventManagementPage.jsx](../frontend/src/pages/admin/EventManagementPage.jsx) | `/admin/events` |
| 21 | [Financial analytics](testing/frontend/admin.md#financialanalyticspage) | 4 (FA-01–FA-04) | [admin/FinancialAnalyticsPage.jsx](../frontend/src/pages/admin/FinancialAnalyticsPage.jsx) | `/admin/finances` |
| 22 | [Audit activity log](testing/frontend/admin.md#activitylogpage) | 3 (AL-01–AL-03) | [admin/ActivityLogPage.jsx](../frontend/src/pages/admin/ActivityLogPage.jsx) | `/admin/logs` |
| 23 | [Organisation email settings](testing/frontend/admin.md#emailsettingspage) | 6 (ES-01–ES-06) | [admin/EmailSettingsPage.jsx](../frontend/src/pages/admin/EmailSettingsPage.jsx) | `/admin/email-settings` |
| 24 | [Payment gateway overview](testing/frontend/admin.md#paymentgatewaypage) | 1 (PG-01) | [admin/PaymentGatewayPage.jsx](../frontend/src/pages/admin/PaymentGatewayPage.jsx) | `/admin/payments` |

## How to record each test

Run the shared checklist once for each relevant role/environment or distinct layout, reusing evidence from module runs. Then work through the module's own cases; do not repeat the shared checks for every module. Within a case, run the named input variants and label the evidence with the variant. Mark the case PASS only if all applicable variants pass; otherwise record the failing variant under its status.

1. Complete the steps using the stated account, data and page.
2. Capture the browser result, including the relevant form/error/modal and URL. For a successful save, also capture the value after reload when the case asks for persistence.
3. Open the linked source file in your editor. Press **Ctrl+G**, enter the stated starting line and screenshot the named handler/validation/rendering block with the filename and line numbers visible. If the logic spans a page and a component, capture both indicated blocks.
4. Place the UI screenshot and code screenshot side by side, or attach both below field 2. Suggested names: `<CASE-ID>-ui.png`, `<CASE-ID>-code.png`; add `-before`, `-after` or `-variant` as needed. Reuse one code screenshot for variants that share the same implementation, with clear case/variant labels.
5. Select PASS only when the observed result matches every applicable expected result. Select FAIL for a mismatch and add the actual result/defect reference under field 4. Leave both unselected until executed; if a prerequisite is missing, keep the case unrun and state why.

Use test values in screenshots. A screenshot of code explains the implementation; it does not demonstrate that the corresponding behavior passed. Network/download/inbox evidence is needed where the expected outcome extends beyond the visible page.

### Required case format

1) **Test Case Title (Test Scenario):** Case ID and title. Include preconditions, input values and the steps performed.

2) **Screenshot of test + screenshot of code:**
   - UI evidence: paste the observed screen or attach `<CASE-ID>-ui.png`.
   - Code evidence: paste the relevant source block or attach `<CASE-ID>-code.png`.
   - Code location: use the file, line range and function/component provided for that case.

3) **Expected outcome:** Use the specified result; compare it with the actual result.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.
   - Actual result / defect reference: fill in after execution.
   - Tester / date / browser / environment: fill in after execution.

## Test environment and fixtures

Use the existing running test environment, or start the local frontend and backend using the [project setup](../README.md) and [account-flow configuration](../backend/ACCOUNT_FLOW.md). The backend needs a reachable MongoDB database. Create disposable test records for changes and deletion cases.

| Fixture | What to prepare |
| --- | --- |
| Accounts | Signed-out visitor; unverified account; verified account awaiting onboarding; onboarded account with no organisation; owner; ordinary member. Use an account that owns A and is a member of B to verify role changes. |
| Membership states | Active with future expiry; active free/perpetual; pending paid; expired; suspended; revoked; paid cancellation scheduled; scheduled downgrade. Use controlled fixtures for precise expiry transitions. |
| Organisations | A and B with different names, branding and records; public and private organisations; no-match search results; owned and joined organisations. |
| Tiers | Free, paid monthly and paid yearly; cheaper and more expensive alternatives; equivalent annualised price; inactive/deleted/full alternatives; empty tier list. |
| Events | Upcoming, ongoing and ended; single-day and multi-day; capacity available/full; all-tier and restricted-tier; existing RSVP; venue with coordinates and manually entered location. |
| Financial records | Own and other-account/other-organisation invoices; paid/non-paid records; no invoices; transactions in several months; enough members/logs to exercise page limits. |
| Content / files | Short and boundary-length text; long accepted names; valid supported images just below/at/above the stated limit; unsupported and corrupt files; formatted post descriptions and images. |
| Integrations | Configured Google client and authorised test origin for OAuth cases. Configured mail delivery and a test inbox for verification/recovery/email cases. Treat provider acceptance and inbox arrival as separate observations. |
| Payment demo | Use the built-in Card, Online banking and E-wallet simulation, approved/declined scenarios and verification code `123456`. No real payment credentials are needed. |
| Error and timing fixtures | Targeted API failures, delayed responses, missing/deleted records and forbidden records. Browser request interception or a controlled fixture is needed for deterministic races and hard-to-reproduce server states. |

For a module-level API error test, load/sign in successfully **before** failing that module's target endpoint. Putting the entire browser offline before refresh can fail session validation and send you to login, which does not exercise the module's own error state. For a response fixture, keep its normal response shape and change only the property/status relevant to the case.

For time-based cases, record the actual test date/time and timezone; use future/past fixtures relative to execution. Event schedules may use their own stored timezone. Do not assume browser-local formatting is always the same as the event timezone.

## How the code references work

Each detailed case points to the source that handles the behavior, including nested modals, upload controls, validation helpers and shared routing when relevant. Links are relative to this repository; the visible line ranges and symbol names let you locate the code even if your editor does not jump to `#L...` anchors.

Line references describe the workspace at review time and may move after edits. Search for the named function/component if they shift. Some expectations require a backend response or external delivery; frontend code alone cannot prove persistence, authorisation, email arrival or payment state.

## Existing automated checks

Existing tests can provide supporting evidence, but their results do not fill in manual PASS/FAIL fields or replace screenshots:

- [Browser scenarios](../frontend/tests/navigation-browser.mjs) exercise navigation, context, dialogs, membership, checkout and several editor/reporting flows using API fixtures. The file header documents how to run it.
- [Frontend test scripts](../frontend/package.json) and [test files](../frontend/tests) cover routing, account validation, API handling, organisation filtering, event timing/analytics, email-delivery messages, post rendering and membership cards.
- [Backend tests](../backend/tests) cover server validation, access and membership/payment behavior using mocks where applicable.

No automated tests or live integration checks were executed as part of preparing this document.

