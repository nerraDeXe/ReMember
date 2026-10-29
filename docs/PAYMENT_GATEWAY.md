# Membership payment gateway demo

ReMember includes an in-app payment gateway that simulates card, online banking, and e-wallet payments in **MYR**. Checkout has payment selection, verification, processing, approval or decline, and a receipt. Every payment screen identifies the flow as a demo: **no money is charged**.

Use the preset demo payment details. Do not enter real card numbers, CVCs, banking passwords, wallet credentials, or one-time passwords. The gateway requires no payment-provider account, API key, webhook, or extra terminal process.

## Run locally

Start one backend instance in `C:\ReMember\backend`:

```powershell
npm run dev
```

Start the frontend in a separate terminal in `C:\ReMember\frontend`:

```powershell
npm run dev
```

Open `http://localhost:5173`. The backend uses port `5000`, and Vite forwards `/api` requests to it. If port 5000 is already occupied by another copy of this backend, stop that earlier instance before starting a new one.

MongoDB and the usual account/email configuration are still required. No additional payment environment variables are needed. Restart the backend after updating its source or environment settings.

## Try a payment

Use separate owner and member accounts to check the complete flow:

1. Create an organisation and a monthly or yearly paid membership tier with a price in MYR. Owners do not need to connect a payment-provider account.
2. Join the paid tier as a member. The membership remains pending and opens checkout. Reloading, browser Back, or a direct dashboard URL must not grant access before an approved payment.
3. Review the organisation, membership tier, price, and billing period. Choose **Card**, **Online banking**, or **E-wallet**, using the supplied demo details.
4. Choose the approved scenario and complete verification with the demo code **123456**. The backend confirms the checkout, creates a paid invoice, activates the membership, and sets its paid expiry.
5. Check the receipt and member invoice history. The member dashboard, community content, eligible events, and digital pass are available according to the active membership's permissions.
6. Try the declined scenario with a fresh checkout. A declined payment records a failed invoice without activating a pending membership or extending its expiry. Canceling a checkout also leaves it unpaid.
7. Retry or reload a completed payment. Its saved result must be reused; the same checkout cannot create a second paid invoice or extend the membership twice.

Free tiers activate immediately without checkout. Renewals use another member-initiated checkout; monthly and yearly describe the purchased membership period. The demo does not debit an account automatically or run recurring charges in the background. An approved renewal extends from the later of the current expiry or the payment date by one calendar month or year, clamping to the last valid day for shorter months.

Owners can open **Payments** in their admin portal to review the demo gateway's available methods and behaviour. No onboarding or payment configuration is required.

## Manage a membership and upgrade

The member portal has one **Manage Membership** tab containing the digital pass, first subscription date, current paid period, renewal date, days remaining, and subscription options. Opening the tab does not create a checkout. Existing `/member/pass` and `/member/renew` links open the combined overview. Initial paid joins still require activation through checkout. Expired paid memberships have an explicit renewal action.

An active member can review a higher tier before opening checkout. Upgrades start a new monthly or yearly billing period. The server calculates unused paid credit using the recorded service value and exact time remaining in each prepaid period, then deducts it from the new tier's full price. For example, MYR 100 with exactly half its paid period remaining provides MYR 50 credit towards a MYR 200 tier, making MYR 150 due for a new full period. Calendar months and years use their actual dates, including leap years and shorter months.

Credit is based on paid MYR membership records, not editable tier prices or event tickets. Future prepaid renewals count towards unused credit. Any credit above the new price remains on the membership for a future payment. Repeated upgrades transfer the new period's full service value; they do not reuse invoices already replaced by an upgrade. A membership without verifiable paid dates receives no estimated credit. The review and receipt show the subtotal, applied credit, total due and new renewal date. Fully covered upgrades require confirmation without a payment code.

Cancelling a paid membership preserves the pass and member access until the paid period ends. Members can undo scheduled cancellation before that date. Free memberships end immediately when cancelled and can be rejoined. Cancellation does not issue a refund, and renewal reminders stop while cancellation is scheduled. The demo continues to use manual payments without automatic deductions.

## Schedule a downgrade

Members can choose a cheaper tier in **Manage Membership → Downgrade at renewal**. Cheaper means a lower equivalent monthly price, so monthly and yearly tiers are compared consistently. Scheduling or changing the choice does not create a checkout, charge a payment, alter the current tier, or shorten its paid period. The overview shows the pending tier and effective date, with an option to cancel the change.

The cheaper paid tier becomes the renewal choice only after the current paid period ends. The member then confirms the usual manual demo payment. Until payment is approved, the expired higher tier does not grant active access. A free tier takes effect without checkout once the old paid period ends and the account is next refreshed. The server rechecks the target's availability, price and capacity; a deleted, deactivated or full tier does not silently grant access or select a different tier.

Cancelling the subscription removes the pending downgrade. A successful immediate upgrade also removes the pending downgrade; failed or cancelled upgrade checkouts leave it in place. Administrative membership changes and rejoining invalidate old scheduled choices. Scheduling, replacing or cancelling a downgrade invalidates older checkout quotes, preventing a stale payment from applying the wrong next tier.

## Server-side rules

The backend creates an authenticated, organisation-scoped checkout with the tier's stored MYR price and interval. The browser cannot choose a lower amount, assign a different recipient, mark an invoice paid, or activate a membership by changing a return URL. Checkout lookup, confirmation, and cancellation are restricted to the member who created it and the relevant organisation.

The confirmation request selects only a supported payment method (`card`, `online_banking`, or `ewallet`), a demo scenario (`approved` or `declined`), and the demo verification code. The server determines the resulting invoice and membership change. Checkout sessions expire after 15 minutes and have a `pending`, `paid`, `failed`, `cancelled`, or `expired` state. A declined or cancelled payment leaves access unchanged. Paid confirmation never removes an administrative suspension or revocation.

All routes below require an authenticated member and the captured organisation context:

| Method and route | Input | Purpose |
| --- | --- | --- |
| `GET /api/members/membership` | `organisationId` query parameter | Read membership history, billing dates and cancellation state. |
| `POST /api/members/membership/cancel` | `organisationId` | Cancel the selected member's subscription. |
| `POST /api/members/membership/resume` | `organisationId` | Undo cancellation while paid access remains. |
| `POST /api/members/membership/downgrade` | `organisationId`, `tierId` | Schedule a cheaper tier after the current paid period. |
| `POST /api/members/membership/downgrade/cancel` | `organisationId` | Remove the pending downgrade. |
| `POST /api/payments/quote` | `tierId`, `organisationId`, `intent` | Preview `join`, `renew` or `upgrade`, including unused credit. |
| `POST /api/payments/checkout` | `tierId`, `organisationId`, `intent` | Create a checkout using the server's quote. |
| `GET /api/payments/checkout/:sessionId` | `organisationId` query parameter | Read the member's checkout and saved result. |
| `POST /api/payments/checkout/:sessionId/confirm` | `organisationId`, `paymentMethod`, `scenario`, `verificationCode` | Complete the demo payment. Use verification code `123456`. |
| `POST /api/payments/checkout/:sessionId/cancel` | `organisationId` | Cancel a pending checkout. |

The legacy `POST /api/payments/renew` route only creates a checkout; it cannot mark a payment successful.

Historical invoices remain available. Existing records are not deleted or converted as part of this update. MYR financial summaries exclude historical invoices in other currencies.

## Deployment and troubleshooting

Deploy both the backend and frontend changes on Render. The same in-app demo works when hosted; it does not require an externally reachable payment callback. Configure normal application values such as MongoDB, session signing, email delivery, and `APP_WEB_URL` as described in the [Render deployment guide](RENDER_DEPLOYMENT.md).

`API endpoint 'POST /api/payments/checkout' not found` means an older backend is still running. Stop and restart the local backend with `npm run dev`, or deploy the updated backend on Render. Rebuilding only the frontend leaves the API unchanged.

Use `npm test` in `backend` for automated payment and access-control checks. The legacy `backend/test_suite.js` is an additional manual smoke script that assumes specific seeded accounts and may modify development data or trigger configured email delivery; run it only against a suitable development database.
