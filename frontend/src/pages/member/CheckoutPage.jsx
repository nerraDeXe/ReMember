import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigation } from '../../routing.jsx';
import PaymentModal from '../../components/PaymentModal.jsx';

export default function CheckoutPage({ onNavigate, tiers, tiersLoading, tiersError }) {
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

  return <div className="mx-auto max-w-2xl space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">{joining ? 'Activate your membership' : intent === 'upgrade' ? 'Review membership upgrade' : 'Renew your membership'}</h1><p className="mt-2 text-sm text-slate-600">{joining ? 'Complete your first demo payment to access your dashboard, events, and membership pass.' : intent === 'upgrade' ? 'Review your unused membership credit and the amount due before confirming. Your upgrade starts a new billing period.' : 'Review your membership renewal before confirming a demo payment.'}</p></div>
    {tiersLoading ? <p role="status" className="text-sm text-slate-600">Loading membership tiers…</p> : tiersError ? <p role="alert" className="text-sm text-red-700">{tiersError}</p> : <PaymentModal key={`${user.activeOrganisationId}:${requestedTierId}:${intent}`} standalone user={user} tiers={tiers} requestedTierId={requestedTierId} intent={intent} onContinue={() => onNavigate(joining ? 'member-dashboard' : 'member-membership')} />}
    <div className="flex flex-wrap gap-4 text-sm font-semibold">{joining ? <button type="button" onClick={() => onNavigate('account-memberships')} className="underline">Back to My Memberships</button> : <button type="button" onClick={() => onNavigate('member-membership')} className="underline">Back to Manage Membership</button>}</div>
  </div>;
}
