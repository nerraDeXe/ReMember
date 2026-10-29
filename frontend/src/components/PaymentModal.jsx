import React, { useEffect, useRef, useState } from 'react';
import { X, CreditCard, ShieldCheck, RefreshCw, Building2, Smartphone, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Receipt } from 'lucide-react';
import { api } from '../api.js';
import { useNavigation } from '../routing.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const METHODS = [
  { id: 'card', label: 'Card', detail: 'Demo debit / credit card', icon: CreditCard },
  { id: 'online_banking', label: 'Online banking', detail: 'Demo bank transfer', icon: Building2 },
  { id: 'ewallet', label: 'eWallet', detail: 'Demo wallet payment', icon: Smartphone },
];
const money = cents => `MYR ${(Number(cents || 0) / 100).toFixed(2)}`;
const checkoutId = checkout => checkout?.id || checkout?._id || checkout?.sessionId;
const isPaid = result => result?.paymentStatus === 'paid' || result?.state === 'paid';
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function PaymentBreakdown({ quote }) {
  if (!quote) return null;
  return <div aria-label="Payment breakdown" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
    <div className="flex justify-between gap-3"><span>New membership period</span><strong>{money(quote.subtotalCents ?? quote.amountCents)}</strong></div>
    {quote.intent === 'upgrade' && <>
      <div className="flex justify-between gap-3"><span>Unused membership credit</span><strong>−{money(quote.creditCents)}</strong></div>
      {quote.remainingDays > 0 && <p className="text-xs text-slate-500">{quote.remainingDays} unused days credited from your paid membership.</p>}
      {quote.creditUnavailable && <p className="text-xs text-slate-500">No unused paid time could be verified for your current membership.</p>}
    </>}
    {quote.intent !== 'upgrade' && quote.creditCents > 0 && <div className="flex justify-between gap-3"><span>Membership credit</span><strong>−{money(quote.creditCents)}</strong></div>}
    <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span>Due today</span><strong>{money(quote.amountCents)}</strong></div>
    {quote.carryForwardCents > 0 && <p className="text-xs text-slate-600">{money(quote.carryForwardCents)} credit remains for a future membership payment.</p>}
    {quote.periodEnd && <p className="text-xs text-slate-600">{quote.intent === 'upgrade' ? 'New renewal date' : 'Membership valid until'}: <strong>{dateLabel(quote.periodEnd)}</strong></p>}
    {quote.intent === 'upgrade' && <p className="text-xs text-slate-500">Your upgrade starts a new billing period. Your current access stays available until the upgrade is confirmed.</p>}
    {quote.scheduledDowngrade && <p className="text-xs text-slate-500">This renewal starts your scheduled lower tier after your previous paid period has ended.</p>}
  </div>;
}

export default function PaymentModal({ isOpen = true, onClose, user, tiers = [], standalone = false, onContinue, requestedTierId, intent }) {
  const { route, getSnapshot, updateQuery } = useNavigation();
  const { refreshUser } = useAuth();
  const refreshRef = useRef(refreshUser);
  const loadedSessionRef = useRef(null);
  useEffect(() => { refreshRef.current = refreshUser; }, [refreshUser]);
  const sessionId = route.query.get('session_id');
  const [selectedTierId, setSelectedTierId] = useState(requestedTierId || user?.tierId || tiers[0]?._id || '');
  const [paymentMethod, setPaymentMethod] = useState(route.query.get('payment_method') || 'card');
  const [checkout, setCheckout] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');
  const [scenario, setScenario] = useState('approved');
  const [sampleAccount, setSampleAccount] = useState(route.query.get('payment_method') === 'ewallet' ? 'Demo Wallet' : 'Demo Bank');
  const [membershipReady, setMembershipReady] = useState(user?.membershipStatus === 'active');
  const organisationId = user.activeOrganisationId;
  const requestedStep = route.query.get('payment_step');
  const paid = !!sessionId && isPaid(checkout);
  const terminal = !!sessionId && checkout && ['expired', 'cancelled', 'failed'].includes(checkout.state);
  const authorize = !!sessionId && !!checkout && !paid && !terminal && requestedStep !== 'details';
  const currentTier = tiers.find(tier => tier._id === selectedTierId);
  const hasCurrentTier = Boolean(currentTier);
  const pending = user.membershipStatus === 'pending';
  const paymentIntent = pending ? 'join' : intent || 'renew';
  const availableTiers = tiers.filter(tier => tier._id === (paymentIntent === 'join' ? user.tierId : requestedTierId || user.tierId));
  const free = currentTier && Number(currentTier.price) === 0;
  const amountCents = (sessionId ? checkout?.amountCents : quote?.amountCents) ?? 0;
  const method = METHODS.find(item => item.id === paymentMethod) || METHODS[0];
  const MethodIcon = method.icon;
  const busy = processing || loading;

  useEffect(() => {
    if (!isOpen || sessionId || !hasCurrentTier || free) { setQuoteLoading(false); return; }
    let canceled = false;
    setQuote(null); setQuoteLoading(true); setQuoteError('');
    api.getPaymentQuote(selectedTierId, organisationId, paymentIntent).then(result => {
      if (!result.success || !result.quote) throw new Error(result.message || 'Could not calculate your payment.');
      if (!canceled) setQuote(result.quote);
    }).catch(err => { if (!canceled) setQuoteError(err.message); })
      .finally(() => { if (!canceled) setQuoteLoading(false); });
    return () => { canceled = true; };
  }, [selectedTierId, organisationId, paymentIntent, isOpen, sessionId, free, hasCurrentTier, quoteRevision]);

  useEffect(() => {
    if (!isOpen || !sessionId) { setLoading(false); return; }
    let canceled = false;
    setLoading(loadedSessionRef.current !== sessionId); setError('');
    api.getPaymentCheckout(sessionId, organisationId).then(async result => {
      if (canceled) return;
      const received = { ...result.checkout, paymentStatus: result.paymentStatus || result.checkout?.paymentStatus };
      loadedSessionRef.current = sessionId;
      setCheckout(received);
      setInvoice(result.invoice || null);
      if (received.tierId) setSelectedTierId(received.tierId);
      if (received.paymentMethod) setPaymentMethod(received.paymentMethod);
      if (isPaid(received)) {
        try { const account = await refreshRef.current(); if (!canceled) setMembershipReady(account.activeOrganisationId === organisationId && account.membershipStatus === 'active'); }
        catch (err) { if (!canceled) setError(`Payment is confirmed. ${err.message}`); }
      }
    }).catch(err => { if (!canceled) { setCheckout(null); setError(err.message || 'Could not load this checkout.'); } })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [sessionId, organisationId, isOpen]);

  if (!isOpen) return null;

  const isCurrent = submittedRoute => getSnapshot() === submittedRoute;
  async function startCheckout(event) {
    event.preventDefault();
    const submittedRoute = getSnapshot();
    setProcessing(true); setError(''); setNotice('');
    try {
      const response = await api.createPaymentCheckout(selectedTierId, organisationId, paymentIntent);
      if (!isCurrent(submittedRoute)) return;
      const session = response.checkout;
      const id = checkoutId(session) || response.sessionId;
      if (!id) throw new Error('The payment gateway did not return a checkout reference. Please try again.');
      loadedSessionRef.current = id;
      setCheckout({ ...session, paymentStatus: response.paymentStatus || session?.paymentStatus });
      setVerificationCode('');
      updateQuery({ session_id: id, payment_step: 'authorize', payment_method: paymentMethod, canceled: null });
    } catch (err) { if (isCurrent(submittedRoute)) setError(err.message || 'Could not start checkout. Please try again.'); }
    finally { setProcessing(false); }
  }

  async function confirm(event) {
    event.preventDefault();
    const submittedRoute = getSnapshot();
    setProcessing(true); setError(''); setNotice('');
    try {
      const [response] = await Promise.all([
        api.confirmPayment(sessionId, organisationId, { paymentMethod, scenario: amountCents === 0 ? 'approved' : scenario, verificationCode: amountCents === 0 ? '123456' : verificationCode }),
        new Promise(resolve => setTimeout(resolve, 900)),
      ]);
      const received = { ...response.checkout, paymentStatus: response.paymentStatus || response.checkout?.paymentStatus };
      let account;
      let refreshError;
      if (isPaid(received)) {
        try { account = await refreshRef.current(); }
        catch (err) { refreshError = err; }
      }
      // Refresh a confirmed membership even if the member went Back while the
      // request was running; only the current checkout may change the page.
      if (!isCurrent(submittedRoute)) return;
      setCheckout(received); setInvoice(response.invoice || null);
      if (isPaid(received)) {
        updateQuery({ payment_step: 'receipt' }, { replace: true });
        setMembershipReady(account?.activeOrganisationId === organisationId && account?.membershipStatus === 'active');
        if (refreshError) setError(`Payment is confirmed. ${refreshError.message}`);
      } else { setError(response.message || 'This demo payment was declined. Start a new checkout to try again.'); setVerificationCode(''); }
    } catch (err) { if (isCurrent(submittedRoute)) setError(err.message || 'Payment could not be confirmed. You can try again.'); }
    finally { setProcessing(false); }
  }

  async function cancel() {
    const submittedRoute = getSnapshot();
    setProcessing(true); setError('');
    try {
      const response = await api.cancelPayment(sessionId, organisationId);
      if (!isCurrent(submittedRoute)) return;
      if (isPaid(response) || isPaid(response.checkout)) { setCheckout({ ...response.checkout, paymentStatus: 'paid' }); return; }
      setCheckout(null); setVerificationCode('');
      setNotice('Checkout was canceled. No payment was made. You can start again below.');
      updateQuery({ session_id: null, payment_step: null, payment_method: null, canceled: null });
    } catch (err) { if (isCurrent(submittedRoute)) setError(err.message || 'Could not cancel checkout. Please try again.'); }
    finally { setProcessing(false); }
  }

  function newCheckout() {
    setCheckout(null); setInvoice(null); setError(''); setNotice(''); setVerificationCode('');
    updateQuery({ session_id: null, payment_step: null, payment_method: null, canceled: null });
  }

  const content = <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
    <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-brand-primary text-brand-ink"><CreditCard className="w-5 h-5" aria-hidden="true" /></div><div><h2 className="text-base font-bold text-slate-900">Membership Checkout</h2><p className="text-xs text-slate-500 mt-1">{user.activeOrganisation?.name}</p></div></div>
      {!standalone && <button type="button" onClick={onClose} disabled={busy} aria-label="Close checkout" className="p-2 text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>}
    </div>
    <div className="px-5 sm:px-6 py-3 border-b border-amber-200 bg-amber-50 flex items-center gap-2 text-xs font-semibold text-amber-950"><ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />Demo payments · No money is charged</div>
    <div className="px-5 sm:px-6 pt-5 flex items-center gap-2 text-xs text-slate-400" aria-label="Checkout progress">{['Payment details', 'Authorization', 'Receipt'].map((label, index) => <React.Fragment key={label}>{index > 0 && <span className="flex-1 h-px bg-slate-200" aria-hidden="true" />}<span className={`flex items-center gap-1.5 ${(paid ? 2 : authorize ? 1 : 0) >= index ? 'text-slate-900 font-semibold' : ''}`}><span className="w-5 h-5 border border-current rounded-full flex items-center justify-center shrink-0">{index + 1}</span>{label}</span></React.Fragment>)}</div>
    <div className="p-5 sm:p-6 space-y-5">
      {notice && <p role="status" className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">{notice}</p>}
      {error && <p role="alert" className="flex gap-2 text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 p-3"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
      {loading ? <div role="status" className="py-10 flex justify-center items-center gap-3 text-sm text-slate-600"><RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />Loading your checkout…</div> : paid ? <div className="space-y-5">
        <div className="text-center py-3"><CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" aria-hidden="true" /><h3 className="text-xl font-bold text-slate-900 mt-3">Payment successful</h3><p className="text-sm text-slate-500 mt-2">Your demo payment is confirmed. No money was charged.</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm"><div className="flex items-center gap-2 font-semibold"><Receipt className="w-4 h-4" aria-hidden="true" />Demo payment receipt</div><div className="flex justify-between gap-4"><span className="text-slate-500">Membership</span><span className="font-semibold">{checkout.tierName || currentTier?.name}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Paid with</span><span>{METHODS.find(item => item.id === checkout.paymentMethod)?.label || method.label} (demo)</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Reference</span><span className="font-mono text-xs break-all text-right">{invoice?.invoiceNumber || checkout.reference || checkoutId(checkout) || sessionId}</span></div>{(invoice?.periodEnd || checkout.periodEnd) && <div className="flex justify-between gap-4"><span className="text-slate-500">Valid until</span><span>{new Date(invoice?.periodEnd || checkout.periodEnd).toLocaleDateString()}</span></div>}<div className="border-t border-slate-200 pt-3 flex justify-between font-bold"><span>Total paid</span><span>{money(amountCents)}</span></div></div>
        <PaymentBreakdown quote={checkout} />
        {membershipReady ? <button type="button" onClick={onContinue || onClose} className="w-full py-3 flex items-center justify-center gap-2 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-sm">{checkout.intent && checkout.intent !== 'join' ? 'Back to membership' : 'Open member dashboard'}<ArrowRight className="w-4 h-4" aria-hidden="true" /></button> : <p className="text-sm text-slate-600">Payment is confirmed. Reload your account to update membership access, or contact the organisation if access remains restricted.</p>}
        <p className="text-xs text-center text-slate-500">Your receipt is also available in Invoices. Renewals are manual.</p>
      </div> : terminal ? <div className="space-y-4"><p className="text-sm text-slate-600">{checkout.state === 'failed' ? 'Payment was declined. Your membership access has not changed.' : `This checkout is ${checkout.state}.`} Start a new checkout to continue.</p><button type="button" onClick={newCheckout} className="text-sm font-semibold underline">Start a new checkout</button></div> : authorize ? <form onSubmit={confirm} className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">Paying {user.activeOrganisation?.name}</p><div className="flex items-end justify-between gap-4 mt-2"><p className="text-sm font-semibold">{checkout.tierName || currentTier?.name}</p><p className="text-xl font-bold">{money(amountCents)}</p></div></div>
        <PaymentBreakdown quote={checkout} />
        {amountCents > 0 ? <fieldset disabled={processing} className="space-y-4"><legend className="flex items-center gap-2 text-sm font-bold mb-3"><MethodIcon className="w-5 h-5" aria-hidden="true" />{method.label} authorization</legend>
          {paymentMethod === 'card' ? <div className="rounded-xl bg-slate-900 text-white p-5 space-y-5"><div className="flex justify-between text-xs text-slate-300"><span>DEMO CARD</span><CreditCard className="w-5 h-5" aria-hidden="true" /></div><p className="font-mono text-lg tracking-widest">•••• •••• •••• 4242</p><div className="flex justify-between text-xs"><span>DEMO MEMBER</span><span>12/30</span></div></div> : <label className="block text-sm font-semibold">{paymentMethod === 'online_banking' ? 'Select a demo bank' : 'Select a demo wallet'}<select value={sampleAccount} onChange={event => setSampleAccount(event.target.value)} className="w-full mt-2 border border-slate-300 rounded-lg bg-white p-3 text-sm font-normal">{(paymentMethod === 'online_banking' ? ['Demo Bank', 'Community Bank (demo)', 'Member Bank (demo)'] : ['Demo Wallet', 'Community Wallet (demo)']).map(label => <option key={label}>{label}</option>)}</select></label>}
          <p className="text-sm text-slate-600">Approve this demo transaction using the sample verification code. No card details, bank login, or real OTP is needed.</p>
          <label className="block text-sm font-semibold" htmlFor="payment-verification">Demo verification code<span className="block mt-1 text-xs font-normal text-slate-500">Enter <strong className="font-mono">123456</strong> to authorize this simulation.</span></label><input id="payment-verification" autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ''))} placeholder="123456" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center tracking-[0.5em] font-mono text-lg" />
          <label className="block text-xs text-slate-500">Demo outcome<select value={scenario} onChange={event => setScenario(event.target.value)} className="block w-full mt-2 rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 bg-white"><option value="approved">Approved — complete payment</option><option value="declined">Declined — try the failure flow</option></select></label>
        </fieldset> : <p className="text-sm text-slate-600">Your credit covers this membership period. Confirm to apply the change with no payment due.</p>}
        <button type="submit" disabled={processing || (amountCents > 0 && verificationCode.length !== 6)} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-brand-primary hover:bg-brand-secondary font-bold text-sm text-brand-ink disabled:opacity-60">{processing ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}{processing ? 'Confirming…' : amountCents === 0 ? 'Confirm membership change' : `Authorize ${money(amountCents)}`}</button>
        <div className="flex justify-between gap-4 text-sm"><button type="button" disabled={processing} onClick={() => { setError(''); updateQuery({ payment_step: 'details' }); }} className="font-semibold underline flex items-center gap-1"><ArrowLeft className="w-3 h-3" aria-hidden="true" />Change payment details</button><button type="button" disabled={processing} onClick={cancel} className="text-slate-500 underline">Cancel checkout</button></div>
      </form> : <form onSubmit={startCheckout} className="space-y-5">
        <fieldset disabled={busy} className="space-y-3"><legend className="text-sm font-bold mb-3">{pending ? 'Your membership' : 'Choose a membership'}</legend>{availableTiers.map(tier => <label key={tier._id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedTierId === tier._id ? 'bg-brand-50 border-brand-primary' : 'border-slate-200'}`}><input type="radio" name="checkout-tier" value={tier._id} checked={selectedTierId === tier._id} onChange={() => setSelectedTierId(tier._id)} className="accent-brand-primary" /><span className="flex-1 text-sm font-semibold">{tier.name}</span><span className="text-sm font-bold">{Number(tier.price) === 0 ? 'Free' : `MYR ${Number(tier.price).toFixed(2)}`}<span className="block text-right text-xs font-normal text-slate-500">{Number(tier.price) > 0 ? `/${tier.interval === 'monthly' ? 'month' : 'year'}` : ''}</span></span></label>)}{!availableTiers.length && <p className="text-sm text-slate-600">Your membership tier is unavailable. Contact this organisation.</p>}</fieldset>
        {quoteLoading ? <p role="status" className="text-sm text-slate-600">Calculating your payment…</p> : quoteError ? <div role="alert" className="text-sm text-red-700"><p>{quoteError}</p><button type="button" onClick={() => setQuoteRevision(value => value + 1)} className="mt-2 font-semibold underline">Retry payment calculation</button></div> : <PaymentBreakdown quote={quote} />}
        {!free && amountCents > 0 && <fieldset disabled={busy} className="space-y-2"><legend className="text-sm font-bold mb-3">Payment method</legend>{METHODS.map(({ id, label, detail, icon: Icon }) => <label key={id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${paymentMethod === id ? 'border-brand-primary bg-brand-50' : 'border-slate-200'}`}><input type="radio" name="payment-method" value={id} checked={selectedTierId && paymentMethod === id} onChange={() => { setPaymentMethod(id); setSampleAccount(id === 'ewallet' ? 'Demo Wallet' : 'Demo Bank'); }} className="accent-brand-primary" /><Icon className="w-5 h-5 text-slate-600" aria-hidden="true" /><span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-slate-500">{detail}</span></span></label>)}</fieldset>}
        <p className="text-xs leading-relaxed text-slate-500">{free ? 'This membership is free. No payment is needed.' : `One ${currentTier?.interval === 'yearly' ? 'year' : 'month'} of membership. No automatic deductions. Access begins after the server confirms your approved demo payment.`}</p>
        {!free && <button type="submit" disabled={busy || !currentTier || quoteLoading || !quote || Boolean(quoteError)} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-brand-primary hover:bg-brand-secondary font-bold text-sm text-brand-ink disabled:opacity-60">{processing ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="w-4 h-4" aria-hidden="true" />}{processing ? 'Preparing checkout…' : amountCents === 0 ? 'Review membership change' : 'Continue to payment'}</button>}
      </form>}
    </div>
  </div>;
  return standalone ? content : <div role="dialog" aria-modal="true" aria-label="Membership checkout" className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4"><div className="w-full max-w-xl">{content}</div></div>;
}
