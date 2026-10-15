import React, { useState } from 'react';
import AccountShell from '../components/AccountShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { PASSWORD_HINT, passwordError } from '../../../shared/accountRules.js';

export default function ResetPasswordPage({ onNavigate }) {
  const { logout } = useAuth();
  const token = new URLSearchParams(window.location.hash.split('?')[1]).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    const invalidPassword = passwordError(password);
    if (invalidPassword || password !== confirmation) { setError(invalidPassword || 'The passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await api.resetPassword(token, password); logout(); window.history.replaceState(null, '', window.location.pathname + window.location.search); setDone(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <AccountShell title={done ? 'Password updated' : 'Choose a new password'} description={done ? 'Your older sessions have ended. Sign in with your new password.' : 'Reset links expire after 30 minutes and can be used once.'} onNavigate={onNavigate}>
    {done ? <button onClick={() => onNavigate('login')} className="w-full rounded-lg bg-brand-primary py-3 text-sm font-bold">Sign in</button> : !token ? <div><p className="text-sm">This link is incomplete. Request a new password reset email.</p><button onClick={() => onNavigate('forgot-password')} className="mt-4 font-semibold underline text-sm">Request another link</button></div> : <form onSubmit={submit} className="space-y-4"><div><label htmlFor="new-password" className="text-sm font-semibold">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby="reset-password-hint" className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2.5" /><p id="reset-password-hint" className="mt-2 text-xs text-slate-500">{PASSWORD_HINT}</p></div><div><label htmlFor="confirm-password" className="text-sm font-semibold">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2.5" /></div>{error && <p role="alert" className="text-sm">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-brand-primary hover:bg-brand-secondary py-3 text-sm font-bold disabled:opacity-60">{busy ? 'Updating…' : 'Reset password'}</button><button type="button" onClick={() => onNavigate('forgot-password')} className="block text-xs font-semibold underline">Request a new link</button></form>}
  </AccountShell>;
}
