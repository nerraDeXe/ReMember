import React, { useState } from 'react';
import AccountShell from '../components/AccountShell.jsx';
import { api } from '../api.js';

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try { setMessage((await api.forgotPassword(email)).message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <AccountShell title="Forgot your password?" description="Enter your account email and we will send password reset instructions. Google-only accounts should use Sign in with Google." onNavigate={onNavigate}>
    {message ? <p role="status" className="text-sm bg-brand-50 border border-brand-accent rounded-lg p-4">{message}</p> : <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold" htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />{error && <p role="alert" className="text-sm">{error}</p>}<button disabled={busy} className="w-full py-3 rounded-lg bg-brand-primary hover:bg-brand-secondary text-sm font-bold disabled:opacity-60">{busy ? 'Sending…' : 'Send reset link'}</button></form>}
    <button type="button" onClick={() => onNavigate('login')} className="text-sm font-semibold mt-5 underline">Back to sign in</button>
  </AccountShell>;
}
