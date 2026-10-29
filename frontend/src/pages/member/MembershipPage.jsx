import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, CreditCard, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useNavigation } from '../../routing.jsx';
import GoogleWalletPass from '../../components/GoogleWalletPass.jsx';

const DAY_MS = 86_400_000;
const money = amount => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(amount) || 0);
const dateLabel = value => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not recorded';
const yearly = tier => ['yearly', 'year'].includes(tier?.interval);
const monthlyPrice = tier => (Number(tier?.price) || 0) / (yearly(tier) ? 12 : 1);

export default function MembershipPage({ onNavigate, tiers = [], tiersLoading, tiersError }) {
  const { user, refreshUser, getCurrentUser } = useAuth();
  const { showToast } = useToast();
  const { route, updateQuery, closeQuery } = useNavigation();
  const organisationId = user.activeOrganisationId;
  const [record, setRecord] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [wallet, setWallet] = useState(null);
  const [walletError, setWalletError] = useState('');
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
    let cancelled = false;
    setWallet(null);
    setWalletError('');
    if (active) api.getWalletPass().then(response => {
      if (!response.success) throw new Error(response.message || 'Your membership pass is unavailable.');
      if (!cancelled) setWallet(response);
    }).catch(error => { if (!cancelled) setWalletError(error.message || 'Could not load your membership pass.'); });
    return () => { cancelled = true; };
  }, [organisationId, active, revision]);

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

  const changeCancellation = async cancel => {
    if (busy) return;
    const canApply = () => mounted.current && getCurrentUser()?.activeOrganisationId === organisationId;
    setBusy(true);
    setActionError('');
    try {
      const response = await (cancel ? api.cancelMembership(organisationId) : api.resumeMembership(organisationId));
      if (!response.success) throw new Error(response.message || 'Could not update your membership.');
      if (!canApply()) return;
      if (response.membership) setRecord({ organisationId, membership: response.membership });
      await refreshUser();
      if (!canApply()) return;
      closeQuery('membershipAction');
      setRevision(value => value + 1);
      showToast(cancel ? 'Your membership cancellation has been saved.' : 'Your membership will remain active.', 'success');
    } catch (error) { if (canApply()) setActionError(error.message || 'Could not update your membership.'); }
    finally { if (canApply()) setBusy(false); }
  };

  const changeDowngrade = async tierId => {
    if (busy) return;
    const canApply = () => mounted.current && getCurrentUser()?.activeOrganisationId === organisationId;
    setBusy(true);
    setActionError('');
    try {
      const response = await (tierId ? api.scheduleMembershipDowngrade(organisationId, tierId) : api.cancelMembershipDowngrade(organisationId));
      if (!response.success) throw new Error(response.message || 'Could not update your scheduled membership change.');
      if (!canApply()) return;
      if (response.membership) setRecord({ organisationId, membership: response.membership });
      await refreshUser();
      if (!canApply()) return;
      closeQuery(['membershipAction', 'downgradeTier']);
      setRevision(value => value + 1);
      showToast(tierId ? 'Your downgrade is scheduled for the end of your current paid period.' : 'Your scheduled downgrade has been cancelled.', 'success');
    } catch (error) { if (canApply()) setActionError(error.message || 'Could not update your scheduled membership change.'); }
    finally { if (canApply()) setBusy(false); }
  };

  if (loading) return <div role="status" className="flex min-h-72 items-center justify-center gap-3 text-sm text-slate-600"><RefreshCw className="h-5 w-5 animate-spin" />Loading your membership…</div>;
  if (loadError) return <div className="space-y-3"><h1 className="text-2xl font-bold">Manage Membership</h1><p role="alert" className="text-sm text-red-700">{loadError}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="text-sm font-semibold underline">Retry</button></div>;

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

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Manage Membership</h1><p className="mt-2 text-sm text-slate-600">Your membership details, digital pass and subscription options in one place.</p></div>

    <section aria-labelledby="membership-overview-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="membership-overview-title" className="text-lg font-bold">Membership overview</h2><p className="mt-1 text-sm text-slate-600">{membership.organisation?.name || user.activeOrganisation?.name}</p></div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-brand-primary bg-brand-50 text-brand-ink' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{statusLabel}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div><p className="text-xs font-semibold text-slate-500">Current membership</p><h3 className="mt-1 text-xl font-bold">{currentTier?.name || membership.tierName || 'Membership'}</h3><p className="mt-1 text-xs text-slate-600">Member ID: <span className="font-mono">{membership.membershipNumber || user.membershipNumber}</span></p><p className="mt-1 text-xs text-slate-600">Member since: {dateLabel(membership.joinedDate)}</p></div>
        <p className="font-semibold text-slate-900">{Number(currentTier?.price) > 0 ? <>{money(currentTier.price)} <span className="text-sm font-normal text-slate-500">/ {yearly(currentTier) ? 'year' : 'month'}</span></> : 'Free membership'}</p>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CalendarDays className="h-3.5 w-3.5" />First subscribed</dt><dd className="mt-1.5 text-sm font-semibold">{dateLabel(firstSubscribedAt)}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CalendarDays className="h-3.5 w-3.5" />Current period started</dt><dd className="mt-1.5 text-sm font-semibold">{periodStart ? dateLabel(periodStart) : 'Not recorded'}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{cancellingAtEnd ? 'Access ends' : 'Renewal date'}</dt><dd className="mt-1.5 text-sm font-semibold">{membership.expirationDate ? dateLabel(membership.expirationDate) : 'No renewal required'}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" />Days remaining</dt><dd className="mt-1.5 text-sm font-semibold">{daysRemaining === null ? 'No expiry' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}</dd></div>
      </dl>
      {Number(membership.creditBalanceCents) > 0 && <p className="mt-4 text-sm text-slate-600">Membership credit: <strong>{money(membership.creditBalanceCents / 100)}</strong>. Available credit is applied to your next membership payment.</p>}
      {cancellingAtEnd && <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Your subscription is cancelled for renewal. Your digital pass and member access remain available until {dateLabel(membership.expirationDate)}.</p>}
      {hasScheduledDowngrade && <div role="status" aria-label="Scheduled membership downgrade" className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <h3 className="font-bold">{scheduledUnavailable ? 'Scheduled tier unavailable' : 'Downgrade scheduled'}</h3>
        {scheduledUnavailable ? <p className="mt-2">The membership tier selected for your next renewal is no longer available. Cancel this scheduled change to renew your current tier or choose another available tier.</p> : <><p className="mt-2">Next membership: <strong>{scheduledTier.name}</strong> — {Number(scheduledTier.price) > 0 ? `${money(scheduledTier.price)} / ${yearly(scheduledTier) ? 'year' : 'month'}` : 'Free membership'}.</p><p className="mt-2">{scheduledDue ? `Your previous paid period ended on ${dateLabel(membership.scheduledTierEffectiveAt)}. Renew with ${scheduledTier.name} to start your next billing period.` : `Your current membership and pass stay unchanged until ${dateLabel(membership.scheduledTierEffectiveAt)}. ${Number(scheduledTier.price) > 0 ? 'No payment is taken now. Complete payment for the cheaper tier when your current period ends.' : 'Your free membership will begin after your current paid period ends, with no payment required.'}`}</p></>}
        <button type="button" disabled={busy} onClick={() => changeDowngrade(null)} className="mt-3 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Cancel scheduled downgrade</button>
      </div>}
      {!active && <p className="mt-5 text-sm text-slate-600">Your digital pass and member features are available with an active membership.</p>}
      {canRenew && <button type="button" onClick={() => onNavigate('member-checkout', { query: { intent: 'renew', tier: renewalTier?._id || membership.tierId } })} className="mt-4 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-ink">{hasScheduledDowngrade ? `Renew with ${renewalTier.name}` : 'Renew membership'}</button>}
      {status === 'cancelled' && Number(currentTier?.price) === 0 && <button type="button" onClick={() => onNavigate('account-memberships')} className="mt-4 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-ink">Rejoin membership</button>}
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section aria-labelledby="membership-pass-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 id="membership-pass-title" className="flex items-center gap-2 text-base font-bold"><Wallet className="h-4 w-4 text-brand-ink" />Digital membership pass</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">Keep your membership details with you in Google Wallet.</p>
        {active ? wallet ? <GoogleWalletPass user={{ ...user, ...membership, status: 'active', tierName: currentTier?.name || membership.tierName }} walletData={wallet} onSync={async () => {
          await api.syncWalletObject(user._id);
          const response = await api.getWalletPass();
          if (mounted.current && getCurrentUser()?.activeOrganisationId === organisationId) setWallet(response);
        }} /> : <p role={walletError ? 'alert' : 'status'} className="text-sm text-slate-600">{walletError || 'Loading your membership pass…'}</p> : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500"><ShieldCheck className="mx-auto mb-2 h-6 w-6" />Your pass will be available when your membership is active.</div>}
      </section>

      <div className="space-y-6">
        <section aria-labelledby="membership-upgrades-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 id="membership-upgrades-title" className="flex items-center gap-2 text-base font-bold"><CreditCard className="h-4 w-4 text-brand-ink" />Upgrade your membership</h2>
          <p className="mt-2 text-sm text-slate-600">An upgrade starts a new billing period. The unused value of your current paid period is credited towards the new tier. Review the exact credit and total before you pay.</p>
          {hasScheduledDowngrade && <p className="mt-3 text-sm text-blue-900">Completing an upgrade will replace your scheduled downgrade.</p>}
          {tiersLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading membership tiers…</p> : tiersError ? <p role="alert" className="mt-4 text-sm text-red-700">{tiersError}</p> : !active ? <p className="mt-4 text-sm text-slate-500">An active membership is required to upgrade.</p> : !upgrades.length ? <p className="mt-4 text-sm text-slate-500">You already have the highest available membership tier.</p> : <div className="mt-4 space-y-3">{upgrades.map(tier => <article key={tier._id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-bold">{tier.name}</h3><p className="text-sm font-semibold">{money(tier.price)} <span className="text-xs font-normal text-slate-500">/ {yearly(tier) ? 'year' : 'month'}</span></p></div>
            {!!tier.description && <p className="mt-2 text-xs text-slate-600">{tier.description}</p>}
            {!!tier.perks?.length && <ul className="mt-3 space-y-1.5">{tier.perks.map((perk, index) => <li key={index} className="flex items-start gap-2 text-xs text-slate-600"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-ink" />{perk}</li>)}</ul>}
            <button type="button" aria-label={`Upgrade to ${tier.name}`} onClick={() => onNavigate('member-checkout', { query: { intent: 'upgrade', tier: tier._id } })} className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-brand-ink hover:bg-brand-secondary">Review upgrade</button>
          </article>)}</div>}
        </section>

        <section aria-labelledby="membership-downgrades-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 id="membership-downgrades-title" className="text-base font-bold">Downgrade your membership</h2>
          <p className="mt-2 text-sm text-slate-600">Choose a cheaper tier for your next renewal. Keep your current membership until the end of its paid period. Scheduling a downgrade does not open checkout or charge you now.</p>
          {tiersLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading membership tiers…</p> : tiersError ? <p role="alert" className="mt-4 text-sm text-red-700">{tiersError}</p> : cancellingAtEnd ? <p className="mt-4 text-sm text-slate-500">Choose “Keep my membership” before scheduling a downgrade.</p> : !canScheduleDowngrade ? <p className="mt-4 text-sm text-slate-500">An active paid period is required to schedule a downgrade.</p> : !downgrades.length ? <p className="mt-4 text-sm text-slate-500">You already have the lowest available membership tier.</p> : <div className="mt-4 space-y-3">{downgrades.map(tier => <article key={tier._id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-bold">{tier.name}</h3><p className="text-sm font-semibold">{Number(tier.price) > 0 ? `${money(tier.price)} / ${yearly(tier) ? 'year' : 'month'}` : 'Free membership'}</p></div>{!!tier.description && <p className="mt-2 text-xs text-slate-600">{tier.description}</p>}<button type="button" aria-label={`Downgrade to ${tier.name}`} disabled={busy || membership.scheduledTierId === tier._id} onClick={() => { setActionError(''); updateQuery({ membershipAction: 'downgrade', downgradeTier: tier._id }); }} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">{membership.scheduledTierId === tier._id ? 'Scheduled for next renewal' : 'Schedule downgrade'}</button></article>)}</div>}
        </section>

        <section aria-labelledby="membership-subscription-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 id="membership-subscription-title" className="text-base font-bold">Subscription options</h2>
          <p className="mt-2 text-sm text-slate-600">Payments use the organisation's simulated payment gateway. No real charges or automatic debits are made.</p>
          {actionError && !actionOpen && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
          {cancellingAtEnd ? <button type="button" disabled={busy} onClick={() => changeCancellation(false)} className="mt-4 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Keep my membership'}</button> : canCancel ? <button type="button" disabled={busy} onClick={() => { setActionError(''); updateQuery({ membershipAction: 'cancel' }); }} className="mt-4 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Cancel subscription</button> : <p className="mt-4 text-sm text-slate-500">There is no active subscription to cancel.</p>}
        </section>
      </div>
    </div>

    {cancelOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div ref={cancelDialog} role="dialog" aria-modal="true" aria-labelledby="cancel-membership-title" aria-describedby="cancel-membership-description" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
      <h2 id="cancel-membership-title" className="text-lg font-bold">Cancel membership subscription</h2>
      <p id="cancel-membership-description" className="mt-3 text-sm leading-relaxed text-slate-600">{paidPeriod ? `Your subscription will end on ${dateLabel(membership.expirationDate)}. You can keep using your membership and digital pass until then. Cancelling does not issue a refund, and you can keep your membership before that date.` : 'Your membership and digital pass access will end immediately. You can join the organisation again later.'}</p>
      {hasScheduledDowngrade && <p className="mt-3 text-sm text-amber-900">Cancelling your subscription also removes the scheduled downgrade.</p>}
      {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button ref={cancelBackButton} type="button" disabled={busy} onClick={() => closeQuery('membershipAction')} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Go back</button><button type="button" disabled={busy} onClick={() => changeCancellation(true)} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
    </div></div>}
    {downgradeOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div ref={cancelDialog} role="dialog" aria-modal="true" aria-labelledby="downgrade-membership-title" aria-describedby="downgrade-membership-description" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
      <h2 id="downgrade-membership-title" className="text-lg font-bold">Schedule membership downgrade</h2>
      <p id="downgrade-membership-description" className="mt-3 text-sm leading-relaxed text-slate-600">{downgradeTier && canScheduleDowngrade ? `Keep ${currentTier?.name || 'your current tier'} and its benefits until ${dateLabel(membership.expirationDate)}. Your next membership will be ${downgradeTier.name} (${Number(downgradeTier.price) > 0 ? `${money(downgradeTier.price)} / ${yearly(downgradeTier) ? 'year' : 'month'}` : 'free'}). ${Number(downgradeTier.price) > 0 ? 'No charge is made now. When the current period ends, complete a simulated renewal payment to start the cheaper membership.' : 'The free membership begins when your paid period ends, without checkout.'} ${hasScheduledDowngrade ? 'This replaces your previously scheduled downgrade.' : 'You can cancel this scheduled change before renewing.'}` : 'This tier is unavailable for a scheduled downgrade. Close this dialog and review the available membership tiers.'}</p>
      {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button ref={cancelBackButton} type="button" disabled={busy} onClick={closeAction} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Go back</button>{downgradeTier && canScheduleDowngrade && <button type="button" disabled={busy} onClick={() => changeDowngrade(downgradeTier._id)} className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-ink disabled:opacity-50">{busy ? 'Scheduling…' : 'Confirm downgrade'}</button>}</div>
    </div></div>}
  </div>;
}
