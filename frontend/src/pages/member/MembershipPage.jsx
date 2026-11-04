import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, CreditCard, RefreshCw, ShieldCheck, IdCard } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useNavigation } from '../../routing.jsx';
import MembershipCard from '../../components/MembershipCard.jsx';
import PaymentModal from '../../components/PaymentModal.jsx';

const DAY_MS = 86_400_000;
const money = amount => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(amount) || 0);
const dateLabel = value => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not recorded';
const yearly = tier => ['yearly', 'year'].includes(tier?.interval);
const monthlyPrice = tier => (Number(tier?.price) || 0) / (yearly(tier) ? 12 : 1);

// Load tiers only when membership management or checkout needs them.
function useMembershipTiers() {
  const { user } = useAuth();
  const organisationId = user.activeOrganisationId;
  const [result, setResult] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.getTiers(organisationId).then(response => {
      if (!response.success) throw new Error(response.message || 'Could not load membership tiers.');
      if (!cancelled) setResult({ organisationId, tiers: response.tiers || [] });
    }).catch(error => {
      if (!cancelled) setResult({ organisationId, error: error.message || 'Could not load membership tiers.' });
    });
    return () => { cancelled = true; };
  }, [organisationId]);
  const current = result?.organisationId === organisationId ? result : null;
  return { tiers: current?.tiers || [], tiersLoading: !current, tiersError: current?.error || '' };
}

export default function MembershipPage({ onNavigate }) {
  const { tiers, tiersLoading, tiersError } = useMembershipTiers();
  const { user, refreshUser, getCurrentUser } = useAuth();
  const { showToast } = useToast();
  const { route, updateQuery, closeQuery } = useNavigation();
  const organisationId = user.activeOrganisationId;
  const [record, setRecord] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(false);
  const cancelDialog = useRef(null);
  const cancelBackButton = useRef(null);
  const membership = record?.organisationId === organisationId ? record.membership : null;
  const loading = !membership && !loadError;
  const expiryTime = membership?.expirationDate ? new Date(membership.expirationDate).getTime() : null;
  const active = membership?.status === 'active' && (!expiryTime || expiryTime > now);
  const status = membership?.status === 'active' && expiryTime && expiryTime <= now ? 'expired' : membership?.status;
  const cancelOpen = route.query.get('membershipAction') === 'cancel' && !!membership;
  const currentTier = membership?.tier || tiers.find(tier => tier._id === membership?.tierId);
  const upgrades = useMemo(() => tiers.filter(tier => tier.isActive !== false && tier._id !== currentTier?._id
    && monthlyPrice(tier) > monthlyPrice(currentTier)).sort((left, right) => monthlyPrice(left) - monthlyPrice(right)), [tiers, currentTier]);
  const downgrades = useMemo(() => tiers.filter(tier => tier.isActive !== false && tier._id !== currentTier?._id
    && monthlyPrice(tier) < monthlyPrice(currentTier)).sort((left, right) => monthlyPrice(right) - monthlyPrice(left)), [tiers, currentTier]);
  const downgradeOpen = route.query.get('membershipAction') === 'downgrade' && !!membership;
  const downgradeTier = downgrades.find(tier => tier._id === route.query.get('downgradeTier'));
  const actionOpen = cancelOpen || downgradeOpen;
  const scheduledTier = membership?.scheduledTier;
  const hasScheduledDowngrade = !!membership?.scheduledTierId;
  const scheduledUnavailable = hasScheduledDowngrade && (membership.scheduledTierUnavailable || !scheduledTier || scheduledTier.isActive === false);
  const scheduledDue = hasScheduledDowngrade && new Date(membership.scheduledTierEffectiveAt).getTime() <= now;
  const closeAction = () => closeQuery(['membershipAction', 'downgradeTier']);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setLoadError('');
    setActionError('');
    setBusy(false);
    api.getMembership(organisationId).then(response => {
      if (!response.success || !response.membership) throw new Error('Could not load your membership.');
      if (!cancelled) setRecord({ organisationId, membership: response.membership });
    }).catch(error => { if (!cancelled) setLoadError(error.message || 'Could not load your membership.'); });
    return () => { cancelled = true; };
  }, [organisationId, revision]);

  useEffect(() => {
    if (!actionOpen) return;
    const previousFocus = document.activeElement;
    cancelBackButton.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape' && !busy) closeQuery(['membershipAction', 'downgradeTier']);
      if (event.key !== 'Tab') return;
      const buttons = [...(cancelDialog.current?.querySelectorAll('button:not([disabled])') || [])];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus?.(); };
  }, [actionOpen, busy, closeQuery]);

  const updateMembership = async (request, message, { errorMessage = 'Could not update your membership.', queryKeys = 'membershipAction' } = {}) => {
    if (busy) return;
    const canApply = () => mounted.current && getCurrentUser()?.activeOrganisationId === organisationId;
    setBusy(true);
    setActionError('');
    try {
      const response = await request();
      if (!response.success) throw new Error(response.message || errorMessage);
      if (!canApply()) return;
      if (response.membership) setRecord({ organisationId, membership: response.membership });
      await refreshUser();
      if (!canApply()) return;
      closeQuery(queryKeys);
      setRevision(value => value + 1);
      showToast(message, 'success');
    } catch (error) { if (canApply()) setActionError(error.message || errorMessage); }
    finally { if (canApply()) setBusy(false); }
  };

  const changeCancellation = cancel => updateMembership(
    () => cancel ? api.cancelMembership(organisationId) : api.resumeMembership(organisationId),
    cancel ? 'Your membership cancellation has been saved.' : 'Your membership will remain active.',
  );
  const changeDowngrade = tierId => updateMembership(
    () => tierId ? api.scheduleMembershipDowngrade(organisationId, tierId) : api.cancelMembershipDowngrade(organisationId),
    tierId ? 'Your downgrade is scheduled for the end of your current paid period.' : 'Your scheduled downgrade has been cancelled.',
    { errorMessage: 'Could not update your scheduled membership change.', queryKeys: ['membershipAction', 'downgradeTier'] },
  );

  if (loading) return <div role="status" className="row-inline-wide text-description membership-loading"><RefreshCw className="icon-medium-spinner" />Loading your membership…</div>;
  if (loadError) return <div className="content-stack"><h1 className="text-2xl font-bold">Manage Membership</h1><p role="alert" className="text-error">{loadError}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="link-underlined text-sm">Retry</button></div>;

  const firstSubscribedAt = membership.firstSubscribedAt;
  const periodStart = membership.currentPeriodStart;
  const daysRemaining = expiryTime ? Math.max(0, Math.ceil((expiryTime - now) / DAY_MS)) : null;
  const cancellingAtEnd = membership.cancelAtPeriodEnd && active;
  const paidPeriod = Number(currentTier?.price) > 0 && active && expiryTime;
  const canCancel = active || status === 'pending';
  const renewalTier = hasScheduledDowngrade ? scheduledTier : currentTier;
  const canRenew = ['expired', 'cancelled'].includes(status) && !scheduledUnavailable && Number(renewalTier?.price) > 0;
  const canScheduleDowngrade = active && paidPeriod && !cancellingAtEnd;
  const statusLabel = cancellingAtEnd ? 'Cancellation scheduled' : ({ active: 'Active', pending: 'Pending payment', expired: 'Expired', suspended: 'Suspended', revoked: 'Revoked', cancelled: 'Cancelled' }[status] || status);

  return <div className="page-stack">
    <div><h1 className="heading-large">Manage Membership</h1><p className="text-intro">Your membership card, details and subscription options in one place.</p></div>

    <section aria-labelledby="membership-overview-title" className="panel-responsive">
      <div className="row-header">
        <div><h2 id="membership-overview-title" className="text-lg font-bold">Membership overview</h2><p className="text-description mt-1">{membership.organisation?.name || user.activeOrganisation?.name}</p></div>
        <span className={`badge-label ${active ? "choice-selected member-status-active" : "state-inactive"}`}>{statusLabel}</span>
      </div>
      <div className="detail-card row-between membership-current">
        <div><p className="text-label-muted">Current membership</p><h3 className="membership-tier-title">{currentTier?.name || membership.tierName || 'Membership'}</h3><p className="text-help">Member ID: <span className="font-mono">{membership.membershipNumber || user.membershipNumber}</span></p><p className="text-help">Member since: {dateLabel(membership.joinedDate)}</p></div>
        <p className="text-strong">{Number(currentTier?.price) > 0 ? <>{money(currentTier.price)} <span className="membership-price-period">/ {yearly(currentTier) ? 'year' : 'month'}</span></> : 'Free membership'}</p>
      </div>
      <dl className="form-grid membership-dates">
        <div><dt className="row-inline-tight text-label-muted"><CalendarDays className="icon-small" />First subscribed</dt><dd className="membership-date-value">{dateLabel(firstSubscribedAt)}</dd></div>
        <div><dt className="row-inline-tight text-label-muted"><CalendarDays className="icon-small" />Current period started</dt><dd className="membership-date-value">{periodStart ? dateLabel(periodStart) : 'Not recorded'}</dd></div>
        <div><dt className="row-inline-tight text-label-muted"><CalendarDays className="icon-small" />{cancellingAtEnd ? 'Access ends' : 'Renewal date'}</dt><dd className="membership-date-value">{membership.expirationDate ? dateLabel(membership.expirationDate) : 'No renewal required'}</dd></div>
        <div><dt className="row-inline-tight text-label-muted"><Clock className="icon-small" />Days remaining</dt><dd className="membership-date-value">{daysRemaining === null ? 'No expiry' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}</dd></div>
      </dl>
      {Number(membership.creditBalanceCents) > 0 && <p className="text-description mt-4">Membership credit: <strong>{money(membership.creditBalanceCents / 100)}</strong>. Available credit is applied to your next membership payment.</p>}
      {cancellingAtEnd && <p role="status" className="membership-cancellation-notice">Your subscription is cancelled for renewal. Your membership card and member access remain available until {dateLabel(membership.expirationDate)}.</p>}
      {hasScheduledDowngrade && <div role="status" aria-label="Scheduled membership downgrade" className="membership-downgrade-notice">
        <h3 className="font-bold">{scheduledUnavailable ? 'Scheduled tier unavailable' : 'Downgrade scheduled'}</h3>
        {scheduledUnavailable ? <p className="mt-2">The membership tier selected for your next renewal is no longer available. Cancel this scheduled change to renew your current tier or choose another available tier.</p> : <><p className="mt-2">Next membership: <strong>{scheduledTier.name}</strong> — {Number(scheduledTier.price) > 0 ? `${money(scheduledTier.price)} / ${yearly(scheduledTier) ? 'year' : 'month'}` : 'Free membership'}.</p><p className="mt-2">{scheduledDue ? `Your previous paid period ended on ${dateLabel(membership.scheduledTierEffectiveAt)}. Renew with ${scheduledTier.name} to start your next billing period.` : `Your current membership and pass stay unchanged until ${dateLabel(membership.scheduledTierEffectiveAt)}. ${Number(scheduledTier.price) > 0 ? 'No payment is taken now. Complete payment for the cheaper tier when your current period ends.' : 'Your free membership will begin after your current paid period ends, with no payment required.'}`}</p></>}
        <button type="button" disabled={busy} onClick={() => changeDowngrade(null)} className="membership-downgrade-cancel">Cancel scheduled downgrade</button>
      </div>}
      {!active && <p className="text-description mt-5">Your membership card and member features are available with an active membership.</p>}
      {canRenew && <button type="button" onClick={() => onNavigate('member-checkout', { query: { intent: 'renew', tier: renewalTier?._id || membership.tierId } })} className="button-accent button-standard mt-4">{hasScheduledDowngrade ? `Renew with ${renewalTier.name}` : 'Renew membership'}</button>}
      {status === 'cancelled' && Number(currentTier?.price) === 0 && <button type="button" onClick={() => onNavigate('account-memberships')} className="button-accent button-standard mt-4">Rejoin membership</button>}
    </section>

    <div className="membership-layout">
      <section aria-labelledby="membership-pass-title" className="panel-responsive">
        <h2 id="membership-pass-title" className="row-inline membership-section-heading"><IdCard className="icon-brand" />Membership card</h2>
        <p className="membership-card-description">Your current membership details, all in one place.</p>
        {active ? <MembershipCard user={{ ...user, ...membership, status: 'active', tierName: currentTier?.name || membership.tierName }} /> : <div className="membership-card-empty"><ShieldCheck className="icon-large mx-auto mb-2" />Your card will be available when your membership is active.</div>}
      </section>

      <div className="page-stack">
        <section aria-labelledby="membership-upgrades-title" className="panel-responsive">
          <h2 id="membership-upgrades-title" className="row-inline membership-section-heading"><CreditCard className="icon-brand" />Upgrade your membership</h2>
          <p className="text-intro">An upgrade starts a new billing period. The unused value of your current paid period is credited towards the new tier. Review the exact credit and total before you pay.</p>
          {hasScheduledDowngrade && <p className="membership-upgrade-note">Completing an upgrade will replace your scheduled downgrade.</p>}
          {tiersLoading ? <p role="status" className="text-pending">Loading membership tiers…</p> : tiersError ? <p role="alert" className="text-error mt-4">{tiersError}</p> : !active ? <p className="text-pending">An active membership is required to upgrade.</p> : !upgrades.length ? <p className="text-pending">You already have the highest available membership tier.</p> : <div className="content-stack mt-4">{upgrades.map(tier => <article key={tier._id} className="detail-card">
            <div className="membership-tier-summary"><h3 className="text-sm font-bold">{tier.name}</h3><p className="text-sm font-semibold">{money(tier.price)} <span className="text-caption font-normal">/ {yearly(tier) ? 'year' : 'month'}</span></p></div>
            {!!tier.description && <p className="membership-tier-description">{tier.description}</p>}
            {!!tier.perks?.length && <ul className="mt-3 space-y-1.5">{tier.perks.map((perk, index) => <li key={index} className="membership-tier-perk"><CheckCircle2 className="icon-brand-small shrink-0" />{perk}</li>)}</ul>}
            <button type="button" aria-label={`Upgrade to ${tier.name}`} onClick={() => onNavigate('member-checkout', { query: { intent: 'upgrade', tier: tier._id } })} className="button-primary button-small mt-4">Review upgrade</button>
          </article>)}</div>}
        </section>

        <section aria-labelledby="membership-downgrades-title" className="panel-responsive">
          <h2 id="membership-downgrades-title" className="membership-section-heading">Downgrade your membership</h2>
          <p className="text-intro">Choose a cheaper tier for your next renewal. Keep your current membership until the end of its paid period. Scheduling a downgrade does not open checkout or charge you now.</p>
          {tiersLoading ? <p role="status" className="text-pending">Loading membership tiers…</p> : tiersError ? <p role="alert" className="text-error mt-4">{tiersError}</p> : cancellingAtEnd ? <p className="text-pending">Choose “Keep my membership” before scheduling a downgrade.</p> : !canScheduleDowngrade ? <p className="text-pending">An active paid period is required to schedule a downgrade.</p> : !downgrades.length ? <p className="text-pending">You already have the lowest available membership tier.</p> : <div className="content-stack mt-4">{downgrades.map(tier => <article key={tier._id} className="detail-card"><div className="membership-tier-summary"><h3 className="text-sm font-bold">{tier.name}</h3><p className="text-sm font-semibold">{Number(tier.price) > 0 ? `${money(tier.price)} / ${yearly(tier) ? 'year' : 'month'}` : 'Free membership'}</p></div>{!!tier.description && <p className="membership-tier-description">{tier.description}</p>}<button type="button" aria-label={`Downgrade to ${tier.name}`} disabled={busy || membership.scheduledTierId === tier._id} onClick={() => { setActionError(''); updateQuery({ membershipAction: 'downgrade', downgradeTier: tier._id }); }} className="button-small membership-downgrade-button">{membership.scheduledTierId === tier._id ? 'Scheduled for next renewal' : 'Schedule downgrade'}</button></article>)}</div>}
        </section>

        <section aria-labelledby="membership-subscription-title" className="panel-responsive">
          <h2 id="membership-subscription-title" className="membership-section-heading">Subscription options</h2>
          <p className="text-intro">Payments use the organisation's simulated payment gateway. No real charges or automatic debits are made.</p>
          {actionError && !actionOpen && <p role="alert" className="text-error mt-3">{actionError}</p>}
          {cancellingAtEnd ? <button type="button" disabled={busy} onClick={() => changeCancellation(false)} className="button-secondary mt-4 membership-secondary-action">{busy ? 'Saving…' : 'Keep my membership'}</button> : canCancel ? <button type="button" disabled={busy} onClick={() => { setActionError(''); updateQuery({ membershipAction: 'cancel' }); }} className="button-standard membership-cancel-button">Cancel subscription</button> : <p className="text-pending">There is no active subscription to cancel.</p>}
        </section>
      </div>
    </div>

    {cancelOpen && <div className="dialog-overlay-dark"><div ref={cancelDialog} role="dialog" aria-modal="true" aria-labelledby="cancel-membership-title" aria-describedby="cancel-membership-description" className="dialog-panel shadow-xl">
      <h2 id="cancel-membership-title" className="text-lg font-bold">Cancel membership subscription</h2>
      <p id="cancel-membership-description" className="text-description mt-3 leading-relaxed">{paidPeriod ? `Your subscription will end on ${dateLabel(membership.expirationDate)}. You can keep using your membership card and member benefits until then. Cancelling does not issue a refund, and you can keep your membership before that date.` : 'Your membership card and member access will end immediately. You can join the organisation again later.'}</p>
      {hasScheduledDowngrade && <p className="membership-cancel-note">Cancelling your subscription also removes the scheduled downgrade.</p>}
      {actionError && <p role="alert" className="text-error mt-3">{actionError}</p>}
      <div className="dialog-actions"><button ref={cancelBackButton} type="button" disabled={busy} onClick={() => closeQuery('membershipAction')} className="button-secondary membership-secondary-action">Go back</button><button type="button" disabled={busy} onClick={() => changeCancellation(true)} className="button-danger button-standard disabled:opacity-50">{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
    </div></div>}
    {downgradeOpen && <div className="dialog-overlay-dark"><div ref={cancelDialog} role="dialog" aria-modal="true" aria-labelledby="downgrade-membership-title" aria-describedby="downgrade-membership-description" className="dialog-panel shadow-xl">
      <h2 id="downgrade-membership-title" className="text-lg font-bold">Schedule membership downgrade</h2>
      <p id="downgrade-membership-description" className="text-description mt-3 leading-relaxed">{downgradeTier && canScheduleDowngrade ? `Keep ${currentTier?.name || 'your current tier'} and its benefits until ${dateLabel(membership.expirationDate)}. Your next membership will be ${downgradeTier.name} (${Number(downgradeTier.price) > 0 ? `${money(downgradeTier.price)} / ${yearly(downgradeTier) ? 'year' : 'month'}` : 'free'}). ${Number(downgradeTier.price) > 0 ? 'No charge is made now. When the current period ends, complete a simulated renewal payment to start the cheaper membership.' : 'The free membership begins when your paid period ends, without checkout.'} ${hasScheduledDowngrade ? 'This replaces your previously scheduled downgrade.' : 'You can cancel this scheduled change before renewing.'}` : 'This tier is unavailable for a scheduled downgrade. Close this dialog and review the available membership tiers.'}</p>
      {actionError && <p role="alert" className="text-error mt-3">{actionError}</p>}
      <div className="dialog-actions"><button ref={cancelBackButton} type="button" disabled={busy} onClick={closeAction} className="button-secondary membership-secondary-action">Go back</button>{downgradeTier && canScheduleDowngrade && <button type="button" disabled={busy} onClick={() => changeDowngrade(downgradeTier._id)} className="button-accent button-standard disabled:opacity-50">{busy ? 'Scheduling…' : 'Confirm downgrade'}</button>}</div>
    </div></div>}
  </div>;
}

export function CheckoutPage({ onNavigate }) {
  const { tiers, tiersLoading, tiersError } = useMembershipTiers();
  const { user } = useAuth();
  const { route } = useNavigation();
  const pending = user.membershipStatus === 'pending';
  const sessionId = route.query.get('session_id');
  const intent = pending ? 'join' : route.query.get('intent') || (sessionId ? 'join' : null);
  const requestedTierId = intent === 'join' ? user.tierId : route.query.get('tier');
  const explicitCheckout = pending || !!sessionId || (['upgrade', 'renew'].includes(intent) && !!requestedTierId);
  const joining = intent === 'join';

  useEffect(() => {
    if (!explicitCheckout) onNavigate('member-membership', { replace: true });
  }, [explicitCheckout, onNavigate]);

  if (!explicitCheckout) return <p role="status" className="text-sm text-slate-500">Opening your membership…</p>;

  return <div className="section-stack membership-checkout">
    <div><h1 className="heading-large">{joining ? 'Activate your membership' : intent === 'upgrade' ? 'Review membership upgrade' : 'Renew your membership'}</h1><p className="text-intro">{joining ? 'Complete your first demo payment to access your dashboard, events, and membership card.' : intent === 'upgrade' ? 'Review your unused membership credit and the amount due before confirming. Your upgrade starts a new billing period.' : 'Review your membership renewal before confirming a demo payment.'}</p></div>
    {tiersLoading ? <p role="status" className="text-description">Loading membership tiers…</p> : tiersError ? <p role="alert" className="text-error">{tiersError}</p> : <PaymentModal key={`${user.activeOrganisationId}:${requestedTierId}:${intent}`} standalone user={user} tiers={tiers} requestedTierId={requestedTierId} intent={intent} onContinue={() => onNavigate(joining ? 'member-dashboard' : 'member-membership')} />}
    <div className="membership-checkout-links">{joining ? <button type="button" onClick={() => onNavigate('account-memberships')} className="underline">Back to My Memberships</button> : <button type="button" onClick={() => onNavigate('member-membership')} className="underline">Back to Manage Membership</button>}</div>
  </div>;
}
