# Frontend manual test cases — admin modules

This concise plan covers all eight admin modules in **40 workflow cases**, based on source reviewed on 2 November 2026. Related input variants share one case; run every named variant and mark PASS only if all expected results match. No module exceeds eight cases.

Each case has the requested four fields. In field 2, attach a UI screenshot and a screenshot of the cited code, with filename/line numbers visible. Source locations explain implementation; they are not test evidence by themselves. Every status remains **Not run**; no screenshots or outcomes are claimed.

Use a verified, onboarded organisation **owner** and disposable records. Replace `<owned-id>` in routes. Run general access/role menus, protected/direct/legacy routes, history/dialogs/links, organisation changes/stale responses, sessions/logout, loading/toasts and keyboard/layout once through the main plan's shared checklist. Keep module-specific defect probes below.

Reusable DashboardAnalytics behavior is specified once in AD-02–AD-06; FA-04 checks its financial-page integration. Rejected responses, unusual stored records and delivery scenarios require controlled fixtures or stated integration prerequisites; absent setup leaves a case unrun.

| Module | Case IDs | Cases |
| --- | --- | ---: |
| [AdminDashboard](#admindashboard) | AD-01–AD-06 | 6 |
| [MembersListPage](#memberslistpage) | ML-01–ML-06 | 6 |
| [TiersManagementPage](#tiersmanagementpage) | TM-01–TM-06 | 6 |
| [EventManagementPage](#eventmanagementpage) | EM-01–EM-08 | 8 |
| [FinancialAnalyticsPage](#financialanalyticspage) | FA-01–FA-04 | 4 |
| [ActivityLogPage](#activitylogpage) | AL-01–AL-03 | 3 |
| [EmailSettingsPage](#emailsettingspage) | ES-01–ES-06 | 6 |
| [PaymentGatewayPage](#paymentgatewaypage) | PG-01 | 1 |
| **Total** | | **40** |

<a id="admindashboard"></a>

## AdminDashboard

**Source:** [frontend/src/pages/admin/AdminDashboard.jsx](../../../frontend/src/pages/admin/AdminDashboard.jsx)  
**Open:** `/admin/dashboard?organisation=<owned-id>`  
**Setup / scope:** Use known member/invoice data. KPI cards use the organisation financial summary; chart ranges do not filter those cards. Shared access/navigation/request-order checks apply. AD-06 retains the suspected silent-zero KPI defect. Reusable DashboardAnalytics cases AD-02–AD-06 run once here; FA-04 checks financial-page integration.

### AD-01 — Dashboard identity, KPI reconciliation and empty data

1) **Test Case Title (Test Scenario):** Dashboard identity, KPI reconciliation and empty data. **Variants / steps:** Populated variant: compare all four KPI cards against known subscription/event payments, member statuses, monthly/yearly memberships and paid/failed invoices. Open Manage Members and Tiers & Pricing. Empty variant: use an organisation with no activity.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture heading/cards and matching financial-summary response; capture shortcut destinations and zero-data state. **Code:** [frontend/src/pages/admin/AdminDashboard.jsx:40–70](../../../frontend/src/pages/admin/AdminDashboard.jsx#L40) (`header and shortcuts`); [frontend/src/pages/admin/AdminDashboard.jsx:77–136](../../../frontend/src/pages/admin/AdminDashboard.jsx#L77) (`KPI values`).

3) **Expected outcome:** The organisation/destinations are correct; revenue/subtotals, active/registered counts, MRR/annual equivalent and invoice outcomes match returned data. Pending/failed invoices are not collected revenue. Empty data shows readable zero KPIs; reporting remains demo/manual-renewal data.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AD-02 — Analytics period selection and refresh

1) **Test Case Title (Test Scenario):** Analytics period selection and refresh. **Variants / steps:** Open without a range; apply a historical single month, then reapply it. Boundary variants: blank months, start after end, future end, exactly 120 and 121 historical months.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture selected range, validation, period/chart values and refresh requests. **Code:** [frontend/src/components/DashboardAnalytics.jsx:40–85](../../../frontend/src/components/DashboardAnalytics.jsx#L40) (`range choice/apply/read`); [frontend/src/components/DashboardAnalytics.jsx:107–128](../../../frontend/src/components/DashboardAnalytics.jsx#L107) (`range controls`); [frontend/src/analyticsRange.js:16–35](../../../frontend/src/analyticsRange.js#L16) (`default and range validation`).

3) **Expected outcome:** Default is six months through current UTC month. Valid ranges update URL/data; reapply refreshes. Missing/reversed/future/&gt;120-month ranges are blocked; exactly 120 historical months is valid. Current-month-to-date/UTC labels are accurate.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AD-03 — Growth and current-member composition

1) **Test Case Title (Test Scenario):** Growth and current-member composition. **Variants / steps:** Using known join dates, switch New joins/Total joined; choose Country/Tier/Status composition and include missing country. Change period once.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture each selected measure/breakdown and its values/table. **Code:** [frontend/src/components/DashboardAnalytics.jsx:140–173](../../../frontend/src/components/DashboardAnalytics.jsx#L140) (`growth/composition controls and semantics`).

3) **Expected outcome:** Growth switches period joins/cumulative joins on the current roster, not historical active counts. Composition uses current members regardless of period and displays missing data as Not provided.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AD-04 — Revenue/payment accounting and Details

1) **Test Case Title (Test Scenario):** Revenue/payment accounting and Details. **Variants / steps:** Use paid MYR, failed/pending and available non-MYR invoice fixtures; compare revenue/payment series with returned data, then click revenue Details.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture chart totals/tables, currency note and financial-details destination. **Code:** [frontend/src/components/DashboardAnalytics.jsx:178–196](../../../frontend/src/components/DashboardAnalytics.jsx#L178) (`revenue, payment activity and Details`).

3) **Expected outcome:** Revenue counts paid MYR amounts; payment counts may include other currencies with the supplied exclusion note. Failed/pending amounts do not become revenue. Details opens this organisation's finances.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AD-05 — Chart values, tables and empty series

1) **Test Case Title (Test Scenario):** Chart values, tables and empty series. **Variants / steps:** Hover/focus trend months, use arrows and open View chart data for trends/composition. Repeat with no activity.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture tooltip/focus values, expanded table and empty explanation. **Code:** [frontend/src/components/AnalyticsCharts.jsx:66–87](../../../frontend/src/components/AnalyticsCharts.jsx#L66) (`ChartDataTable`); [frontend/src/components/AnalyticsCharts.jsx:143–221](../../../frontend/src/components/AnalyticsCharts.jsx#L143) (`interactive TrendChart`); [frontend/src/components/AnalyticsCharts.jsx:226–263](../../../frontend/src/components/AnalyticsCharts.jsx#L226) (`DonutChart values/table`).

3) **Expected outcome:** Pointer/keyboard and table values agree with charts. Zero activity produces an explanation without NaN, misleading lines or a crash.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AD-06 — Dashboard request failure and recovery — defect probe

1) **Test Case Title (Test Scenario):** Dashboard request failure and recovery — defect probe. **Variants / steps:** Throttle/fail chart requests, restore and use Try again. Separately block only financial-summary while charts succeed.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture skeleton/alert/recovery, failed summary request, zero KPI area and console. **Code:** [frontend/src/components/DashboardAnalytics.jsx:25–37](../../../frontend/src/components/DashboardAnalytics.jsx#L25) (`ChartLoading`); [frontend/src/components/DashboardAnalytics.jsx:132–138](../../../frontend/src/components/DashboardAnalytics.jsx#L132) (`chart error/retry`); [frontend/src/pages/admin/AdminDashboard.jsx:20–36](../../../frontend/src/pages/admin/AdminDashboard.jsx#L20) (`loadMetrics catch and fallback`).

3) **Expected outcome:** Charts show explicit loading/error and recover independently. Desired KPI behavior identifies unavailable data; current summary catch only logs and falls back to zero. Record FAIL if a failed summary is represented as verified zero revenue.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="memberslistpage"></a>

## MembersListPage

**Source:** [frontend/src/pages/admin/MembersListPage.jsx](../../../frontend/src/pages/admin/MembersListPage.jsx)  
**Open:** `/admin/members?organisation=<owned-id>`  
**Setup / scope:** Prepare more than 16 members across tiers/statuses, a scheduled cancellation and perpetual membership. Shared history/access/context/request-order checks apply. CSV currently sends status/tier but omits search.

### ML-01 — Directory identity, search and filters

1) **Test Case Title (Test Scenario):** Directory identity, search and filters. **Variants / steps:** Inspect known rows; search separately by name/email/member number, combine status and tier, test no match and reset. Repeat statuses active/pending/suspended/revoked/cancelled.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture relevant rows, controls, query and no-match state. **Code:** [frontend/src/pages/admin/MembersListPage.jsx:57–93](../../../frontend/src/pages/admin/MembersListPage.jsx#L57) (`loadMembers and query`); [frontend/src/pages/admin/MembersListPage.jsx:223–275](../../../frontend/src/pages/admin/MembersListPage.jsx#L223) (`filters and empty state`); [frontend/src/pages/admin/MembersListPage.jsx:291–327](../../../frontend/src/pages/admin/MembersListPage.jsx#L291) (`identity/tier/status rows`).

3) **Expected outcome:** Up to eight matching members display per page; all active criteria intersect. Filter changes reset page, no match is explicit and reset restores rows.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ML-02 — Pagination and directory refresh/recovery

1) **Test Case Title (Test Scenario):** Pagination and directory refresh/recovery. **Variants / steps:** Navigate first/middle/last pages; try page 0,-1, abc,1.5 and beyond final page. Change a member in another session and refresh manually, on focus and after 30 seconds visible; throttle/fail then retry loading.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture page/edge controls, refresh requests and spinner/error/recovered row. **Code:** [frontend/src/pages/admin/MembersListPage.jsx:28–29](../../../frontend/src/pages/admin/MembersListPage.jsx#L28) (`safe page parsing`); [frontend/src/pages/admin/MembersListPage.jsx:73–109](../../../frontend/src/pages/admin/MembersListPage.jsx#L73) (`clamp/error and background refresh`); [frontend/src/pages/admin/MembersListPage.jsx:206–209](../../../frontend/src/pages/admin/MembersListPage.jsx#L206) (`Refresh members`); [frontend/src/pages/admin/MembersListPage.jsx:380–405](../../../frontend/src/pages/admin/MembersListPage.jsx#L380) (`pagination`).

3) **Expected outcome:** Invalid pages use first; excessive positive page clamps last; edge controls disable. Refresh/focus/visible intervals retrieve updates. Loading/failure are distinct from empty results, error is shown and controls recover.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ML-03 — Administrative status actions and payment gate

1) **Test Case Title (Test Scenario):** Administrative status actions and payment gate. **Variants / steps:** Exercise Approve/Suspend/Revoke on disposable eligible rows. Try unpaid paid-tier approval and one forced request failure.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture resulting badge, available actions and success/rejection messages. **Code:** [frontend/src/pages/admin/MembersListPage.jsx:130–140](../../../frontend/src/pages/admin/MembersListPage.jsx#L130) (`handleStatusChange`); [frontend/src/pages/admin/MembersListPage.jsx:339–369](../../../frontend/src/pages/admin/MembersListPage.jsx#L339) (`status action availability`).

3) **Expected outcome:** Allowed changes persist/reload; already-applied actions hide as coded. Server-rejected payment-gated activation or failures show errors and preserve status.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ML-04 — Member tier adjustment lifecycle

1) **Test Case Title (Test Scenario):** Member tier adjustment lifecycle. **Variants / steps:** Open Change, inspect current tier, select another and Cancel/reopen. Save a permitted change and reload member card. Delay/reject a save; directly load valid off-page, missing and foreign memberTier IDs.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture editor target/selection, busy/error, updated directory/card and unavailable panel. **Code:** [frontend/src/pages/admin/MembersListPage.jsx:112–128](../../../frontend/src/pages/admin/MembersListPage.jsx#L112) (`detail read/selection`); [frontend/src/pages/admin/MembersListPage.jsx:143–167](../../../frontend/src/pages/admin/MembersListPage.jsx#L143) (`tier save lifecycle`); [frontend/src/pages/admin/MembersListPage.jsx:408–484](../../../frontend/src/pages/admin/MembersListPage.jsx#L408) (`editor and controls`).

3) **Expected outcome:** Correct member/current tier loads even off-page; Cancel saves nothing. Save disables while pending, success refreshes/closes and next-loaded card changes. Failure retains recoverable editor; missing/foreign details stay unavailable.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ML-05 — CSV export segmentation and failure

1) **Test Case Title (Test Scenario):** CSV export segmentation and failure. **Variants / steps:** Export with status/tier, repeat with active search, and open CSV. Separately reject export.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture filters, downloaded filename/content or failure toast. **Code:** [frontend/src/pages/admin/MembersListPage.jsx:170–189](../../../frontend/src/pages/admin/MembersListPage.jsx#L170) (`handleExportCsv`).

3) **Expected outcome:** remember_members_export_&lt;timestamp&gt;.csv contains status/tier segment. Search is not sent, so exported rows may exceed search results. Failure reports error without false success.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ML-06 — Cancelled access and expiry labels

1) **Test Case Title (Test Scenario):** Cancelled access and expiry labels. **Variants / steps:** Inspect cancelled-with-future-access, ended cancellation, recorded cancellation date and no-expiry membership.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture status notes and expiry cells. **Code:** [frontend/src/pages/admin/MembersListPage.jsx:325–337](../../../frontend/src/pages/admin/MembersListPage.jsx#L325) (`cancellation/expiry rendering`).

3) **Expected outcome:** Cancelled rows distinguish Access until date from access ended; recorded cancellation date appears. Missing expiration displays Perpetual rather than invalid date.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="tiersmanagementpage"></a>

## TiersManagementPage

**Source:** [frontend/src/pages/admin/TiersManagementPage.jsx](../../../frontend/src/pages/admin/TiersManagementPage.jsx)  
**Open:** `/admin/tiers?organisation=<owned-id>`  
**Setup / scope:** Prepare at least two active tiers, one unused and one with active/pending members. No deactivate toggle exists despite delete-error advice. Shared direct-link/dialog/context checks apply.

### TM-01 — Create/edit tier configurations and cancel drafts

1) **Test Case Title (Test Scenario):** Create/edit tier configurations and cancel drafts. **Variants / steps:** Inspect cards, open Add defaults, save monthly paid/yearly/free variants, then edit a saved tier. Change a draft, close and reopen.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture defaults/completed form and saved/reopened cards. **Code:** [frontend/src/pages/admin/TiersManagementPage.jsx:165–214](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L165) (`cards/edit`); [frontend/src/components/TierModal.jsx:16–32](../../../frontend/src/components/TierModal.jsx#L16) (`fresh/edit defaults`); [frontend/src/components/TierModal.jsx:36–58](../../../frontend/src/components/TierModal.jsx#L36) (`create/update payload`).

3) **Expected outcome:** Defaults are blank name/description, MYR 49, monthly, default perks/unlimited capacity. Valid configurations persist in the original/new record; closing saves nothing and reopening uses persisted/default data. Cards share the saved organisation accent.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### TM-02 — Tier identity and price validation

1) **Test Case Title (Test Scenario):** Tier identity and price validation. **Variants / steps:** Name variants: blank/spaces,80/81 characters, duplicate name. Price variants: blank,-0.01,0,0.01, three decimals,1000000/1000000.01.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture browser/server errors and valid boundaries. **Code:** [frontend/src/components/TierModal.jsx:94–115](../../../frontend/src/components/TierModal.jsx#L94) (`required name/price controls`); [backend/services/organisationAccess.js:103–112](../../../backend/services/organisationAccess.js#L103) (`name/price bounds`); [backend/routes/tiers.js:25–48](../../../backend/routes/tiers.js#L25) (`duplicate-name checks`).

3) **Expected outcome:** Unique nonblank names 1–80 characters and prices 0–MYR 1,000,000 with at most two decimals can save. Invalid/duplicate inputs are rejected without replacing another tier; server errors remain visible.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### TM-03 — Optional description, perks and capacity boundaries

1) **Test Case Title (Test Scenario):** Optional description, perks and capacity boundaries. **Variants / steps:** Save blanks; then description 1000/1001 characters,30/31 perks and 500/501 characters per perk; capacity blank, positive whole,0, negative, fractional.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture submitted fields and saved/error results. **Code:** [frontend/src/components/TierModal.jsx:40–46](../../../frontend/src/components/TierModal.jsx#L40) (`payload normalisation`); [frontend/src/components/TierModal.jsx:135–170](../../../frontend/src/components/TierModal.jsx#L135) (`optional field controls`); [backend/services/organisationAccess.js:116–120](../../../backend/services/organisationAccess.js#L116) (`optional field constraints`).

3) **Expected outcome:** Blank description uses fallback; blank perk lines disappear; blank capacity is unlimited. Server rejects excessive description/perks and nonpositive/fractional capacity; valid boundaries persist. Capacity field has no local min constraint.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### TM-04 — Tier loading/save errors and unavailable editor

1) **Test Case Title (Test Scenario):** Tier loading/save errors and unavailable editor. **Variants / steps:** Throttle/fail tier or organisation read and Retry; delay/reject create/edit and retry. Open a missing/foreign tier query.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture loader/error, Add/save availability, retained draft and not-found panel. **Code:** [frontend/src/pages/admin/TiersManagementPage.jsx:42–60](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L42) (`combined required reads`); [frontend/src/pages/admin/TiersManagementPage.jsx:155–163](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L155) (`load retry`); [frontend/src/pages/admin/TiersManagementPage.jsx:229–241](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L229) (`editor availability`); [frontend/src/components/TierModal.jsx:49–62](../../../frontend/src/components/TierModal.jsx#L49) (`save error`); [frontend/src/components/TierModal.jsx:175–191](../../../frontend/src/components/TierModal.jsx#L175) (`save busy state`).

3) **Expected outcome:** Required-read failure blocks editing and Retry recovers. Pending save disables submit; rejection preserves editor/draft. Missing/foreign tier cannot open an editor and offers Return to tiers.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### TM-05 — Tier deletion: cancel, valid and protected

1) **Test Case Title (Test Scenario):** Tier deletion: cancel, valid and protected. **Variants / steps:** Cancel confirmation, then delete unused disposable tier while another active tier remains. Try last active tier, occupied active/pending tier and forced delete failure.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture confirmation, success/removal or rejection/preserved card. **Code:** [frontend/src/pages/admin/TiersManagementPage.jsx:91–103](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L91) (`delete workflow`); [backend/routes/tiers.js:57–65](../../../backend/routes/tiers.js#L57) (`deletion safeguards`).

3) **Expected outcome:** Cancel makes no request; valid deletion persists. Last active/occupied tiers and failed requests preserve records with an error. The UI does not provide the deactivation suggested by the occupied-tier message.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### TM-06 — Organisation badge accent lifecycle

1) **Test Case Title (Test Scenario):** Organisation badge accent lifecycle. **Variants / steps:** Save via picker and lowercase six-digit hex; reload member card. Try empty/missing#/three-digit/nonhex input and unchanged value; delay/fail valid save.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture saved/invalid hex, tier dots, busy/error and member card. **Code:** [frontend/src/pages/admin/TiersManagementPage.jsx:62–87](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L62) (`accent validation/save`); [frontend/src/pages/admin/TiersManagementPage.jsx:130–152](../../../frontend/src/pages/admin/TiersManagementPage.jsx#L130) (`accent controls/status`).

3) **Expected outcome:** Valid hex normalises/persists for all tiers/next-loaded cards. Invalid hex shows six-digit guidance; unchanged Save disables. Busy controls disable and failure does not substitute unconfirmed colour for saved dots.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="eventmanagementpage"></a>

## EventManagementPage

**Source:** [frontend/src/pages/admin/EventManagementPage.jsx](../../../frontend/src/pages/admin/EventManagementPage.jsx)  
**Open:** `/admin/events?organisation=<owned-id>`  
**Setup / scope:** Prepare events spanning timing/access/RSVP variants. New events start tomorrow in selected zone or later, span≤31 calendar days, capacity 1–100,000. Page has create/delete/roster, no edit form. Shared dialog/URL/context/access behavior is tested once; event-specific rules remain below.

### EM-01 — Event table, roster and required-read states

1) **Test Case Title (Test Scenario):** Event table, roster and required-read states. **Variants / steps:** Load populated/empty events; open populated/empty/missing roster IDs. Throttle/fail events and tiers separately, then Retry/Refresh.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture table schedule/location/access/RSVPs, roster guests/count/dates, loaders/errors and Create availability. **Code:** [frontend/src/pages/admin/EventManagementPage.jsx:34–51](../../../frontend/src/pages/admin/EventManagementPage.jsx#L34) (`independent event/tier reads`); [frontend/src/pages/admin/EventManagementPage.jsx:86–120](../../../frontend/src/pages/admin/EventManagementPage.jsx#L86) (`states/create gate`); [frontend/src/pages/admin/EventManagementPage.jsx:135–184](../../../frontend/src/pages/admin/EventManagementPage.jsx#L135) (`event data`); [frontend/src/pages/admin/EventManagementPage.jsx:230–276](../../../frontend/src/pages/admin/EventManagementPage.jsx#L230) (`roster states/controls`).

3) **Expected outcome:** Correct organisation data/roster appears; no events/no RSVPs/missing event are explicit. Event read error is not empty success. Tier failure may leave events readable but blocks creation. Roster closes normally; event=&lt;id&gt; is unsupported edit and shows not-found.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-02 — Event analytics and live timing

1) **Test Case Title (Test Scenario):** Event analytics and live timing. **Variants / steps:** Choose All/Upcoming/Past and 3/6/12 months using dated/undated RSVPs and repeat attendees. Open an event's RSVP list; leave near-start/final-end events across boundaries.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture scope/period totals/tables, undated warning, roster link and before/after badges. **Code:** [frontend/src/components/EventAnalytics.jsx:13–60](../../../frontend/src/components/EventAnalytics.jsx#L13) (`scope, counts, trend and roster links`); [frontend/src/pages/admin/EventManagementPage.jsx:18](../../../frontend/src/pages/admin/EventManagementPage.jsx#L18) (`live event clock`); [frontend/src/pages/admin/EventManagementPage.jsx:104](../../../frontend/src/pages/admin/EventManagementPage.jsx#L104) (`analytics mount`); [frontend/src/pages/admin/EventManagementPage.jsx:146–150](../../../frontend/src/pages/admin/EventManagementPage.jsx#L146) (`status/schedule`).

3) **Expected outcome:** Totals count registrations, not distinct people; UTC trend excludes undated RSVPs with a note. Scope/period changes analyse correct records; roster link targets correct event. Timing badges/upcoming counts advance without full reload.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-03 — Event content, creation and publish recovery

1) **Test Case Title (Test Scenario):** Event content, creation and publish recovery. **Variants / steps:** Open draft, Cancel/reopen; publish valid single-day event. Text variants: blank/whitespace required fields, title 160/161 and description 5000/5001. Delay/reject publish, try repeat/close and retry.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture fresh/completed form, validation, disabled publish/close, error and new row. **Code:** [frontend/src/components/EventModal.jsx:29–31](../../../frontend/src/components/EventModal.jsx#L29) (`fresh form mount`); [frontend/src/components/EventModal.jsx:100–130](../../../frontend/src/components/EventModal.jsx#L100) (`publish validation/lifecycle`); [frontend/src/components/EventModal.jsx:144–158](../../../frontend/src/components/EventModal.jsx#L144) (`required text and busy form`); [frontend/src/components/EventModal.jsx:252–257](../../../frontend/src/components/EventModal.jsx#L252) (`error/cancel/publish`).

3) **Expected outcome:** Cancel creates nothing; valid publish saves once and refreshes/closes. Required text must be nonblank; title/description caps 160/5000 apply. Busy blocks submit/close; failure retains draft with error and retry can succeed.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-04 — Dates, zones and daily schedule boundaries

1) **Test Case Title (Test Scenario):** Dates, zones and daily schedule boundaries. **Variants / steps:** Try yesterday/today/tomorrow, same-day and multi-day ranges,31/32 days and reversed dates; switch zone across calendar dates. Set different daily times, move start beyond old end and try empty/equal/earlier end times.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture zone/date minimum, daily rows and validation. **Code:** [frontend/src/components/EventModal.jsx:40–68](../../../frontend/src/components/EventModal.jsx#L40) (`minimum/date/schedule computation`); [frontend/src/components/EventModal.jsx:108–111](../../../frontend/src/components/EventModal.jsx#L108) (`submission date/time validation`); [frontend/src/components/EventModal.jsx:166–208](../../../frontend/src/components/EventModal.jsx#L166) (`dates/zone/daily controls`); [shared/events.js:1–19](../../../shared/events.js#L1) (`31-day/date range rule`).

3) **Expected outcome:** Start is tomorrow or later in event zone;≤31 days accepted, longer/reversed blocked. One row per day, end moves with later start, each end must follow start. Overnight activity is split across calendar dates.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-05 — Attendance capacity and tier eligibility

1) **Test Case Title (Test Scenario):** Attendance capacity and tier eligibility. **Variants / steps:** Capacity variants: 1,100000, blank,0,-1,100001,1.5. Choose All or minimum tier with monthly/yearly/equal-monthly-price tiers; repeat with no tiers.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture capacity feedback, eligible chips/selector and published rule. **Code:** [frontend/src/components/EventModal.jsx:112–114](../../../frontend/src/components/EventModal.jsx#L112) (`capacity/access validation`); [frontend/src/components/EventModal.jsx:217–246](../../../frontend/src/components/EventModal.jsx#L217) (`capacity and tier controls`).

3) **Expected outcome:** Only required whole capacity 1–100,000 saves. All allows active members; minimum includes selected/higher equivalent-monthly tiers including ties. No tiers disables minimum and retains all-active-member guidance.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-06 — Venue search and manual-address workflow

1) **Test Case Title (Test Scenario):** Venue search and manual-address workflow. **Variants / steps:** Try queries 1–2,3 and 201 characters, known/no-match/failed searches. Select a result and map preview, then edit address or use direct full address.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture length help, results/error, selected indicator, cleared selection and map destination. **Code:** [frontend/src/components/EventLocationField.jsx:21–23](../../../frontend/src/components/EventLocationField.jsx#L21) (`search eligibility`); [frontend/src/components/EventLocationField.jsx:43–90](../../../frontend/src/components/EventLocationField.jsx#L43) (`manual edit/search/select`); [frontend/src/components/EventLocationField.jsx:95–124](../../../frontend/src/components/EventLocationField.jsx#L95) (`messages/maps`).

3) **Expected outcome:** Search accepts trimmed 3–200 characters; no-match/failure is explicit. Selection stores coordinates and map links open new tabs; manual edit clears coordinates. Full venue entry works without search; stale-response behavior uses shared checks.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-07 — Event image acceptance and removal

1) **Test Case Title (Test Scenario):** Event image acceptance and removal. **Variants / steps:** Upload/replace/remove readable JPEG/PNG/WebP at≤2 MiB; try empty, unsupported, corrupt and one-byte-over-limit files.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture preview, reading state, errors and preserved prior image. **Code:** [frontend/src/components/EventModal.jsx:53–57](../../../frontend/src/components/EventModal.jsx#L53) (`upload busy`); [frontend/src/components/EventModal.jsx:158](../../../frontend/src/components/EventModal.jsx#L158) (`header upload`); [frontend/src/components/ImageUploadField.jsx:17–68](../../../frontend/src/components/ImageUploadField.jsx#L17) (`type/size/decode/read/removal`); [shared/imageUploads.js:1–2](../../../shared/imageUploads.js#L1) (`image limits`).

3) **Expected outcome:** Only supported nonempty decodable images≤2 MiBreplace prior image; invalid files preserve it. Removal clears image; publishing waits for read completion.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EM-08 — Event deletion outcomes

1) **Test Case Title (Test Scenario):** Event deletion outcomes. **Variants / steps:** Cancel confirmation, confirm disposable deletion while delayed, then reject another delete.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture confirmation, disabled delete controls/spinner and removed or retained event. **Code:** [frontend/src/pages/admin/EventManagementPage.jsx:55–69](../../../frontend/src/pages/admin/EventManagementPage.jsx#L55) (`delete lifecycle`); [frontend/src/pages/admin/EventManagementPage.jsx:187–195](../../../frontend/src/pages/admin/EventManagementPage.jsx#L187) (`disabled/spinner controls`).

3) **Expected outcome:** Cancel sends no request; successful delete persists and refreshes list/analytics. Pending disables all deletes; failure shows error, preserves event and restores controls.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="financialanalyticspage"></a>

## FinancialAnalyticsPage

**Source:** [frontend/src/pages/admin/FinancialAnalyticsPage.jsx](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx)  
**Open:** `/admin/finances?organisation=<owned-id>`  
**Setup / scope:** Prepare known invoice outcomes, source/tier amounts and more than ten transactions. Values are demo/manual-renewal reports. DashboardAnalytics behaviors AD-02–AD-06 are specified once; FA-04 checks this embedding. Shared access/context/session checks apply.

### FA-01 — Reconcile summary and revenue breakdowns

1) **Test Case Title (Test Scenario):** Reconcile summary and revenue breakdowns. **Variants / steps:** Use known subscription/event amounts such as MYR 75/MYR 25, several tiers, paid/failed/pending attempts and monthly/yearly memberships; compare response with cards, source/tier bars and payment counts.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture KPI cards, distribution/tier amounts/shares and matching response. **Code:** [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:51–59](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L51) (`summary defaults/share arithmetic`); [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:74–132](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L74) (`summary cards`); [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:139–221](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L139) (`source/tier breakdown and invoice counts`).

3) **Expected outcome:** Amounts, attempts, paid/failed counts and monthly/annual equivalents agree with data. Shares use total revenue and rounded percentages; tier shares need not total 100% with other revenue. Failed/pending attempts are not collected revenue.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### FA-02 — Recent transaction ledger selection and formatting

1) **Test Case Title (Test Scenario):** Recent transaction ledger selection and formatting. **Variants / steps:** Use more than ten known paid/nonpaid invoices; compare returned latest-ten order, identity, tier, method, amount and date fields.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture ledger and response, including varied statuses/dates. **Code:** [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:226–269](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L226) (`latest-ten ledger rows/status/date`).

3) **Expected outcome:** Displays server-selected latest ten in response order; frontend does not itself slice an oversized response. Fields/statuses match, MYR has two decimals, date uses createdAt then paidAt. Paid/nonpaid badge styles differ.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### FA-03 — Empty report and failed-load recovery

1) **Test Case Title (Test Scenario):** Empty report and failed-load recovery. **Variants / steps:** Open no-invoice organisation; then throttle/fail financial summary, restore and Try again.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture zero/empty report, spinner, explicit error and recovered data. **Code:** [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:24–59](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L24) (`load/error/retry and zero denominator`); [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:199–221](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L199) (`empty tier iteration`); [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:246–275](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L246) (`empty ledger body`).

3) **Expected outcome:** No-data shows zeros and 0% shares without NaN/crash; tier/ledger areas have no rows, no dedicated empty message. Failure is explicit rather than false zero success; Retry recovers.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### FA-04 — Financial-only analytics integration

1) **Test Case Title (Test Scenario):** Financial-only analytics integration. **Variants / steps:** Inspect embedded charts; choose historical range with revenue different from summary totals; fail/retry only chart request while summary succeeds.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture two financial charts, range/chart error and retained summary/breakdowns. **Code:** [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:24–34](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L24) (`summary dependencies`); [frontend/src/pages/admin/FinancialAnalyticsPage.jsx:137](../../../frontend/src/pages/admin/FinancialAnalyticsPage.jsx#L137) (`financialOnly integration`); [frontend/src/components/DashboardAnalytics.jsx:132–196](../../../frontend/src/components/DashboardAnalytics.jsx#L132) (`error and conditional chart sections`).

3) **Expected outcome:** Only revenue/payment charts render here. Period changes affect charts, not top summary/source/tier/ledger. Chart failure/retry leaves summary intact. Run common range boundaries, chart values/tables and accounting once through AD-02–AD-06.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="activitylogpage"></a>

## ActivityLogPage

**Source:** [frontend/src/pages/admin/ActivityLogPage.jsx](../../../frontend/src/pages/admin/ActivityLogPage.jsx)  
**Open:** `/admin/logs?organisation=<owned-id>`  
**Setup / scope:** Use recent records plus unknown tier-created/modified/deleted actions and&gt;20 matches. Viewer is first-page/read-only. AL-02 preserves the source-specific unguarded filter-response defect; other general access/context behavior follows shared checks.

### AL-01 — Audit row identity, dates and metadata

1) **Test Case Title (Test Scenario):** Audit row identity, dates and metadata. **Variants / steps:** Compare known records/timestamps in browser locale; include missing name/email/actor/details/IP and long metadata. Compare standard actions with TIER_CREATED/TIER_MODIFIED/TIER_DELETED or another fixture's unlisted action; inspect their badges and filter options.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture six columns, fallbacks, friendly/generic action badges and source records. **Code:** [frontend/src/pages/admin/ActivityLogPage.jsx:21–32](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L21) (`action labels and getActionBadge fallback`); [frontend/src/pages/admin/ActivityLogPage.jsx:105–160](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L105) (`timestamp, badges, target, actor, details and IP`); [backend/routes/tiers.js:9–10](../../../backend/routes/tiers.js#L9) (`tier audit action data`).

3) **Expected outcome:** Rows match current organisation; timestamp represents the same instant in browser locale. Target falls back name→email→System, actor→system, metadata→JSON/N/A (long text truncates), missing IP→127.0.0.1 as a UI placeholder. Known actions use mapped labels/icons; unlisted actions use a generic badge without crashing, are visible under All Activities and do not automatically gain a dedicated filter option.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AL-02 — Action filtering, failure and response ordering

1) **Test Case Title (Test Scenario):** Action filtering, failure and response ordering. **Variants / steps:** Select every offered action then All; reload a filter URL, test zero matches and failed read. For request-order variant, delay A, select B, let B finish first then A.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture selection/query, matching/empty/error states and final rows with request timing. **Code:** [frontend/src/pages/admin/ActivityLogPage.jsx:21–28](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L21) (`filter action map`); [frontend/src/pages/admin/ActivityLogPage.jsx:38–62](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L38) (`filter/load effect without cancellation`); [frontend/src/pages/admin/ActivityLogPage.jsx:78–101](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L78) (`filter and loading/empty UI`).

3) **Expected outcome:** Supported filters request/display matching actions; loading/empty/failure are explicit and reload/filter change can retry. Desired order: final rows match selected B. Current effect has no cancellation/revision guard; record FAIL if late A replaces B.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AL-03 — Recent-feed boundary and read-only controls

1) **Test Case Title (Test Scenario):** Recent-feed boundary and read-only controls. **Variants / steps:** Prepare&gt;20 matching records; inspect requested page/limit, bottom of table and all row actions.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture up-to 20 rows, page=1/limit=20 and available controls. **Code:** [frontend/src/pages/admin/ActivityLogPage.jsx:40–46](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L40) (`fixed page/limit`); [frontend/src/pages/admin/ActivityLogPage.jsx:105–169](../../../frontend/src/pages/admin/ActivityLogPage.jsx#L105) (`read-only table`).

3) **Expected outcome:** Current feed displays only first page with no Older/Next or edit/delete actions. Full-history browsing is a gap if required; UI absence of editing alone does not prove server immutability.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="emailsettingspage"></a>

## EmailSettingsPage

**Source:** [frontend/src/pages/admin/EmailSettingsPage.jsx](../../../frontend/src/pages/admin/EmailSettingsPage.jsx)  
**Open:** `/admin/email-settings?organisation=<owned-id>`  
**Setup / scope:** Preview uses sample plain text, not Send test email. Integration variants require configured test transport and authorised reminder execution; leave unchecked if unavailable. Shared context/history/loading behavior applies; section below retains settings-specific feedback/validation.

### ES-01 — Load, enable and save organisation templates

1) **Test Case Title (Test Scenario):** Load, enable and save organisation templates. **Variants / steps:** Open saved/default settings; change/revert text to inspect dirty Save, independently toggle welcome/renewal and save/reload. Throttle/fail read and Retry; delay/reject save then retry.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture loaded defaults, saved/unsaved status, flags, disabled controls, alerts and persisted values. **Code:** [frontend/src/pages/admin/EmailSettingsPage.jsx:34–77](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L34) (`load/update/save lifecycle`); [frontend/src/pages/admin/EmailSettingsPage.jsx:97–129](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L97) (`load retry and enabled flags`); [frontend/src/pages/admin/EmailSettingsPage.jsx:160–164](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L160) (`dirty/save/error feedback`); [shared/organisationEmails.js:3–23](../../../shared/organisationEmails.js#L3) (`defaults/merge`).

3) **Expected outcome:** Missing defaults are welcome enabled/renewal disabled/30 days. Changes enable Save, full reversion disables it. Flags/text persist after success; pending disables edits/repeat save. Read/save failure is visible, recoverable and does not discard the save draft or claim success.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ES-02 — Template text and placeholder validation

1) **Test Case Title (Test Scenario):** Template text and placeholder validation. **Variants / steps:** For both enabled/disabled templates try blank/spaces, subjects 160/161 characters and messages 5000/5001; save outside spaces/paragraphs and unsupported {nickname}.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture counters/validation and persisted/preview text. **Code:** [frontend/src/components/EmailTemplateField.jsx:49–61](../../../frontend/src/components/EmailTemplateField.jsx#L49) (`required/maxLength/counters`); [shared/organisationEmails.js:26–43](../../../shared/organisationEmails.js#L26) (`normalisation/token validation`); [frontend/src/pages/admin/EmailSettingsPage.jsx:133–136](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L133) (`field limits`).

3) **Expected outcome:** Nonblank subject/body required even disabled. Limits 160/5000 apply; outside whitespace trims and message paragraphs remain; subjects are single-line. Unsupported token is named/rejected and no invalid template saves.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ES-03 — Tag insertion, selection and overflow

1) **Test Case Title (Test Scenario):** Tag insertion, selection and overflow. **Variants / steps:** Insert each offered tag at caret and over selected text; type after insertion. Near max length attempt overflow, then select enough text and retry.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture placeholders/caret, unchanged overflow attempt and successful replacement. **Code:** [frontend/src/components/EmailTemplateField.jsx:20–46](../../../frontend/src/components/EmailTemplateField.jsx#L20) (`selection/caret/overflow`); [frontend/src/components/EmailTemplateField.jsx:62–73](../../../frontend/src/components/EmailTemplateField.jsx#L62) (`tag buttons/status`).

3) **Expected outcome:** Tag replaces only selection/inserts at caret and restores typing after it. Overflow leaves content intact with feedback; fitting replacement succeeds. Supported tags are member/organisation name, tier, expiry and reminder days.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ES-04 — Live preview and selected email type

1) **Test Case Title (Test Scenario):** Live preview and selected email type. **Variants / steps:** Edit text/tags, switch section Preview and tabs, reload renewal preview and try preview=unknown; include harmless HTML-like text.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture live text, sample values, disabled-email warning and selected query. **Code:** [frontend/src/pages/admin/EmailSettingsPage.jsx:30–31](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L30) (`preview fallback`); [frontend/src/pages/admin/EmailSettingsPage.jsx:80–88](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L80) (`sample context`); [frontend/src/pages/admin/EmailSettingsPage.jsx:138–155](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L138) (`preview type/text rendering`).

3) **Expected outcome:** Preview updates before save; valid type restores and unknown falls back welcome. Uses Alex Member, active organisation, Community, fixed sample 2026-11-30 and chosen reminder days. Disabled email warns; HTML-like content is literal plain text, not inbox delivery evidence.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ES-05 — Reminder timing and recipient eligibility

1) **Test Case Title (Test Scenario):** Reminder timing and recipient eligibility. **Variants / steps:** Save 1 and 365 days; reject blank/0/-1/366/1.5 even disabled. Integration variant: prepare due/outside-window/no-expiry/opted-out memberships and run authorised reminders or await schedule.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture validation/saved timing and recipient sent/skipped evidence when integration is available. **Code:** [frontend/src/pages/admin/EmailSettingsPage.jsx:15–17](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L15) (`email trigger descriptions`); [frontend/src/pages/admin/EmailSettingsPage.jsx:124–129](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L124) (`lead time control`); [frontend/src/pages/admin/EmailSettingsPage.jsx:160](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L160) (`preference/no-expiry note`); [shared/organisationEmails.js:43](../../../shared/organisationEmails.js#L43) (`normaliseOrganisationEmailSettings daysBefore`).

3) **Expected outcome:** Only whole 1–365 days saves. Configured backend sends eligible opted-in expiry reminders and skips no-expiry/opted-out cases; form alone proves no delivery. Keep integration evidence unrun without transport/scheduler prerequisites.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ES-06 — Welcome delivery after activation — integration

1) **Test Case Title (Test Scenario):** Welcome delivery after activation — integration. **Variants / steps:** With configured test transport, save enabled welcome containing a unique marker; activate a new opted-in membership and inspect delivered/in-app record. Repeat disabled/opted-out variant.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture saved template/flags, activation and recipient record or skip evidence. **Code:** [frontend/src/pages/admin/EmailSettingsPage.jsx:15–17](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L15) (`welcome trigger`); [frontend/src/pages/admin/EmailSettingsPage.jsx:68–72](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L68) (`persisted email settings`); [frontend/src/pages/admin/EmailSettingsPage.jsx:160](../../../frontend/src/pages/admin/EmailSettingsPage.jsx#L160) (`notification preferences`).

3) **Expected outcome:** Backend activation welcome uses saved text and actual member values when enabled/allowed; disabled/opted-out variant does not send. Preview/save toast alone is not proof; leave unchecked without configured integration.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="paymentgatewaypage"></a>

## PaymentGatewayPage

**Source:** [frontend/src/pages/admin/PaymentGatewayPage.jsx](../../../frontend/src/pages/admin/PaymentGatewayPage.jsx)  
**Open:** `/admin/payments?organisation=<owned-id>`  
**Setup / scope:** Read-only demo explanation. Payment execution belongs to MembershipPage/CheckoutPage/PaymentModal; no live Stripe/API-key form here. Shared owner/context/layout checks apply.

### PG-01 — Review the demo gateway information

1) **Test Case Title (Test Scenario):** Review the demo gateway information. **Steps:** Inspect the organisation, readiness, three method cards, no-money/revenue disclosures, activation/receipt information and manual-renewal statements. Reference existing membership/checkout evidence for the information's accuracy rather than repeating payment tests here.

2) **Screenshot of test + screenshot of code:** _Attach UI and code screenshots._ Capture the full page with its method cards, notices and membership information readable. **Code:** [frontend/src/pages/admin/PaymentGatewayPage.jsx:5–15](../../../frontend/src/pages/admin/PaymentGatewayPage.jsx#L5) (`identity, methods, disclosures and membership explanations`).

3) **Expected outcome:** The correct organisation and ready status appear; Demo card/Online banking/eWallet are informational simulations. No money is charged and revenue is explicitly simulated. Information matches server-confirmed paid activation, immediate free activation, receipt/period outcomes, no new access for declines/cancellations and manual renewals without automatic deductions. This page performs no payment or settings mutation.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.


