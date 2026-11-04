# Frontend manual tests — member and shared modules

**42 workflow cases across eight modules; maximum eight in any module.** Repeat the related input variants within a case and mark PASS only when all succeed. Use test accounts/disposable records; replace URL IDs with real test IDs. Request failures and invalid stored data require browser request blocking or isolated fixtures.

For field 2, take the described application screenshot and screenshot the linked source fragment with editor line numbers visible. These are capture instructions, not existing evidence. Every status is **Not run**. A **defect probe** identifies a source limitation to investigate, not a confirmed runtime failure. General permissions, sessions, history, context switching and layout are checked once in the main plan's shared checklist.

<a id="organisationsmanagementpage"></a>

## OrganisationsManagementPage.jsx — My Organisations

**Entry:** `/account/organisations`, inside `AccountHomePage`. Prepare two owned public/private organisations and membership in somebody else's organisation.

### ORG-01 — Browse, search and load owned organisations

1) **Test Case Title (Test Scenario):** Compare owned rows/summary totals with records. Search name/description/category/location using mixed case/spaces and Public/Private/All; test no matches/no owned organisations. Delay/fail loading, then Retry. Include missing/broken logo and absent/present website.
2) **Screenshot of test + screenshot of code:** Capture filtered list/counts, empty/error and recovered state. Code: [owned fetch, lines 60–73](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L60), [filters/counts, lines 204–211](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L204), [Retry, line 259](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L259), [list/links, lines 314–380](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L314).
3) **Expected outcome:** Only owned organisations appear. Trimmed case-insensitive search intersects visibility; summary totals stay unfiltered. Empty/error/loading are distinguishable and Retry recovers. Logo fallback remains readable; website opens another tab only when present.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ORG-02 — Create an organisation or open its portal

1) **Test Case Title (Test Scenario):** Use Create from populated/empty lists; return and open the second organisation's portal. Repeat with rejected selection or ownership removed since loading.
2) **Screenshot of test + screenshot of code:** Capture setup destination, chosen portal and rejection. Code: [openPortal/create, lines 80–96](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L80), [portal action, lines 388–389](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L388).
3) **Expected outcome:** Create opens `/account/organisations/new`. Correct organisation is selected before its admin dashboard opens; ownership rejection shows an error and releases pending controls without exposing its admin screen.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ORG-03 — Change organisation visibility

1) **Test Case Title (Test Scenario):** Toggle public→private→public; compare counts/filters and public discovery after reload. Delay/fail one request and try clicking the same pending toggle again.
2) **Screenshot of test + screenshot of code:** Capture updated visibility/counts or retained visibility with error. Code: [handleToggleVisibility, lines 119–144](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L119), [toggle, lines 391–424](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L391).
3) **Expected outcome:** Success persists and affects discoverability. Failure preserves prior visibility and reports an error; pending toggle prevents ordinary repeats and recovers afterwards.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ORG-04 — Edit, validate and save organisation details

1) **Test Case Title (Test Scenario):** Open Edit/direct `?orgEdit=<id>`; compare prefills and test unknown/unowned ID. Try empty/space-only name/description and malformed URL. Save valid profile fields with tags ` AI, , Members , `; test Cancel, delayed/failed Save and retry.
2) **Screenshot of test + screenshot of code:** Capture populated/invalid editor, retained draft on failure and reopened saved values. Code: [prefills, lines 98–116](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L98), [validation/save, lines 147–184](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L147), [unavailable ID, lines 453–459](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L453), [URL/buttons, lines 613–621 and 661–680](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L613).
3) **Expected outcome:** Only owned records populate. Required text/malformed nonempty URL are rejected; blank optional URL is allowed. Valid text/tags are trimmed, empty tags removed and changes persist. Cancel saves nothing; failed Save retains draft; busy prevents repeats and retry recovers.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ORG-05 — Change and validate logo/banner images

1) **Test Case Title (Test Scenario):** Upload/replace/remove JPEG/PNG/WebP logo and banner, save/reopen. Test GIF/SVG, empty/corrupt files and valid images exactly 2,097,152 bytes/one byte over; delay reading once.
2) **Screenshot of test + screenshot of code:** Capture saved previews, validation and disabled Save while reading. Code: [image fields, lines 654–657](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L654), [image handler, lines 17–68](../../../frontend/src/components/ImageUploadField.jsx#L17), [save guard, lines 147–149](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L147).
3) **Expected outcome:** Supported nonempty decodable images up to 2 MB persist independently; bad files preserve prior preview. Removal restores fallback; Save waits for image processing.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### ORG-06 — Delete an owned organisation

1) **Test Case Title (Test Scenario):** On a disposable organisation, cancel deletion confirmation, fail one confirmed deletion, then retry successfully.
2) **Screenshot of test + screenshot of code:** Capture confirmation, error with retained row, then removal/counts. Code: [handleDeleteOrganisation, lines 187–201](../../../frontend/src/pages/OrganisationsManagementPage.jsx#L187).
3) **Expected outcome:** Cancel/failure preserve the organisation; failure reports an error. Success removes it, updates totals and refreshes account context.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="memberorganisationspage"></a>

## MemberOrganisationsPage.jsx — My Memberships and discovery

**Entry:** `/account/memberships`, inside `AccountHomePage`. Prepare memberships across statuses, owned/nonowned organisations and public organisations with free/paid/no tiers.

### MORG-01 — View and open existing membership cards

1) **Test Case Title (Test Scenario):** Inspect active/pending/expired/cancelled/suspended/revoked and owned records, missing/invalid expiry, and no memberships. Open eligible cards, including Complete Payment; fail portal selection once.
2) **Screenshot of test + screenshot of code:** Capture included cards/count, pending label, empty state and destination/error. Code: [membership filter, lines 28–33](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L28), [portal selection, lines 83–94](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L83), [cards, lines 103–120](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L103).
3) **Expected outcome:** Nonowned active/pending/expired/cancelled records appear; others are excluded. Identity/status/count match; invalid expiry is omitted. Pending says Awaiting payment and opens checkout; other included cards select their organisation's portal. Failure releases controls with feedback.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MORG-02 — Discover and filter public communities

1) **Test Case Title (Test Scenario):** Search name/description/location/tag with mixed case/spaces, combine category, test no matches and delayed/failed discovery. Follow Create Organisation.
2) **Screenshot of test + screenshot of code:** Capture public/empty results, load error and setup destination. Code: [public fetch/filter, lines 34–45](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L34), [discovery/create, lines 125–139](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L125).
3) **Expected outcome:** Only public communities appear; search/category intersect. Empty/loading/error are clear; failure retains membership cards. Reopen/reload after recovery (no list Retry button). Create opens organisation setup.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MORG-03 — Review tiers and join an organisation

1) **Test Case Title (Test Scenario):** Open View & Join/direct details URL; inspect default tier/prices. Test unknown organisation/no tiers. Join free and paid tiers separately; delay/fail a join, then retry with retained selection.
2) **Screenshot of test + screenshot of code:** Capture details/tier choice, unavailable/error and resulting dashboard/checkout. Code: [details/default tier/join, lines 46–72](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L46), [modal choices/actions, lines 142–151](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L142), [parent completion, lines 102–105](../../../frontend/src/App.jsx#L102).
3) **Expected outcome:** Correct details load; existing/first tier is selected. No tiers disables joining; unknown ID shows a returnable error. Free join activates without checkout; paid join stays pending until payment. Busy prevents repeats; failure preserves selection; account refresh makes membership visible.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MORG-04 — Continue an existing membership from details

1) **Test Case Title (Test Scenario):** Open details for owner, active/expired, pending and cancelled memberships; follow the displayed action.
2) **Screenshot of test + screenshot of code:** Capture Open Management/Open Membership or tier/join action and response. Code: [handleOpen, lines 74–81](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L74), [alreadyJoined, line 96](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L96), [actions, lines 148–151](../../../frontend/src/pages/member/MemberOrganisationsPage.jsx#L148).
3) **Expected outcome:** Owners/active/expired members open existing portals. Pending/cancelled actions obey server continuation/rejoin rules without duplicate memberships or payment bypass. **Defect probe:** pending is not `alreadyJoined` here; flag incorrect continuation behavior.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="profilepage"></a>

## ProfilePage.jsx — Personal profile

**Entry:** `/account/profile`. Use a verified/onboarded account, valid phone samples and prepared avatar files.

### PROF-01 — Populate profile and protect identifiers

1) **Test Case Title (Test Scenario):** Open saved and partially empty profiles; compare personal/address/photo/notification fields and attempt editing email/member number.
2) **Screenshot of test + screenshot of code:** Capture populated/default values and disabled identifiers. Code: [hydration, lines 31–45](../../../frontend/src/pages/member/ProfilePage.jsx#L31), [email, lines 171–180](../../../frontend/src/pages/member/ProfilePage.jsx#L171), [member number, lines 190–199](../../../frontend/src/pages/member/ProfilePage.jsx#L190).
3) **Expected outcome:** Saved values populate, missing optional text/photo is blank and missing notification preferences default checked. Email/member number stay disabled and are excluded from editable payload.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PROF-02 — Validate and save text/preferences

1) **Test Case Title (Test Scenario):** Try empty/space-only name and bio lengths 499/500/501. Save valid name/address/bio; toggle notification settings independently, including false. Delay/fail Save, retry, reload; separately leave an unsaved draft.
2) **Screenshot of test + screenshot of code:** Capture validation/counter, failed retained draft and reloaded saved details/preferences. Code: [payload/save, lines 76–108](../../../frontend/src/pages/member/ProfilePage.jsx#L76), [required name, lines 159–168](../../../frontend/src/pages/member/ProfilePage.jsx#L159), [bio, lines 203–212](../../../frontend/src/pages/member/ProfilePage.jsx#L203), [preferences/submit, lines 260–291](../../../frontend/src/pages/member/ProfilePage.jsx#L260).
3) **Expected outcome:** Empty/whitespace identity cannot persist (whitespace needs API validation); input stops at 500 bio characters. Valid fields/preferences persist and refresh account identity. Busy blocks repeat Save; failure preserves draft; retry recovers. Unsaved edits disappear on remount. Preference storage does not prove inbox delivery.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PROF-03 — Country and phone rules

1) **Test Case Title (Test Scenario):** Try missing country, blank phone, valid Malaysian number, too-short/country-invalid number and over-15-digit paste. Change country with phone populated.
2) **Screenshot of test + screenshot of code:** Capture required/invalid feedback, retained digits and rebased prefix. Code: [normalise/save, lines 80–105](../../../frontend/src/pages/member/ProfilePage.jsx#L80), [country, lines 246–248](../../../frontend/src/pages/member/ProfilePage.jsx#L246), [digit cap, lines 7–23](../../../frontend/src/components/PhoneInput.jsx#L7).
3) **Expected outcome:** Country is required, phone optional; valid phone normalises, invalid retained number is rejected. Input caps at 15 total digits then validates, so valid truncated numbers may save. Country change replaces calling code while retaining national digits.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PROF-04 — Upload, replace and remove an avatar

1) **Test Case Title (Test Scenario):** Upload JPEG/PNG/WebP under 2 MB; replace/remove and save/reload each change. Cancel picker and select the same file again.
2) **Screenshot of test + screenshot of code:** Capture filename/preview and persisted photo/default icon. Code: [avatar handlers, lines 47–74](../../../frontend/src/pages/member/ProfilePage.jsx#L47), [photo UI, lines 126–155](../../../frontend/src/pages/member/ProfilePage.jsx#L126).
3) **Expected outcome:** Valid changes preview and persist; removal clears photo/filename. Cancelling changes nothing; same-file reselection works. Saved avatar/name appears in subsequently loaded membership cards.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PROF-05 — Avatar type, size and corrupt-data boundaries

1) **Test Case Title (Test Scenario):** Test GIF/SVG, valid images exactly 2,097,152 bytes/one byte over and corrupt/zero-byte files reporting an allowed MIME type.
2) **Screenshot of test + screenshot of code:** Capture accepted/rejected preview and save response. Code: [type/size/reader, lines 10–11 and 47–68](../../../frontend/src/pages/member/ProfilePage.jsx#L10), [preview, lines 127–128](../../../frontend/src/pages/member/ProfilePage.jsx#L127).
3) **Expected outcome:** Unsupported/oversized files are rejected; valid limit-size image is accepted. **Defect probe:** uploader has no decode/nonempty check; invalid data should preserve the usable previous photo, not replace/persist it.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="membershippage"></a>

## MembershipPage.jsx — Manage Membership and CheckoutPage

**Entries:** `/member/membership?organisation=<id>` and `/member/checkout?organisation=<id>`. Both routed screens share these **eight cases**. Prepare free/paid/status variants, monthly/yearly tiers, scheduled changes and credit. Pending paid members normally go directly to checkout. Payments are simulated; sample code is `123456`. Compare amounts/dates with server quotes/responses.

### MEM-01 — Load membership overview, card and tier options

1) **Test Case Title (Test Scenario):** Compare paid/free, future-expiry/perpetual, expired-date-active and inactive records: identity, branding, price, dates/days/credit/card. Delay/fail membership and tier requests separately; Retry membership/reopen tiers. Leave near-expiry record open past the minute tick.
2) **Screenshot of test + screenshot of code:** Capture overview/card, loading/error and expiry transition. Code: [tier loading, lines 17–34](../../../frontend/src/pages/member/MembershipPage.jsx#L17), [status/timer/load, lines 53–85](../../../frontend/src/pages/member/MembershipPage.jsx#L53), [Retry/overview/card, lines 132–180](../../../frontend/src/pages/member/MembershipPage.jsx#L132), [card identity, lines 10–61](../../../frontend/src/components/MembershipCard.jsx#L10).
3) **Expected outcome:** Values/fallbacks match membership; only active unexpired/perpetual record has a card. Expiry removes it within refresh interval, days never negative. Request failures are explicit/recoverable; tier failure preserves loaded overview but prevents unsupported choices.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-02 — Enter checkout and review its quote

1) **Test Case Title (Test Scenario):** Try checkout without intent/session, pending join, `intent=upgrade|renew&tier=<id>` and unavailable/free tier. Review quotes with unused paid days, unavailable/partial/excess credit; fail calculation then Retry. Check Back destinations.
2) **Screenshot of test + screenshot of code:** Capture redirect/heading/tier and quote/error/credit breakdown. Code: [CheckoutPage, lines 227–249](../../../frontend/src/pages/member/MembershipPage.jsx#L227), [breakdown/tier rules, lines 17–32 and 63–84](../../../frontend/src/components/PaymentModal.jsx#L17), [quote gate, lines 204–208](../../../frontend/src/components/PaymentModal.jsx#L204).
3) **Expected outcome:** Accidental checkout returns to management; valid entry targets intended tier. Invalid tier/missing quote blocks payment; Retry recovers. Breakdown matches server subtotal/credit/due/date/carry-forward without negative charge. Free tier needs no payment. Join Back returns to My Memberships; others to management.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-03 — Authorize demo payment and handle validation/outcomes

1) **Test Case Title (Test Scenario):** Complete Card/Online banking/eWallet separately with Approved + `123456`; change sample provider where offered. Test blank/short/nondigit/over-six/wrong-six-digit code and Declined, then restart. Fail create/confirm once; once allow payment but fail account refresh.
2) **Screenshot of test + screenshot of code:** Capture method/code/error and successful receipt/access or refresh message. Code: [create/confirm/refresh, lines 110–154](../../../frontend/src/components/PaymentModal.jsx#L110), [receipt/restart/authorization, lines 186–201](../../../frontend/src/components/PaymentModal.jsx#L186).
3) **Expected outcome:** Code retains at most six digits; short cannot submit and wrong code is server-rejected. Decline/failure does not activate membership; retry/new session works. Approved receipt shows correct method/reference/amount/validity and creates one invoice. Access continuation waits for confirmed active account; refresh failure preserves payment success without asking to pay again. No real credentials are required.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-04 — Restore, change or cancel a checkout session

1) **Test Case Title (Test Scenario):** Reload awaiting/paid/expired/cancelled/failed sessions and unknown/foreign IDs. From authorization change details/method and continue; cancel, including a rejected cancellation and server-already-paid response.
2) **Screenshot of test + screenshot of code:** Capture restored step/receipt/restart or rejection, then cancellation notice. Code: [restore, lines 86–105](../../../frontend/src/components/PaymentModal.jsx#L86), [cancel/restart, lines 157–174](../../../frontend/src/components/PaymentModal.jsx#L157), [state/step actions, lines 186–202](../../../frontend/src/components/PaymentModal.jsx#L186).
3) **Expected outcome:** Server state determines the screen. Paid reload reuses receipt without another charge/invoice; terminal session needs restart. Foreign/unknown session exposes no private details. Successful cancellation clears session/step/method query without changing membership; failed cancellation remains recoverable. Already-paid stays paid; detail changes preserve coherent flow.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-05 — Review and complete an eligible upgrade

1) **Test Case Title (Test Scenario):** Compare monthly/yearly higher/equal/lower/inactive tiers and highest/nonactive membership states. Review upgrade and leave unpaid, then complete one with a scheduled downgrade present.
2) **Screenshot of test + screenshot of code:** Capture ordered choices, quote and resulting membership. Code: [comparable pricing/filter, lines 14–15 and 57–61](../../../frontend/src/pages/member/MembershipPage.jsx#L14), [upgrade section, lines 184–193](../../../frontend/src/pages/member/MembershipPage.jsx#L184).
3) **Expected outcome:** Strictly higher active monthly-equivalent tiers appear cheapest first; unavailable/nonactive choices have an explanation. Review alone changes no access/credit/schedule. Confirmed upgrade applies quoted credit/new period and replaces scheduled downgrade.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-06 — Schedule and manage a downgrade

1) **Test Case Title (Test Scenario):** Compare lower/equal/inactive monthly/yearly options on active paid/free/cancelling/lowest-tier memberships. Schedule lower paid/free, replace/remove schedule and fail a change once. Test missing/inactive scheduled tier and direct higher/unknown downgrade target.
2) **Screenshot of test + screenshot of code:** Capture eligibility/confirmation, changed schedule and unavailable/error state. Code: [rules, lines 60–68 and 139–143](../../../frontend/src/pages/member/MembershipPage.jsx#L60), [change request, lines 126–129](../../../frontend/src/pages/member/MembershipPage.jsx#L126), [notice, lines 166–169](../../../frontend/src/pages/member/MembershipPage.jsx#L166), [choices/confirmation, lines 196–199 and 218–223](../../../frontend/src/pages/member/MembershipPage.jsx#L196).
3) **Expected outcome:** Active paid period with expiry/no cancellation is required; cheaper active tiers sort highest monthly-equivalent first. One future schedule exists; scheduling/replacing/removing does not charge or alter current access. Paid target needs renewal payment, free starts after expiry. Failure retains prior schedule; unavailable target blocks renewal, invalid direct target has no Confirm.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-07 — Cancel and resume subscription renewal

1) **Test Case Title (Test Scenario):** Review cancellation on paid/free memberships, including a scheduled downgrade. Go back once; confirm with delayed/failed request then retry. Before paid expiry choose Keep my membership and reload.
2) **Screenshot of test + screenshot of code:** Capture end-date/immediate warning, cancellation/resume state and error. Code: [update/cancel/resume, lines 103–125](../../../frontend/src/pages/member/MembershipPage.jsx#L103), [notice, line 165](../../../frontend/src/pages/member/MembershipPage.jsx#L165), [subscription/dialog, lines 202–216](../../../frontend/src/pages/member/MembershipPage.jsx#L202).
3) **Expected outcome:** Back changes nothing; busy prevents repeats and failure reports without false state change. Paid cancellation retains access until expiry with no refund claim; free ends immediately. Success removes scheduled downgrade. Keep my membership removes future cancellation, preserving dates/access and restoring eligible downgrade options.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MEM-08 — Renew, rejoin or apply a credit-covered period

1) **Test Case Title (Test Scenario):** Follow expired/cancelled paid renewal, cancelled-free rejoin and restricted-status actions. Renew an ended period with scheduled cheaper paid tier; use a quote fully covered by credit once.
2) **Screenshot of test + screenshot of code:** Capture action/target, due-downgrade notice and new period/zero-due receipt. Code: [renewal rules/actions, lines 140–173](../../../frontend/src/pages/member/MembershipPage.jsx#L140), [renew intent, lines 231–246](../../../frontend/src/pages/member/MembershipPage.jsx#L231), [zero-due request/UI, lines 133–135 and 195–201](../../../frontend/src/components/PaymentModal.jsx#L133).
3) **Expected outcome:** Eligible paid renewal targets current/scheduled tier and needs approval; due downgrade renews cheaper tier. Free rejoin opens My Memberships. Restricted statuses gain no implied-active controls. Fully credit-covered period needs no payment method/code; confirmation applies correct zero total, credit and remaining balance.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="postspage"></a>

## PostsPage.jsx — Member feed and administrator publishing

**Entries:** `/member/communication?organisation=<id>` and `/admin/posts?organisation=<id>`. Prepare more than six posts, rich/long descriptions and optional images.

### POST-01 — Browse the paginated organisation feed

1) **Test Case Title (Test Scenario):** Compare reader/admin titles/counts/cards, dates/Edited, authors and missing/failed banners. Use Next/Previous with over six posts; test `page=0,abc,999`. Test empty, delayed/failed loading and Try again.
2) **Screenshot of test + screenshot of code:** Capture representative cards, page range and empty/error/recovery. Code: [page/fetch, lines 24–26 and 60–81](../../../frontend/src/pages/PostsPage.jsx#L24), [featured/states/paging, lines 223–239 and 306–340](../../../frontend/src/pages/PostsPage.jsx#L223), [card presentation, lines 5–43 and 57–76](../../../frontend/src/components/PostCard.jsx#L5).
3) **Expected outcome:** Correct organisation's newest-first data displays six per page; first reader card on page one alone is featured. Reader has no publishing controls. Invalid date is omitted, edits over one second show Edited and bad banner hides safely. Page values clamp/fallback correctly; boundaries disable. Empty/loading/error differ; retry recovers.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### POST-02 — Create or edit a post and recover a failed save

1) **Test Case Title (Test Scenario):** Open new/existing/off-page direct editor and unknown/foreign ID. Submit blank/space-only text, title 119/120/121 and subtitle 199/200/201 characters. Publish/update, Cancel an unsaved draft, then delay/fail Save and retry.
2) **Screenshot of test + screenshot of code:** Capture populated/invalid editor, validation/retained draft and resulting post. Code: [editor load/focus, lines 83–115](../../../frontend/src/pages/PostsPage.jsx#L83), [cancel/validation/save, lines 123–184](../../../frontend/src/pages/PostsPage.jsx#L123), [input limits/errors, lines 243–291](../../../frontend/src/pages/PostsPage.jsx#L243).
3) **Expected outcome:** Correct record/blank draft loads and title focuses; foreign/unavailable data is not editable. All text requires nonwhitespace; title/subtitle cap at 120/200 with accurate counters. Success creates once or updates original, clears composer and returns feed to page one; readers see changes on reload. Cancel discards; busy prevents repeats; failed save retains draft for retry.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### POST-03 — Format description and enforce document limits

1) **Test Case Title (Test Scenario):** Apply bold/italic/underline/numbered lists using toolbar/shortcuts; Undo/Redo, save/reopen. Try 999/1000/1001 description characters and overcomplex nested/node-count fixtures.
2) **Screenshot of test + screenshot of code:** Capture formatting/counter/limit feedback and published result. Code: [document guard, lines 24–35 and 59–70](../../../frontend/src/components/PostDescriptionEditor.jsx#L24), [toolbar/history, lines 143–162](../../../frontend/src/components/PostDescriptionEditor.jsx#L143), [renderer, lines 42–63](../../../frontend/src/components/PostDescription.jsx#L42).
3) **Expected outcome:** Supported formatting/order persists; toolbar tracks selection/history availability. At most 1,000 text characters are retained; oversized/overcomplex edits are rejected with feedback while previous valid content stays intact.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### POST-04 — Add, replace and validate post images

1) **Test Case Title (Test Scenario):** Publish without banner, then upload/replace/remove it. Insert inline images at caret: three allowed, then fourth. Test JPEG/PNG/WebP versus GIF/SVG/empty/corrupt files and exactly 2 MB/one byte over; delay reading.
2) **Screenshot of test + screenshot of code:** Capture preview/insertion/count error and reading lock. Code: [banner, line 287](../../../frontend/src/pages/PostsPage.jsx#L287), [banner validation, lines 17–68](../../../frontend/src/components/ImageUploadField.jsx#L17), [inline limits/upload, lines 24–35 and 104–140](../../../frontend/src/components/PostDescriptionEditor.jsx#L24).
3) **Expected outcome:** Banner is optional. Supported decodable nonempty images up to 2 MB persist; bad files preserve valid content. Inline insertion restores caret and rejects fourth image. Mutations wait for reading to finish; removal leaves readable image-free content.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### POST-05 — Delete a published post

1) **Test Case Title (Test Scenario):** Choose Keep post, then confirm deletion; fail once and retry. Delete final post on page N>1 and the post currently being edited.
2) **Screenshot of test + screenshot of code:** Capture confirmation/error and adjusted feed/editor. Code: [deletePost, lines 187–211](../../../frontend/src/pages/PostsPage.jsx#L187), [confirmation, lines 57–76](../../../frontend/src/components/PostCard.jsx#L57).
3) **Expected outcome:** Keep/failure retain record, with inline error on failure. Success updates count/feed, moves an empty final page to N−1 and clears the deleted editing target's composer/query.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### POST-06 — Expand and collapse a full notice

1) **Test Case Title (Test Scenario):** Compare nonfeatured descriptions of 300/301 characters and rich descriptions with images; use Read full notice/Show less and compare featured notice.
2) **Screenshot of test + screenshot of code:** Capture collapsed/expanded content. Code: [shortening, lines 15–18](../../../frontend/src/components/PostCard.jsx#L15), [expansion, lines 44–52](../../../frontend/src/components/PostCard.jsx#L44).
3) **Expected outcome:** Long/image-rich nonfeatured notices offer reversible expansion with matching `aria-expanded`; short plain notices do not. Featured content remains fully readable.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### POST-07 — Render legacy and malformed content safely

1) **Test Case Title (Test Scenario):** In isolated fixtures view plain legacy text, literal `<script>` text, unsupported nodes/marks and unsafe image URLs.
2) **Screenshot of test + screenshot of code:** Capture escaped/fallback text and console evidence when testing execution. Code: [validation/fallback, lines 8–35 and 66–68](../../../frontend/src/components/PostDescription.jsx#L8), [known-node renderer, lines 42–63](../../../frontend/src/components/PostDescription.jsx#L42).
3) **Expected outcome:** Malformed/unsupported rich content falls back to escaped description. Arbitrary HTML/attributes/unsafe image sources are neither executed nor trusted.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="memberdashboard"></a>

## MemberDashboard.jsx — Member dashboard

**Entry:** `/member/dashboard?organisation=<id>`. Prepare known tier perks, expiry/status variants and confirmed/unjoined events.

### MDASH-01 — Load membership summary, privileges and card

1) **Test Case Title (Test Scenario):** Compare identity/status/tier/expiry/perks and branded card for active future/perpetual, expired and inactive records, including missing data. Leave near expiry open; delay/fail dashboard loading and reopen after recovery.
2) **Screenshot of test + screenshot of code:** Capture summary/card/perks, expiry change and error/fallback. Code: [load/eligibility/summary, lines 27–98](../../../frontend/src/pages/member/MemberDashboard.jsx#L27), [card/perks, lines 121–166](../../../frontend/src/pages/member/MemberDashboard.jsx#L121), [card fields, lines 10–61](../../../frontend/src/components/MembershipCard.jsx#L10).
3) **Expected outcome:** Details/perks/fallbacks match records; only active unexpired/perpetual membership has a card. Clock updates expiry eligibility. Failure is reported and reload recovers (no Retry button). **Defect probe:** fallback must not imply full fresh data or hide stale identity behind a successful-looking dashboard.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MDASH-02 — View confirmed upcoming RSVPs

1) **Test Case Title (Test Scenario):** Compare confirmed upcoming/in-progress/ended and nonjoined events, then no unended RSVPs. Inspect title/schedule/location; leave an event open past end.
2) **Screenshot of test + screenshot of code:** Capture confirmed/empty list and post-end state. Code: [ended filter, line 59](../../../frontend/src/pages/member/MemberDashboard.jsx#L59), [RSVP display, lines 186–213](../../../frontend/src/pages/member/MemberDashboard.jsx#L186).
3) **Expected outcome:** Only confirmed unended returned events appear; ended event disappears on next clock tick. Empty state offers calendar access. Schedule/location match; their detailed shared component variants are covered by EVT-02.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### MDASH-03 — Open dashboard feature shortcuts

1) **Test Case Title (Test Scenario):** Use every Manage Membership, Events/Browse/View Calendar, Payment Invoices and Profile Information action.
2) **Screenshot of test + screenshot of code:** Capture each feature destination. Code: [header, lines 101–116](../../../frontend/src/pages/member/MemberDashboard.jsx#L101), [section links, lines 148–194](../../../frontend/src/pages/member/MemberDashboard.jsx#L148), [quick links, lines 218–244](../../../frontend/src/pages/member/MemberDashboard.jsx#L218).
3) **Expected outcome:** Named screen opens; portal features use current organisation and profile uses account-level `/account/profile`.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="invoicespage"></a>

## InvoicesPage.jsx — Billing history and receipts

**Entry:** `/member/invoices?organisation=<id>`, receipt query `&invoice=<id>`. Prepare paid/nonpaid/credit-bearing records, missing fields and foreign/unknown IDs. Downloads are JSON; Print may offer Save as PDF.

### INV-01 — Browse history and open a receipt

1) **Test Case Title (Test Scenario):** Compare populated/empty list rows, paid/nonpaid status and paidAt/createdAt dates. Open row/direct receipt; test unknown/foreign ID. Delay/fail base/direct fetch; retry direct error or reload base list after recovery.
2) **Screenshot of test + screenshot of code:** Capture rows/loading, selected/unavailable receipt and recovery. Code: [selection/load, lines 12–36](../../../frontend/src/pages/member/InvoicesPage.jsx#L12), [list/rows, lines 61–126](../../../frontend/src/pages/member/InvoicesPage.jsx#L61), [unresolved/Retry, lines 144–156](../../../frontend/src/pages/member/InvoicesPage.jsx#L144).
3) **Expected outcome:** All returned invoices display accurate two-decimal MYR/status/date; current-list invoice alone opens. Direct link waits for loading, foreign ID reveals nothing and Retry recovers. **Defect probe:** failed base fetch must stay distinguishable from genuine empty history, despite current empty-message fallback/no Retry button.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### INV-02 — Review complete receipt and credit calculations

1) **Test Case Title (Test Scenario):** Compare number/billed identity/method/status/tier/interval/dates with records; test demo/non-demo, missing optional fields, zero/positive credit and carry-forward balance.
2) **Screenshot of test + screenshot of code:** Capture receipt identity, fallbacks, subtotal/credit/tax/total/balance. Code: [demo/amount rules, lines 7–10](../../../frontend/src/components/InvoiceModal.jsx#L7), [receipt fields/calculations, lines 65–184](../../../frontend/src/components/InvoiceModal.jsx#L65).
3) **Expected outcome:** Record values match, simulated payment says no money charged, optional gaps use readable fallback/N/A. Cents convert correctly; positive credit deducts, zero credit adds no row, total equals invoice.amount and remaining credit appears. Flag Yearly interval fallback if contrary to actual data.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### INV-03 — Export selected invoice JSON

1) **Test Case Title (Test Scenario):** Download from table and Export from receipt; open both files and compare identity/amount.
2) **Screenshot of test + screenshot of code:** Capture downloads and matching JSON. Code: [list download, lines 38–46](../../../frontend/src/pages/member/InvoicesPage.jsx#L38), [modal export, lines 16–24 and 48–54](../../../frontend/src/components/InvoiceModal.jsx#L16).
3) **Expected outcome:** Both are `<invoiceNumber>.json` for the selected invoice; list action reports matching success. Export changes no record and leaves modal usable; it is not a PDF download.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### INV-04 — Print a receipt

1) **Test Case Title (Test Scenario):** Click Print, inspect full preview at a standard page size, cancel and optionally save a test PDF.
2) **Screenshot of test + screenshot of code:** Capture readable full receipt with modal toolbar hidden. Code: [window.print, lines 12–14](../../../frontend/src/components/InvoiceModal.jsx#L12), [print styles, lines 28–30 and 65–187](../../../frontend/src/components/InvoiceModal.jsx#L28).
3) **Expected outcome:** Browser print UI opens, receipt values remain readable and toolbar hides. Cancel changes nothing; flag clipping or unrelated background content that interferes with the receipt.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="eventscalendarpage"></a>

## EventsCalendarPage.jsx — Events and RSVP

**Entry:** `/member/events?organisation=<id>`. Prepare categories, schedules, tier/seat restrictions and existing RSVPs; two test sessions for last-seat contention.

### EVT-01 — Browse/filter events and handle loading failures

1) **Test Case Title (Test Scenario):** Inspect cards and absent/failed thumbnails. Select All/Gala/Workshop/Networking/Executive Briefing and unknown category; test empty, delayed/failed fetch, then reload after recovery.
2) **Screenshot of test + screenshot of code:** Capture filters/cards/loading/empty/error and thumbnail behavior. Code: [fetch, lines 24–48](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L24), [filter/states, lines 87–133](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L87), [thumbnail, lines 154–161](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L154).
3) **Expected outcome:** Correct records/categories display; All restores returned events. Missing image uses illustration; no matches is clear. **Defect probes:** failed image has no explicit fallback and request failure can show misleading empty result despite toast. No Retry button: reopen/reload after recovery.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EVT-02 — Inspect schedules and map locations

1) **Test Case Title (Test Scenario):** Compare single/multi-day/legacy/missing schedules and expand over-three-day event. Open text/coordinate/place-ID locations with punctuation/non-English names; include absent location.
2) **Screenshot of test + screenshot of code:** Capture dates/times/timezone, extra days, map target/attribution/fallback. Code: [schedule, lines 12–43](../../../frontend/src/components/EventSchedule.jsx#L12), [location, lines 48–54](../../../frontend/src/components/EventSchedule.jsx#L48).
3) **Expected outcome:** Actual daily times/timezone and legacy data persist; extra-day count/expansion works. Missing data says to be confirmed; map opens encoded saved location in another tab with supported coordinate attribution. This also covers dashboard's shared components.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EVT-03 — Enforce tier and capacity availability

1) **Test Case Title (Test Scenario):** Compare eligible/ineligible/all-tier events and current-tier chips. Test 0%, 85%, above-85%, one/zero seats, plus isolated negative spotsLeft/over-capacity/missing-zero capacity fixtures.
2) **Screenshot of test + screenshot of code:** Capture access labels, count/meter and disabled or suspicious action. Code: [eligibility/ratio, lines 137–141](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L137), [count/tier UI, lines 194–233](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L194), [restrictions, lines 253–265](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L253).
3) **Expected outcome:** Access labels/current-tier highlight agree with eligibility; unavailable tier/full event blocks new RSVP. Meter changes above 85% and caps at 100%. **Defect probe:** exact-zero full check and capacity default can misrepresent negative/missing data; flag enabled invalid availability. Server must always prevent overbooking.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EVT-04 — Reserve or cancel a seat, including errors

1) **Test Case Title (Test Scenario):** RSVP, reload, cancel and reload. Delay/fail each action and retry; compare email sent/unavailable responses. Try last seat concurrently in two sessions.
2) **Screenshot of test + screenshot of code:** Capture pending/error/toast, attendance and refreshed seat count. Code: [RSVP/cancel handlers, lines 50–84](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L50), [attendance, lines 169–173](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L169), [action states, lines 240–282](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L240).
3) **Expected outcome:** Success persists one reservation/removal and refetches counts; busy blocks same-event repeats. Failure preserves prior state and recovers. Server accepts only available seat and rejects competing request clearly. Email unavailability uses informational feedback without undoing successful RSVP or claiming inbox delivery. Attendee can cancel a full event before end.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### EVT-05 — Respect event start/end and RSVP cutoff

1) **Test Case Title (Test Scenario):** Compare upcoming/in-progress/ended/unknown-schedule with/without RSVP. Leave near start/end open, click RSVP at start boundary and include multi-day overnight gap.
2) **Screenshot of test + screenshot of code:** Capture status/action transition and cutoff feedback. Code: [fresh-time guard, line 51](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L51), [status/actions, lines 137–140 and 240–253](../../../frontend/src/pages/member/EventsCalendarPage.jsx#L137), [event-wide timing](../../../shared/eventTiming.js).
3) **Expected outcome:** New RSVP closes at event start and stays closed between later days. Clock updates display; click guard blocks late RSVP before rerender. Existing in-progress RSVP remains cancellable under current rules; ended RSVP is recorded without cancellation; unknown schedule cannot accept new RSVP.
4) **Test Status:** ☐ PASS ☐ FAIL — Not run.
