# Public, authentication and account setup — manual test cases

This checklist contains 34 focused tests for eight page modules. Related variants share one workflow: complete each named variant before marking its case PASS. All tests remain unrun.

For field 2, attach a browser screenshot and a source-code screenshot with filename/line numbers visible; use the case ID in their filenames. Redact passwords, tokens and personal details. Use disposable accounts/organisations. Delayed, rejected or unusual API responses require targeted interception or a controlled fixture; keep session/login requests working when testing another endpoint.

Apply the [shared checklist](shared-behaviour.md) once for access rules, organisation context, sessions, history, ordinary navigation and general keyboard/layout checks. Only module-specific interactions are repeated here. Code references describe the current source and may move after edits.

<a id="landingpage"></a>
## 1. LandingPage

**Open:** `/`. Test signed out with public/private records, different searchable fields and records missing images/optional details.

### LP-01 — Read public organisation cards accurately

1) **Test Case Title (Test Scenario): Read public organisation cards accurately.** Load public records with normal/missing/broken images and member counts 0 and 1; compare their cards with Details. Search a private record’s exact name.

2) **Screenshot of test + screenshot of code:** Capture cards/placeholders, private-name results and card/details counts. Screenshot [frontend/src/pages/LandingPage.jsx:31–57](../../../frontend/src/pages/LandingPage.jsx#L31) (public fetch/filter); [frontend/src/pages/LandingPage.jsx:196–283](../../../frontend/src/pages/LandingPage.jsx#L196) (cards/memberCount fallback); [frontend/src/pages/LandingPage.jsx:381–384](../../../frontend/src/pages/LandingPage.jsx#L381) (details count); [frontend/src/components/OrganisationImage.jsx:4–16](../../../frontend/src/components/OrganisationImage.jsx#L4) (fallback).

3) **Expected outcome:** Only public records appear, with supplied card details and up to three tags; broken/missing images use placeholders. Counts should match actual data in both views. **Known discrepancy:** memberCount || 1 shows 1 for a true 0 on cards; record FAIL if reproduced. UI filtering alone does not prove backend privacy.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LP-02 — Search, filter and recover empty results

1) **Test Case Title (Test Scenario): Search, filter and recover empty results.** Search fragments of name, description, category, location and tags; repeat mixed case/surrounding spaces and spaces only. Combine a category with search, then test no matches and an empty database. Use X versus Clear Search & Filters.

2) **Screenshot of test + screenshot of code:** Capture representative matches/counts, empty messages and reset controls. Screenshot [frontend/src/pages/LandingPage.jsx:24–25](../../../frontend/src/pages/LandingPage.jsx#L24) (filter state); [frontend/src/pages/LandingPage.jsx:50–57](../../../frontend/src/pages/LandingPage.jsx#L50) (category/filter); [frontend/src/pages/LandingPage.jsx:98–111](../../../frontend/src/pages/LandingPage.jsx#L98) (search/X); [frontend/src/pages/LandingPage.jsx:143–194](../../../frontend/src/pages/LandingPage.jsx#L143) (category/empty/reset UI); [frontend/src/organisationDirectory.js:1–14](../../../frontend/src/organisationDirectory.js#L1) (search fields/normalization).

3) **Expected outcome:** Supported fields match case-insensitively with surrounding spaces ignored; spaces-only acts empty. Search/category combine and counts match. Empty database says No Public Organisations Available; no matches says No Matching Organisations Found. X clears only search; Clear resets search/category to All.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LP-03 — Load the directory or explain fetch failure

1) **Test Case Title (Test Scenario): Load the directory or explain fetch failure.** Delay the organisations request, then repeat with that request failing and no details query open.

2) **Screenshot of test + screenshot of code:** Capture loading UI and failed-request outcome plus network evidence. Screenshot [frontend/src/pages/LandingPage.jsx:31–48](../../../frontend/src/pages/LandingPage.jsx#L31) (loading/error); [frontend/src/pages/LandingPage.jsx:134–140](../../../frontend/src/pages/LandingPage.jsx#L134) (count loading); [frontend/src/pages/LandingPage.jsx:166–194](../../../frontend/src/pages/LandingPage.jsx#L166) (directory states); [frontend/src/pages/LandingPage.jsx:335–339](../../../frontend/src/pages/LandingPage.jsx#L335) (error display branch).

3) **Expected outcome:** Loading indicator/text appears until completion. Failure should be distinguishable from a successfully empty directory and offer recovery. **Known discrepancy:** normal rendering does not show loadError, so failure currently resembles empty data; record FAIL when observed.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LP-04 — Inspect organisation details and unavailable records

1) **Test Case Title (Test Scenario): Inspect organisation details and unavailable records.** Open a populated record, then one without requirements/tags/website. Check website/new tab or fallback and both close controls. Separately open ?organisationDetails=&lt;id&gt; during delayed loading, then use unknown ID/failed list response and Back to directory.

2) **Screenshot of test + screenshot of code:** Capture details/optional content, website outcome, loading/unavailable message and closed dialog. Screenshot [frontend/src/pages/LandingPage.jsx:26–29](../../../frontend/src/pages/LandingPage.jsx#L26) (selectedOrg); [frontend/src/pages/LandingPage.jsx:266–272](../../../frontend/src/pages/LandingPage.jsx#L266) (Details action); [frontend/src/pages/LandingPage.jsx:335–356](../../../frontend/src/pages/LandingPage.jsx#L335) (loading/unavailable/close); [frontend/src/pages/LandingPage.jsx:389–460](../../../frontend/src/pages/LandingPage.jsx#L389) (policy/tags/website/footer).

3) **Expected outcome:** Details shows the selected full description/all tags; absent requirements use the default policy. Website opens a new tab or partner fallback appears. Direct valid IDs load after the list; unknown/error states explain unavailability. Close controls/Back to directory remove the dialog.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LP-05 — Start joining from the public directory

1) **Test Case Title (Test Scenario): Start joining from the public directory.** Try Join ReMember, a card’s Join and Details → Apply & Join; use Sign In as an existing user.

2) **Screenshot of test + screenshot of code:** Capture resulting registration/sign-in pages and URLs. Screenshot [frontend/src/pages/LandingPage.jsx:74–86](../../../frontend/src/pages/LandingPage.jsx#L74) (header actions); [frontend/src/pages/LandingPage.jsx:273–279](../../../frontend/src/pages/LandingPage.jsx#L273) (Join); [frontend/src/pages/LandingPage.jsx:450–458](../../../frontend/src/pages/LandingPage.jsx#L450) (Apply & Join).

3) **Expected outcome:** Join actions open /register; Sign In opens /login. These public actions do not themselves create membership or automatically join the selected organisation.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="loginpage"></a>
## 2. LoginPage

**Open:** `/login`. Prepare valid/incorrect credentials and a configured Google test client. Shared cases cover account-state destinations and actual session expiry.

### LI-01 — Submit valid or invalid credentials

1) **Test Case Title (Test Scenario): Submit valid or invalid credentials.** Sign in with a valid account; repeat blank email/password, malformed email such as member-at-example, unknown email and wrong password. Also open login from registration’s existing-account action.

2) **Screenshot of test + screenshot of code:** Capture welcome/destination, browser validation, API error and prefilled email. Screenshot [frontend/src/pages/LoginPage.jsx:7–10](../../../frontend/src/pages/LoginPage.jsx#L7) (initialEmail); [frontend/src/pages/LoginPage.jsx:17–29](../../../frontend/src/pages/LoginPage.jsx#L17) (submit); [frontend/src/pages/LoginPage.jsx:59–81](../../../frontend/src/pages/LoginPage.jsx#L59) (required email/password); [frontend/src/pages/RegisterPage.jsx:125–126](../../../frontend/src/pages/RegisterPage.jsx#L125) (prefilled link).

3) **Expected outcome:** Valid credentials authenticate and open permitted home. Required/email validation blocks malformed input; incorrect credentials show API/fallback error. Existing-account navigation prefills email with an empty password.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LI-02 — Prevent duplicate login and retry failure

1) **Test Case Title (Test Scenario): Prevent duplicate login and retry failure.** Delay login; attempt editing, submitting again and starting Google. Return network/server failure, then restore and retry.

2) **Screenshot of test + screenshot of code:** Capture Authenticating/disabled controls, error and successful retry. Screenshot [frontend/src/pages/LoginPage.jsx:17–29](../../../frontend/src/pages/LoginPage.jsx#L17) (loading/finally); [frontend/src/pages/LoginPage.jsx:54–55](../../../frontend/src/pages/LoginPage.jsx#L54) (fieldset lock); [frontend/src/pages/LoginPage.jsx:104–124](../../../frontend/src/pages/LoginPage.jsx#L104) (submit/Google lock).

3) **Expected outcome:** Pending login disables fields/submit and the concurrent Google path. Failure ends loading and permits retry without reload.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LI-03 — Configure password visibility and remembered sign-in

1) **Test Case Title (Test Scenario): Configure password visibility and remembered sign-in.** Toggle Show/Hide with a disposable value. Compare Remember Me unchecked/checked; submit each and inspect redacted request metadata.

2) **Screenshot of test + screenshot of code:** Capture toggle state and 24-hour/30-day hints with safe request evidence. Screenshot [frontend/src/pages/LoginPage.jsx:72–103](../../../frontend/src/pages/LoginPage.jsx#L72) (visibility/duration options); [frontend/src/pages/LoginPage.jsx:22](../../../frontend/src/pages/LoginPage.jsx#L22) (rememberMe argument).

3) **Expected outcome:** Visibility changes without losing the value and accessible state follows the toggle. Remember Me sends its selected boolean and changes the hint from 24 hours to 30 days. Shared cases verify actual expiry enforcement.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### LI-04 — Sign in with Google or recover provider errors

1) **Test Case Title (Test Scenario): Sign in with Google or recover provider errors.** Use an existing linked Google account with the chosen duration. Repeat disabled config/script failure, rejected credential and account conflict with existing-email metadata; retry when offered.

2) **Screenshot of test + screenshot of code:** Capture Google busy/error/retry/conflict UI and successful destination. Screenshot [frontend/src/pages/LoginPage.jsx:124](../../../frontend/src/pages/LoginPage.jsx#L124) (Google props); [frontend/src/components/GoogleSignIn.jsx:6–17](../../../frontend/src/components/GoogleSignIn.jsx#L6) (script loading); [frontend/src/components/GoogleSignIn.jsx:34–75](../../../frontend/src/components/GoogleSignIn.jsx#L34) (callback/errors).

3) **Expected outcome:** Success forwards Remember Me and opens account home; busy locks the email form. Provider failure leaves email login usable and offers retry when unavailable. A conflict should retain error/existing-account action. **Source concern:** catch calls initialise(), which clears error; record FAIL if conflict feedback disappears.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="registerpage"></a>
## 3. RegisterPage

**Open:** `/register and /register/google`. Use fresh disposable email/Google accounts. Google completion requires an in-memory pending signup response.

### RG-01 — Create an email account or recover submission failure

1) **Test Case Title (Test Scenario): Create an email account or recover submission failure.** Submit required fields with/without optional phone/bio; include surrounding spaces in names/bio. Repeat delayed submission, network/server failure and registered email returning 409; follow its existing-account link.

2) **Screenshot of test + screenshot of code:** Capture success/next screen, safe payload, busy/error states and prefilled login. Screenshot [frontend/src/pages/RegisterPage.jsx:26–55](../../../frontend/src/pages/RegisterPage.jsx#L26) (submit/payload/error); [frontend/src/pages/RegisterPage.jsx:63–74](../../../frontend/src/pages/RegisterPage.jsx#L63) (busy controls); [frontend/src/pages/RegisterPage.jsx:125–133](../../../frontend/src/pages/RegisterPage.jsx#L125) (conflict/submit/login).

3) **Expected outcome:** Valid signup trims name/email/bio, normalizes optional phone and proceeds to the permitted account flow. Pending creation locks edits/submit/Google; failure permits retry. A 409 exposes sign-in with the email prefilled. Pending Google authentication also disables the email fieldset.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### RG-02 — Validate required personal fields and text boundaries

1) **Test Case Title (Test Scenario): Validate required personal fields and text boundaries.** Try empty/whitespace-only names and malformed email. Test name lengths 80/81, email 254/255 and bio 500/501 characters, with other fields valid.

2) **Screenshot of test + screenshot of code:** Capture validation, bounded inputs and bio counter. Screenshot [frontend/src/pages/RegisterPage.jsx:29–31](../../../frontend/src/pages/RegisterPage.jsx#L29) (trimmed required validation); [frontend/src/pages/RegisterPage.jsx:68–88](../../../frontend/src/pages/RegisterPage.jsx#L68) (name/email constraints); [frontend/src/pages/RegisterPage.jsx:120–125](../../../frontend/src/pages/RegisterPage.jsx#L120) (bio/error).

3) **Expected outcome:** Names/email must be valid; whitespace-only names fail. Names cap at 80 each, email at 254 and bio at 500, with an accurate counter. Phone/bio remain optional.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### RG-03 — Apply password policy and visibility controls

1) **Test Case Title (Test Scenario): Apply password policy and visibility controls.** Try Short1!, no uppercase, no digit and no symbol. Compare a compliant 72-byte ASCII value with A1! plus 35 copies of é (over 72 UTF-8 bytes), then ExamplePassword1!. Toggle Show/Hide using a disposable value.

2) **Screenshot of test + screenshot of code:** Capture policy feedback/hint and redacted visibility state. Screenshot [frontend/src/pages/RegisterPage.jsx:33–36](../../../frontend/src/pages/RegisterPage.jsx#L33) (passwordError); [frontend/src/pages/RegisterPage.jsx:92–107](../../../frontend/src/pages/RegisterPage.jsx#L92) (password/toggle/hint); [shared/accountRules.js:1–6](../../../shared/accountRules.js#L1) (byte/composition checks).

3) **Expected outcome:** Policy requires at least 8 characters, uppercase, digit and symbol, maximum 72 UTF-8 bytes. Invalid variants fail including Unicode over the byte limit; valid boundary value passes. Visibility retains the value and updates accessible state.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### RG-04 — Select country and enter a valid optional phone

1) **Test Case Title (Test Scenario): Select country and enter a valid optional phone.** Search country fragment/code; select by mouse and ArrowUp/Down, Home/End, Enter/Escape, or exact-input blur. Try unsupported free text. Before selecting country inspect phone; then use Malaysia local/international input, non-digits, over 15 total digits and a short invalid number; change country to United Kingdom.

2) **Screenshot of test + screenshot of code:** Capture selected/no-match country, keyboard state, phone prefix/value and invalid-number feedback. Screenshot [frontend/src/pages/RegisterPage.jsx:112–117](../../../frontend/src/pages/RegisterPage.jsx#L112) (country/phone wiring); [frontend/src/pages/RegisterPage.jsx:45](../../../frontend/src/pages/RegisterPage.jsx#L45) (normalisePhone); [frontend/src/components/CountrySelect.jsx:5–59](../../../frontend/src/components/CountrySelect.jsx#L5) (search/keyboard/validity); [frontend/src/components/PhoneInput.jsx:4–24](../../../frontend/src/components/PhoneInput.jsx#L4) (phone input); [frontend/src/phone.js:13–19](../../../frontend/src/phone.js#L13) (rebasePhone); [shared/accountRules.js:10–19](../../../shared/accountRules.js#L10) (phone validation).

3) **Expected outcome:** Country is required and must resolve to a supported selection; search ignores case/accents and supports exact codes. Phone stays disabled before selection, then uses its prefix, digits only and 15-digit total cap. Valid numbers normalize without duplicate prefix; invalid numbers fail. Changing country preserves national digits with the new prefix, then revalidates.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### RG-05 — Complete first-time Google signup

1) **Test Case Title (Test Scenario): Complete first-time Google signup.** Choose Google signup with a new account; on /register/google edit names, select country, optionally phone/bio and submit.

2) **Screenshot of test + screenshot of code:** Capture completion URL, locked email/editable names, absent password and next screen. Screenshot [frontend/src/pages/RegisterPage.jsx:18](../../../frontend/src/pages/RegisterPage.jsx#L18) (prefill); [frontend/src/pages/RegisterPage.jsx:33–50](../../../frontend/src/pages/RegisterPage.jsx#L33) (Google submission); [frontend/src/pages/RegisterPage.jsx:59–108](../../../frontend/src/pages/RegisterPage.jsx#L59) (Google completion UI); [frontend/src/context/AuthContext.jsx:150–160](../../../frontend/src/context/AuthContext.jsx#L150) (pending signup/token).

3) **Expected outcome:** First-time response opens completion. Google email is read-only, names remain editable and password is not required. Completion submits the pending signup token and enters the permitted account flow.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### RG-06 — Recover missing or expired Google signup context

1) **Test Case Title (Test Scenario): Recover missing or expired Google signup context.** Refresh /register/google to lose pending memory and use Back to sign up. Separately submit an expired signup token. Provider-error/conflict variants are in LI-04.

2) **Screenshot of test + screenshot of code:** Capture choose-Google-again fallback and expired-token error. Screenshot [frontend/src/pages/RegisterPage.jsx:48–59](../../../frontend/src/pages/RegisterPage.jsx#L48) (missing context/errors); [frontend/src/context/AuthContext.jsx:156–160](../../../frontend/src/context/AuthContext.jsx#L156) (completeGoogleSignup).

3) **Expected outcome:** Missing context requests another Google selection and offers signup navigation. Expired token shows API error and must not create a usable session.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="verifyemailpage"></a>
## 4. VerifyEmailPage

**Open:** `/verify-email`. Use an unverified account/current test-email code and controlled resend responses.

### VE-01 — Enter and confirm a six-digit code

1) **Test Case Title (Test Scenario): Enter and confirm a six-digit code.** Check the account email; type/paste mixed characters and more than 6 digits, compare 0–5 versus 6 digits. Submit current, incorrect and backend-expired codes in separate sessions; delay/fail a request and retry.

2) **Screenshot of test + screenshot of code:** Capture sanitized input/button states, success and rejection/busy UI. Screenshot [frontend/src/pages/VerifyEmailPage.jsx:26–38](../../../frontend/src/pages/VerifyEmailPage.jsx#L26) (verify handler); [frontend/src/pages/VerifyEmailPage.jsx:72–93](../../../frontend/src/pages/VerifyEmailPage.jsx#L72) (email/input/busy controls).

3) **Expected outcome:** Only the first 6 digits remain; confirmation requires exactly 6. Current code succeeds and leaves verification; wrong/expired/network responses show error and allow retry. Busy disables input/confirm/resend/sign-out. Code validity/expiry are backend checks.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### VE-02 — Resend successfully and wait for its cooldown

1) **Test Case Title (Test Scenario): Resend successfully and wait for its cooldown.** Resend with delivery=sent and future canResendAt; observe countdown expiry. Repeat without timestamp and delay the response to inspect Sending.

2) **Screenshot of test + screenshot of code:** Capture sent toast, disabled resend/countdown and enabled control at zero. Screenshot [frontend/src/pages/VerifyEmailPage.jsx:14–24](../../../frontend/src/pages/VerifyEmailPage.jsx#L14) (remaining/timer); [frontend/src/pages/VerifyEmailPage.jsx:41–55](../../../frontend/src/pages/VerifyEmailPage.jsx#L41) (resend success); [frontend/src/pages/VerifyEmailPage.jsx:89–91](../../../frontend/src/pages/VerifyEmailPage.jsx#L89) (resend UI).

3) **Expected outcome:** Success clears delivery warning and shows sent toast. Cooldown uses returned time or 60-second fallback, never becomes negative and enables resend at expiry; pending resend locks conflicting actions.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### VE-03 — Explain delivery failure and rate limiting

1) **Test Case Title (Test Scenario): Explain delivery failure and rate limiting.** Open with verificationDeliveryError; repeat resend delivery failed/unavailable, a plain network error and a rate limit with canResendAt/retryAfterSeconds.

2) **Screenshot of test + screenshot of code:** Capture send-failure/inline error and updated cooldown. Screenshot [frontend/src/pages/VerifyEmailPage.jsx:13–19](../../../frontend/src/pages/VerifyEmailPage.jsx#L13) (delivery state); [frontend/src/pages/VerifyEmailPage.jsx:53–68](../../../frontend/src/pages/VerifyEmailPage.jsx#L53) (error/retry handling); [frontend/src/pages/VerifyEmailPage.jsx:77–91](../../../frontend/src/pages/VerifyEmailPage.jsx#L77) (warning/cooldown).

3) **Expected outcome:** Failure never reports a sent-success toast; relevant warning/error appears. Plain failure clears busy for retry; supplied retry metadata disables resend until allowed.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### VE-04 — Recognize confirmation completed elsewhere

1) **Test Case Title (Test Scenario): Recognize confirmation completed elsewhere.** Confirm in another session, then return already_verified from resend.

2) **Screenshot of test + screenshot of code:** Capture resulting onboarding/permitted account screen. Screenshot [frontend/src/pages/VerifyEmailPage.jsx:45–49](../../../frontend/src/pages/VerifyEmailPage.jsx#L45) (already_verified branch).

3) **Expected outcome:** Account refreshes and leaves verification instead of reporting another code sent.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="passwordrecoverypage"></a>
## 5. PasswordRecoveryPage

**Open:** `/forgot-password and /reset-password?token=<test-token>`. This module has two forms. Use disposable accounts/inbox and redact tokens. Backend checks enforce token expiry, one-time use and old-session invalidation.

### PR-01 — Request recovery instructions and handle errors

1) **Test Case Title (Test Scenario): Request recovery instructions and handle errors.** Submit blank/malformed email and 254/255-character values; compare registered/unknown email responses. Delay/fail a valid request, retry, then use Back to sign in. Inspect the Google-only instruction.

2) **Screenshot of test + screenshot of code:** Capture validation, Sending/error, confirmation replacing form and sign-in destination. Screenshot [frontend/src/pages/PasswordRecoveryPage.jsx:12–26](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L12) (forgot form/submit).

3) **Expected outcome:** Email is required, validly formatted and capped at 254. Sending disables the form; failure allows retry. Success displays the backend message and replaces the form, preserving generic existence messaging where supplied. Google-only users are told to use Google sign-in; Back opens login.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PR-02 — Handle incomplete links and request replacements

1) **Test Case Title (Test Scenario): Handle incomplete links and request replacements.** Visit /reset-password without token; use Request another link. Also use Request a new link from a token-bearing form.

2) **Screenshot of test + screenshot of code:** Capture incomplete-link message and request-form destination. Screenshot [frontend/src/pages/PasswordRecoveryPage.jsx:32–33](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L32) (token query); [frontend/src/pages/PasswordRecoveryPage.jsx:48–49](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L48) (missing-token/new-link UI).

3) **Expected outcome:** No token means no reset form. Replacement-link actions open /forgot-password. Shared cases cover legacy links and recovery while signed in.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PR-03 — Validate matching replacement passwords

1) **Test Case Title (Test Scenario): Validate matching replacement passwords.** Try either field blank, mismatch, Short1!, no uppercase/digit/symbol and Unicode over 72 UTF-8 bytes. Compare a compliant 72-byte value.

2) **Screenshot of test + screenshot of code:** Capture required/mismatch/policy feedback with secrets redacted. Screenshot [frontend/src/pages/PasswordRecoveryPage.jsx:39–42](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L39) (policy/confirmation); [frontend/src/pages/PasswordRecoveryPage.jsx:49](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L49) (input constraints/hint); [shared/accountRules.js:1–6](../../../shared/accountRules.js#L1) (policy).

3) **Expected outcome:** Both values are required and must match. The signup policy also applies: minimum 8 characters, uppercase/digit/symbol and maximum 72 UTF-8 bytes. Invalid inputs do not submit; valid boundary passes.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PR-04 — Reset with a usable link or recover rejection

1) **Test Case Title (Test Scenario): Reset with a usable link or recover rejection.** Submit a current link successfully; separately try expired, altered and already-used tokens. Delay/fail a usable-link request and retry.

2) **Screenshot of test + screenshot of code:** Capture Password updated/token-free URL, rejection errors and Updating/disabled state. Screenshot [frontend/src/pages/PasswordRecoveryPage.jsx:43–49](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L43) (reset API/error/busy/success).

3) **Expected outcome:** Success clears local session, replaces URL without token and offers Sign in. Invalid/reused tokens show backend errors and allow requesting another link. Pending reset disables controls; transient failure re-enables retry. The displayed 30-minute/single-use text alone does not prove enforcement.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### PR-05 — Prove password change and session invalidation

1) **Test Case Title (Test Scenario): Prove password change and session invalidation.** After reset try old/new passwords; in a second pre-reset browser session make an authenticated request.

2) **Screenshot of test + screenshot of code:** Capture old-password rejection, new-password success and old-session rejection. Screenshot [frontend/src/pages/PasswordRecoveryPage.jsx:44–48](../../../frontend/src/pages/PasswordRecoveryPage.jsx#L44) (logout/session claim); [frontend/src/pages/LoginPage.jsx:17–29](../../../frontend/src/pages/LoginPage.jsx#L17) (login); [frontend/src/context/AuthContext.jsx:93–112](../../../frontend/src/context/AuthContext.jsx#L93) (expired-session handling).

3) **Expected outcome:** Old password fails, new password succeeds and old sessions are rejected by the backend/handled as expired. Use actual request evidence; success text alone does not prove invalidation.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="accountonboardingpage"></a>
## 6. AccountOnboardingPage

**Open:** `/onboarding`. Use a verified account with onboardingCompleted=false; shared cases cover access rules/sign-out.

### AO-01 — Choose to create an organisation

1) **Test Case Title (Test Scenario): Choose to create an organisation.** Compare greeting with/without firstName, inspect both choices, then choose Create an organisation.

2) **Screenshot of test + screenshot of code:** Capture welcome choices and tier-setup destination. Screenshot [frontend/src/pages/AccountOnboardingPage.jsx:25–41](../../../frontend/src/pages/AccountOnboardingPage.jsx#L25) (greeting/choices).

3) **Expected outcome:** Greeting adapts to firstName; organisation creation is optional and opens /account/organisations/new.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AO-02 — Choose directory browsing and recover save failure

1) **Test Case Title (Test Scenario): Choose directory browsing and recover save failure.** Choose Find an organisation with successful response. Repeat delayed response/error/retry, trying both cards/sign-out while pending.

2) **Screenshot of test + screenshot of code:** Capture My Memberships destination, Opening directory and error/disabled states. Screenshot [frontend/src/pages/AccountOnboardingPage.jsx:11–20](../../../frontend/src/pages/AccountOnboardingPage.jsx#L11) (browse handler); [frontend/src/pages/AccountOnboardingPage.jsx:27–42](../../../frontend/src/pages/AccountOnboardingPage.jsx#L27) (busy/error UI); [frontend/src/navigation.js:42–44](../../../frontend/src/navigation.js#L42) (directory alias).

3) **Expected outcome:** Success marks onboarding complete and opens /account/memberships. Pending action disables choices/sign-out. Failure stays on onboarding with useful error; retry becomes available.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="organisationsetuppage"></a>
## 7. OrganisationSetupPage

**Open:** `/account/organisations/new`. Use a verified account and disposable organisations. Draft data remains in memory rather than the step query.

### OS-01 — Add or remove tier rows within limits

1) **Test Case Title (Test Scenario): Add or remove tier rows within limits.** Start with one tier, add to 20, remove a middle row and add again; reduce to one and try Remove.

2) **Screenshot of test + screenshot of code:** Capture initial row, 20-row limit and retained row values. Screenshot [frontend/src/pages/OrganisationSetupPage.jsx:11–22](../../../frontend/src/pages/OrganisationSetupPage.jsx#L11) (row keys/initial state); [frontend/src/pages/OrganisationSetupPage.jsx:95–106](../../../frontend/src/pages/OrganisationSetupPage.jsx#L95) (add/remove UI).

3) **Expected outcome:** Last tier cannot be removed; Add disables at 20 and re-enables after removal. Other rows retain their own values.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### OS-02 — Define valid distinct tiers and billing periods

1) **Test Case Title (Test Scenario): Define valid distinct tiers and billing periods.** Try blank/space-only name, Gold versus spaced lowercase gold, and name lengths 80/81. Test blank, 0, 10, 10.50, -1, 1.234 and 1e2 amounts. Correct names, then choose Monthly/Yearly on different tiers and Continue.

2) **Screenshot of test + screenshot of code:** Capture name/amount feedback, selected periods and next step. Screenshot [frontend/src/pages/OrganisationSetupPage.jsx:29–43](../../../frontend/src/pages/OrganisationSetupPage.jsx#L29) (tier validation); [frontend/src/pages/OrganisationSetupPage.jsx:67](../../../frontend/src/pages/OrganisationSetupPage.jsx#L67) (tier payload); [frontend/src/pages/OrganisationSetupPage.jsx:99–101](../../../frontend/src/pages/OrganisationSetupPage.jsx#L99) (inputs).

3) **Expected outcome:** Each tier needs a name capped at 80; trimmed case-insensitive duplicates fail. Amounts allow nonnegative plain values with at most 2 decimals; zero is free, other invalid variants fail. Intervals persist; amounts send as numbers in MYR.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### OS-03 — Validate details and choose visibility

1) **Test Case Title (Test Scenario): Validate details and choose visibility.** Try missing/space-only name/description; test maxima name 120, description 2000, category 80, location 120 plus one extra character. Leave optional fields blank in one run; select Public/Private in separate runs.

2) **Screenshot of test + screenshot of code:** Capture required/boundary fields and selected visibility. Screenshot [frontend/src/pages/OrganisationSetupPage.jsx:51–53](../../../frontend/src/pages/OrganisationSetupPage.jsx#L51) (trim validation); [frontend/src/pages/OrganisationSetupPage.jsx:112–126](../../../frontend/src/pages/OrganisationSetupPage.jsx#L112) (detail limits/visibility).

3) **Expected outcome:** Trimmed name/description are required; text maxima are enforced and category/location are optional. Visibility choice updates the selected radio and determines the creation payload.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### OS-04 — Create an organisation and recover a failed save

1) **Test Case Title (Test Scenario): Create an organisation and recover a failed save.** Create valid Public/Private records with surrounding spaces in text/tier names. During a delayed create try edits/Back/Edit tiers/resubmit; separately return error or success=false and retry.

2) **Screenshot of test + screenshot of code:** Capture safe saved payload, success/admin destination, directory visibility and busy/error UI. Screenshot [frontend/src/pages/OrganisationSetupPage.jsx:55–80](../../../frontend/src/pages/OrganisationSetupPage.jsx#L55) (create/refresh/select/error); [frontend/src/pages/OrganisationSetupPage.jsx:112–140](../../../frontend/src/pages/OrganisationSetupPage.jsx#L112) (locking/submit).

3) **Expected outcome:** Successful save trims text, sends public/true or private/false, refreshes/selects the organisation and opens admin dashboard. Server persistence makes only public records discoverable. Pending save locks visible fields/actions; failure keeps the wizard and permits retry.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### OS-05 — Recover dashboard opening without creating twice

1) **Test Case Title (Test Scenario): Recover dashboard opening without creating twice.** Allow create to succeed, fail refreshUser/selectOrganisation, then recover with Open Dashboard; inspect request count.

2) **Screenshot of test + screenshot of code:** Capture created-but-not-opened error, locked details/recovery button and one create request. Screenshot [frontend/src/pages/OrganisationSetupPage.jsx:57–78](../../../frontend/src/pages/OrganisationSetupPage.jsx#L57) (createdOrganisation retry); [frontend/src/pages/OrganisationSetupPage.jsx:112–140](../../../frontend/src/pages/OrganisationSetupPage.jsx#L112) (post-create lock/button).

3) **Expected outcome:** Created ID is retained; recovery retries refresh/select instead of creation. Only one create request is sent and recovery can open its dashboard.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### OS-06 — Navigate wizard steps without bypassing validation

1) **Test Case Title (Test Scenario): Navigate wizard steps without bypassing validation.** Fill tiers/details and use Edit tiers/Back/Continue to confirm mounted drafts persist. In fresh tabs try ?step=2 with blank initial tier and ?step=3; use first-step Back as onboarded versus incomplete user.

2) **Screenshot of test + screenshot of code:** Capture step/query/summary, retained drafts, direct-step validation and Back destinations. Screenshot [frontend/src/pages/OrganisationSetupPage.jsx:17–22](../../../frontend/src/pages/OrganisationSetupPage.jsx#L17) (step state); [frontend/src/pages/OrganisationSetupPage.jsx:46–53](../../../frontend/src/pages/OrganisationSetupPage.jsx#L46) (tier validation before save); [frontend/src/pages/OrganisationSetupPage.jsx:86–88](../../../frontend/src/pages/OrganisationSetupPage.jsx#L86) (progress); [frontend/src/pages/OrganisationSetupPage.jsx:129–140](../../../frontend/src/pages/OrganisationSetupPage.jsx#L129) (summary/back/continue).

3) **Expected outcome:** Mounted step changes retain drafts; full reload does not. Direct step 2 still rejects incomplete tiers; only step=2 selects details. First-step Back returns onboarded users to My Organisations, others to onboarding. Generic history/stale-response behavior is shared coverage.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

<a id="accounthomepage"></a>
## 8. AccountHomePage

**Open:** `/account/organisations and /account/memberships`. This is the tab shell; child forms/data have their own module tests.

### AH-01 — Select account content and understand draft lifetime

1) **Test Case Title (Test Scenario): Select account content and understand draft lifetime.** Open each URL, switch tabs and return after entering a local unsaved child draft; compare a URL-backed filter.

2) **Screenshot of test + screenshot of code:** Capture selected tab/panel/URL and child values before/after. Screenshot [frontend/src/pages/AccountHomePage.jsx:6–9](../../../frontend/src/pages/AccountHomePage.jsx#L6) (tab definitions); [frontend/src/pages/AccountHomePage.jsx:27–38](../../../frontend/src/pages/AccountHomePage.jsx#L27) (active-only panels).

3) **Expected outcome:** My Organisations mounts OrganisationsManagementPage; My Memberships mounts MemberOrganisationsPage. Only active child mounts, so local drafts are not guaranteed to survive; URL-backed state returns when its query is present. Shared cases cover general Back/Forward.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

### AH-02 — Operate account tabs by keyboard

1) **Test Case Title (Test Scenario): Operate account tabs by keyboard.** Use ArrowRight/Left across both ends, Home/End and Tab into content.

2) **Screenshot of test + screenshot of code:** Capture focused/selected tab and matching panel attributes. Screenshot [frontend/src/pages/AccountHomePage.jsx:13–22](../../../frontend/src/pages/AccountHomePage.jsx#L13) (handleTabKeyDown); [frontend/src/pages/AccountHomePage.jsx:27–37](../../../frontend/src/pages/AccountHomePage.jsx#L27) (ARIA/tabIndex).

3) **Expected outcome:** Arrows wrap with selection/focus; Home selects My Organisations and End My Memberships. Only selected tab has tabIndex=0; each panel is labelled by its corresponding tab.

4) **Test Status:** ☐ PASS ☐ FAIL — Not run.

---

**Prepared cases:** 34. All remain **Not run**; no module exceeds 6 cases.
