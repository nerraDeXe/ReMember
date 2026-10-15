import React, { useEffect, useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AccountShell from '../components/AccountShell.jsx';

export default function VerifyEmailPage({ onNavigate }) {
  const { user, verifyEmail, resendVerification, refreshUser, logout, verificationDeliveryError, verificationResendAt } = useAuth();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [deliveryError, setDeliveryError] = useState(verificationDeliveryError || '');
  const [cooldownUntil, setCooldownUntil] = useState(new Date(verificationResendAt).getTime() || 0);
  const [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => { setDeliveryError(verificationDeliveryError || ''); }, [verificationDeliveryError]);
  useEffect(() => { if (verificationResendAt) setCooldownUntil(new Date(verificationResendAt).getTime() || 0); }, [verificationResendAt]);
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError('');
    setBusy('verify');
    try {
      await verifyEmail(code);
      showToast('Email confirmed. Welcome to ReMember!', 'success');
      onNavigate('account-onboarding');
    } catch (err) {
      setError(err.message || 'We could not confirm that code. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const handleResend = async () => {
    setError('');
    setBusy('resend');
    try {
      const result = await resendVerification();
      if (result?.verification?.delivery === 'already_verified') {
        await refreshUser();
        onNavigate('account-onboarding');
        return;
      }
      setNow(Date.now());
      setCooldownUntil(new Date(result?.verification?.canResendAt).getTime() || Date.now() + 60000);
      const failedDelivery = result?.verification?.delivery !== 'sent';
      setDeliveryError(failedDelivery ? result?.verification?.message || 'Email delivery failed.' : '');
      if (!failedDelivery) showToast('A new confirmation code has been sent to your email.', 'success');
    } catch (err) {
      setError(err.message || 'We could not send another email. Please try again.');
      if (err.data?.verification?.delivery === 'failed' || err.data?.verification?.delivery === 'unavailable') {
        setDeliveryError(err.data.verification.message || 'Email delivery failed.');
      }
      if (err.data?.verification?.canResendAt) {
        setNow(Date.now());
        setCooldownUntil(new Date(err.data.verification.canResendAt).getTime() || 0);
      }
      if (err.data?.retryAfterSeconds) setCooldownUntil(Date.now() + err.data.retryAfterSeconds * 1000);
    } finally {
      setBusy('');
    }
  };

  return (
    <AccountShell title="Confirm your email" description="Confirm your email before creating or joining an organisation." onNavigate={onNavigate}>
      <div className="mb-6 rounded-xl bg-brand-50 border border-brand-primary/40 p-4 flex gap-3">
        <MailCheck className="w-5 h-5 text-brand-ink mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm text-slate-700 leading-relaxed">We'll confirm <span className="font-semibold break-all">{user?.email}</span> with a six-digit code. Enter it below and check your spam folder if it hasn't arrived.</p>
      </div>
      {deliveryError && <p role="alert" className="mb-5 text-sm text-slate-800 rounded-lg border border-slate-300 bg-slate-50 p-3">We couldn't send your confirmation email. Please try sending it again. If the problem continues, contact support.</p>}
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="verification-code" className="block text-xs font-semibold text-slate-700 mb-1.5">Confirmation Code</label>
          <input id="verification-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={!!busy} placeholder="000000" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-xl tracking-[0.3em] text-slate-900 focus:border-brand-primary" />
        </div>
        {error && <p role="alert" className="text-sm text-slate-800 rounded-lg border border-slate-300 bg-slate-50 p-3">{error}</p>}
        <button type="submit" disabled={!!busy || code.length !== 6} className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-brand-primary hover:bg-brand-secondary text-brand-ink flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
          {busy === 'verify' && <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {busy === 'verify' ? 'Confirming…' : 'Confirm Email'}
        </button>
      </form>
      <div className="mt-5 text-center">
        <button type="button" onClick={handleResend} disabled={!!busy || remaining > 0} className="text-sm font-semibold text-brand-ink hover:underline disabled:text-slate-500 disabled:no-underline disabled:cursor-not-allowed">
          {busy === 'resend' ? 'Sending…' : remaining ? `Send a new code in ${remaining}s` : 'Send a new code'}
        </button>
        <p className="text-xs text-slate-500 mt-4">Signed in with the wrong account?{' '}<button type="button" onClick={() => { logout(); onNavigate('login'); }} className="font-semibold text-slate-800 hover:underline" disabled={!!busy}>Sign out</button></p>
      </div>
    </AccountShell>
  );
}
