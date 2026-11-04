import React, { useState } from 'react';
import AccountShell from '../components/AccountShell.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PASSWORD_HINT, passwordError } from '../../../shared/accountRules.js';
import { useUrlQuery } from '../routing.jsx';

export default function PasswordRecoveryPage({ reset = false, onNavigate }) {
  return reset ? <ResetPasswordPage onNavigate={onNavigate} /> : <ForgotPasswordPage onNavigate={onNavigate} />;
}

function ForgotPasswordPage({ onNavigate }) {
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
    {message ? <p role="status" className="recovery-notice">{message}</p> : <form onSubmit={submit} className="form-stack"><label className="text-semibold block" htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="control-editor recovery-email-input" />{error && <p role="alert" className="text-sm">{error}</p>}<button disabled={busy} className="recovery-submit">{busy ? 'Sending…' : 'Send reset link'}</button></form>}
    <button type="button" onClick={() => onNavigate('login')} className="link-underlined text-sm mt-5">Back to sign in</button>
  </AccountShell>;
}

function ResetPasswordPage({ onNavigate }) {
  const { logout } = useAuth();
  const { query, updateQuery } = useUrlQuery();
  const token = query.get('token') || '';
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
    try { await api.resetPassword(token, password); logout(); updateQuery({ token: null }, { replace: true }); setDone(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <AccountShell title={done ? 'Password updated' : 'Choose a new password'} description={done ? 'Your older sessions have ended. Sign in with your new password.' : 'Reset links expire after 30 minutes and can be used once.'} onNavigate={onNavigate}>
    {done ? <button onClick={() => onNavigate('login')} className="recovery-back">Sign in</button> : !token ? <div><p className="text-sm">This link is incomplete. Request a new password reset email.</p><button onClick={() => onNavigate('forgot-password')} className="link-underlined mt-4 text-sm">Request another link</button></div> : <form onSubmit={submit} className="form-stack"><div><label htmlFor="new-password" className="text-semibold">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby="reset-password-hint" className="recovery-input" /><p id="reset-password-hint" className="text-caption mt-2">{PASSWORD_HINT}</p></div><div><label htmlFor="confirm-password" className="text-semibold">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} className="recovery-input" /></div>{error && <p role="alert" className="text-sm">{error}</p>}<button disabled={busy} className="recovery-submit">{busy ? 'Updating…' : 'Reset password'}</button><button type="button" onClick={() => onNavigate('forgot-password')} className="link-underlined block text-xs">Request a new link</button></form>}
  </AccountShell>;
}
