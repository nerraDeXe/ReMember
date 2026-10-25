# Page URLs and browser navigation

Every application page has a pathname. Navigating within ReMember adds browser
history, and Back/Forward restores the page and its URL state. Main portal links
also support copying their address and opening another tab.

| Area | Paths |
| --- | --- |
| Public | `/`, `/login`, `/register`, `/register/google`, `/forgot-password`, `/reset-password` |
| Account setup | `/verify-email`, `/onboarding`, `/account/organisations/new` |
| Account | `/account/organisations`, `/account/memberships`, `/account/profile` |
| Member portal | `/member/dashboard`, `/member/events`, `/member/invoices`, `/member/communication`, `/member/pass`, `/member/renew` |
| Admin portal | `/admin/dashboard`, `/admin/members`, `/admin/tiers`, `/admin/events`, `/admin/posts`, `/admin/email-settings`, `/admin/finances`, `/admin/logs` |

Portal URLs include `?organisation=<id>`. A direct visit or history traversal
selects that organisation before loading portal data and checking the user's
organisation role. Unavailable organisations return to the account home with an
error message. Protected links redirect to sign in and retain their destination
in `next`; verification and onboarding are still required.

Forms and detail views use query parameters on their parent page:

| Page | Query |
| --- | --- |
| Public directory and My Memberships | `organisationDetails=<id>` |
| My Organisations | `orgEdit=<id>` |
| Organisation setup | `step=2` for organisation details |
| Member directory | `memberTier=<user-id>` |
| Tiers | `tier=new` or `tier=<id>` |
| Events management | `event=new` or `roster=<event-id>` |
| Posts management | `post=new` or `post=<id>` |
| Invoices | `invoice=<id>` |
| Any member portal page | `renew=1` for checkout |

Pagination, directory filters, event categories, analytics selections and email
preview tabs also live in the URL. Search typing replaces the current history
entry. Closing a form opened within the app goes back to its parent entry;
closing a directly loaded form replaces its URL with its parent page. Form
contents, uploads and payment fields remain local and are not placed in URLs.

Older emailed `#reset-password?token=...` links migrate to `/reset-password`
without losing the token. Unknown paths show a page-not-found screen. Existing
Vercel and Express SPA fallbacks serve direct page visits without changing API
routing.

The member directory and post editor use organisation-scoped
`GET /api/admin/members/:id` and `GET /api/posts/:id` lookups when restoring a
record from its URL. These retain the existing authentication and access checks.

Run automated navigation coverage with `npm test --prefix frontend`; backend
scope and hosting tests run with `npm test --prefix backend`.
