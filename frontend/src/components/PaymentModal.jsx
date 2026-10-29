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
  return <div aria-label="Payment breakdown" className="checkout-breakdown">
    <div className="checkout-breakdown-item"><span>New membership period</span><strong>{money(quote.subtotalCents ?? quote.amountCents)}</strong></div>
    {quote.intent === 'upgrade' && <>
      <div className="checkout-breakdown-item"><span>Unused membership credit</span><strong>−{money(quote.creditCents)}</strong></div>
      {quote.remainingDays > 0 && <p className="text-caption">{quote.remainingDays} unused days credited from your paid membership.</p>}
      {quote.creditUnavailable && <p className="text-caption">No unused paid time could be verified for your current membership.</p>}
    </>}
    {quote.intent !== 'upgrade' && quote.creditCents > 0 && <div className="checkout-breakdown-item"><span>Membership credit</span><strong>−{money(quote.creditCents)}</strong></div>}
    <div className="checkout-breakdown-total"><span>Due today</span><strong>{money(quote.amountCents)}</strong></div>
    {quote.carryForwardCents > 0 && <p className="checkout-breakdown-note">{money(quote.carryForwardCents)} credit remains for a future membership payment.</p>}
    {quote.periodEnd && <p className="checkout-breakdown-note">{quote.intent === 'upgrade' ? 'New renewal date' : 'Membership valid until'}: <strong>{dateLabel(quote.periodEnd)}</strong></p>}
    {quote.intent === 'upgrade' && <p className="text-caption">Your upgrade starts a new billing period. Your current access stays available until the upgrade is confirmed.</p>}
    {quote.scheduledDowngrade && <p className="text-caption">This renewal starts your scheduled lower tier after your previous paid period has ended.</p>}
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

  const content = <div className="checkout-card">
    <div className="checkout-header">
      <div className="checkout-heading"><div className="checkout-icon"><CreditCard className="icon-medium" aria-hidden="true" /></div><div><h2 className="card-title">Membership Checkout</h2><p className="page-description">{user.activeOrganisation?.name}</p></div></div>
      {!standalone && <button type="button" onClick={onClose} disabled={busy} aria-label="Close checkout" className="checkout-close"><X className="icon-medium" /></button>}
    </div>
    <div className="checkout-demo-banner"><ShieldCheck className="checkout-demo-icon" aria-hidden="true" />Demo payments · No money is charged</div>
    <div className="checkout-progress" aria-label="Checkout progress">{['Payment details', 'Authorization', 'Receipt'].map((label, index) => <React.Fragment key={label}>{index > 0 && <span className="checkout-step-connector" aria-hidden="true" />}<span className={`checkout-step ${(paid ? 2 : authorize ? 1 : 0) >= index ? "checkout-step-active" : ''}`}><span className="checkout-step-number">{index + 1}</span>{label}</span></React.Fragment>)}</div>
    <div className="checkout-body">
      {notice && <p role="status" className="checkout-notice">{notice}</p>}
      {error && <p role="alert" className="checkout-error"><AlertCircle className="checkout-error-icon" aria-hidden="true" />{error}</p>}
      {loading ? <div role="status" className="checkout-loading"><RefreshCw className="checkout-loading-spinner" aria-hidden="true" />Loading your checkout…</div> : paid ? <div className="section-stack">
        <div className="checkout-success"><CheckCircle2 className="checkout-success-icon" aria-hidden="true" /><h3 className="checkout-success-title">Payment successful</h3><p className="checkout-success-message">Your demo payment is confirmed. No money was charged.</p></div>
        <div className="checkout-receipt"><div className="checkout-receipt-title"><Receipt className="icon-default" aria-hidden="true" />Demo payment receipt</div><div className="checkout-receipt-item"><span className="checkout-receipt-label">Membership</span><span className="checkout-receipt-value">{checkout.tierName || currentTier?.name}</span></div><div className="checkout-receipt-item"><span className="checkout-receipt-label">Paid with</span><span>{METHODS.find(item => item.id === checkout.paymentMethod)?.label || method.label} (demo)</span></div><div className="checkout-receipt-item"><span className="checkout-receipt-label">Reference</span><span className="checkout-reference">{invoice?.invoiceNumber || checkout.reference || checkoutId(checkout) || sessionId}</span></div>{(invoice?.periodEnd || checkout.periodEnd) && <div className="checkout-receipt-item"><span className="checkout-receipt-label">Valid until</span><span>{new Date(invoice?.periodEnd || checkout.periodEnd).toLocaleDateString()}</span></div>}<div className="checkout-receipt-total"><span>Total paid</span><span>{money(amountCents)}</span></div></div>
        <PaymentBreakdown quote={checkout} />
        {membershipReady ? <button type="button" onClick={onContinue || onClose} className="checkout-continue">{checkout.intent && checkout.intent !== 'join' ? 'Back to membership' : 'Open member dashboard'}<ArrowRight className="icon-default" aria-hidden="true" /></button> : <p className="text-description">Payment is confirmed. Reload your account to update membership access, or contact the organisation if access remains restricted.</p>}
        <p className="checkout-receipt-note">Your receipt is also available in Invoices. Renewals are manual.</p>
      </div> : terminal ? <div className="form-stack"><p className="text-description">{checkout.state === 'failed' ? 'Payment was declined. Your membership access has not changed.' : `This checkout is ${checkout.state}.`} Start a new checkout to continue.</p><button type="button" onClick={newCheckout} className="checkout-restart">Start a new checkout</button></div> : authorize ? <form onSubmit={confirm} className="section-stack">
        <div className="checkout-order-summary"><p className="text-caption">Paying {user.activeOrganisation?.name}</p><div className="checkout-order-details"><p className="checkout-order-tier">{checkout.tierName || currentTier?.name}</p><p className="checkout-order-amount">{money(amountCents)}</p></div></div>
        <PaymentBreakdown quote={checkout} />
        {amountCents > 0 ? <fieldset disabled={processing} className="form-stack"><legend className="checkout-authorization-heading"><MethodIcon className="icon-medium" aria-hidden="true" />{method.label} authorization</legend>
          {paymentMethod === 'card' ? <div className="checkout-demo-card"><div className="checkout-demo-card-header"><span>DEMO CARD</span><CreditCard className="icon-medium" aria-hidden="true" /></div><p className="checkout-demo-card-number">•••• •••• •••• 4242</p><div className="checkout-demo-card-details"><span>DEMO MEMBER</span><span>12/30</span></div></div> : <label className="checkout-field-label">{paymentMethod === 'online_banking' ? 'Select a demo bank' : 'Select a demo wallet'}<select value={sampleAccount} onChange={event => setSampleAccount(event.target.value)} className="checkout-account-select">{(paymentMethod === 'online_banking' ? ['Demo Bank', 'Community Bank (demo)', 'Member Bank (demo)'] : ['Demo Wallet', 'Community Wallet (demo)']).map(label => <option key={label}>{label}</option>)}</select></label>}
          <p className="text-description">Approve this demo transaction using the sample verification code. No card details, bank login, or real OTP is needed.</p>
          <label className="checkout-field-label" htmlFor="payment-verification">Demo verification code<span className="checkout-verification-hint">Enter <strong className="checkout-sample-code">123456</strong> to authorize this simulation.</span></label><input id="payment-verification" autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ''))} placeholder="123456" className="checkout-verification-input" />
          <label className="checkout-outcome-label">Demo outcome<select value={scenario} onChange={event => setScenario(event.target.value)} className="checkout-outcome-select"><option value="approved">Approved — complete payment</option><option value="declined">Declined — try the failure flow</option></select></label>
        </fieldset> : <p className="text-description">Your credit covers this membership period. Confirm to apply the change with no payment due.</p>}
        <button type="submit" disabled={processing || (amountCents > 0 && verificationCode.length !== 6)} className="checkout-submit">{processing ? <RefreshCw className="icon-spinner" aria-hidden="true" /> : <ShieldCheck className="icon-default" aria-hidden="true" />}{processing ? 'Confirming…' : amountCents === 0 ? 'Confirm membership change' : `Authorize ${money(amountCents)}`}</button>
        <div className="checkout-authorization-actions"><button type="button" disabled={processing} onClick={() => { setError(''); updateQuery({ payment_step: 'details' }); }} className="checkout-change-details"><ArrowLeft className="icon-tiny" aria-hidden="true" />Change payment details</button><button type="button" disabled={processing} onClick={cancel} className="checkout-cancel">Cancel checkout</button></div>
      </form> : <form onSubmit={startCheckout} className="section-stack">
        <fieldset disabled={busy} className="content-stack"><legend className="checkout-options-heading">{pending ? 'Your membership' : 'Choose a membership'}</legend>{availableTiers.map(tier => <label key={tier._id} className={`checkout-choice ${selectedTierId === tier._id ? "checkout-choice-selected" : "checkout-choice-idle"}`}><input type="radio" name="checkout-tier" value={tier._id} checked={selectedTierId === tier._id} onChange={() => setSelectedTierId(tier._id)} className="checkout-choice-radio" /><span className="checkout-tier-name">{tier.name}</span><span className="checkout-tier-price">{Number(tier.price) === 0 ? 'Free' : `MYR ${Number(tier.price).toFixed(2)}`}<span className="checkout-tier-interval">{Number(tier.price) > 0 ? `/${tier.interval === 'monthly' ? 'month' : 'year'}` : ''}</span></span></label>)}{!availableTiers.length && <p className="text-description">Your membership tier is unavailable. Contact this organisation.</p>}</fieldset>
        {quoteLoading ? <p role="status" className="text-description">Calculating your payment…</p> : quoteError ? <div role="alert" className="checkout-quote-error"><p>{quoteError}</p><button type="button" onClick={() => setQuoteRevision(value => value + 1)} className="checkout-retry-quote">Retry payment calculation</button></div> : <PaymentBreakdown quote={quote} />}
        {!free && amountCents > 0 && <fieldset disabled={busy} className="detail-stack"><legend className="checkout-options-heading">Payment method</legend>{METHODS.map(({ id, label, detail, icon: Icon }) => <label key={id} className={`checkout-choice ${paymentMethod === id ? "checkout-choice-selected" : "checkout-choice-idle"}`}><input type="radio" name="payment-method" value={id} checked={selectedTierId && paymentMethod === id} onChange={() => { setPaymentMethod(id); setSampleAccount(id === 'ewallet' ? 'Demo Wallet' : 'Demo Bank'); }} className="checkout-choice-radio" /><Icon className="checkout-method-icon" aria-hidden="true" /><span><span className="checkout-field-label">{label}</span><span className="text-caption">{detail}</span></span></label>)}</fieldset>}
        <p className="checkout-payment-policy">{free ? 'This membership is free. No payment is needed.' : `One ${currentTier?.interval === 'yearly' ? 'year' : 'month'} of membership. No automatic deductions. Access begins after the server confirms your approved demo payment.`}</p>
        {!free && <button type="submit" disabled={busy || !currentTier || quoteLoading || !quote || Boolean(quoteError)} className="checkout-submit">{processing ? <RefreshCw className="icon-spinner" aria-hidden="true" /> : <ArrowRight className="icon-default" aria-hidden="true" />}{processing ? 'Preparing checkout…' : amountCents === 0 ? 'Review membership change' : 'Continue to payment'}</button>}
      </form>}
    </div>
  </div>;
  return standalone ? content : <div role="dialog" aria-modal="true" aria-label="Membership checkout" className="checkout-overlay"><div className="checkout-dialog">{content}</div></div>;
}
