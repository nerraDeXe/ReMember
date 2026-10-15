import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

let scriptPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = setTimeout(() => { script.remove(); scriptPromise = null; reject(new Error('Google sign-in took too long to load. Please try again.')); }, 15_000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); scriptPromise = null; reject(new Error('Could not load Google sign-in. Please try again.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function GoogleSignIn({ intent = 'login', rememberMe = false, disabled, onNavigate, onBusyChange }) {
  const { googleSignIn } = useAuth();
  const target = useRef(null);
  const latest = useRef({ rememberMe, onNavigate, onBusyChange, googleSignIn, disabled });
  latest.current = { rememberMe, onNavigate, onBusyChange, googleSignIn, disabled };
  const [error, setError] = useState('');
  const [existingEmail, setExistingEmail] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setReady(false);
    async function initialise() {
      try {
        const config = await api.getGoogleConfig();
        if (!active) return;
        if (!config.enabled) { setError('Google sign-in is currently unavailable.'); return; }
        await loadGoogle();
        if (!active || !target.current) return;
        window.google.accounts.id.initialize({ client_id: config.clientId, nonce: config.nonce, auto_select: false, ux_mode: 'popup', callback: async response => {
          if (!active || latest.current.disabled) return;
          setBusy(true);
          setError('');
          setExistingEmail('');
          latest.current.onBusyChange?.(true);
          try {
            const result = await latest.current.googleSignIn({ credential: response.credential, challengeToken: config.challengeToken, intent, rememberMe: latest.current.rememberMe });
            if (active) latest.current.onNavigate(result.signupRequired ? 'google-signup' : 'account-home');
          } catch (err) {
            if (active) {
              setError(err.message || 'Could not sign in with Google.');
              if (['ACCOUNT_EXISTS', 'GOOGLE_ACCOUNT_EXISTS'].includes(err.data?.code)) setExistingEmail(err.data.email || '');
              // Every attempt needs a new nonce and challenge after an error.
              initialise();
            }
          } finally {
            if (active) { setBusy(false); latest.current.onBusyChange?.(false); }
          }
        } });
        target.current.replaceChildren();
        window.google.accounts.id.renderButton(target.current, { type: 'standard', theme: 'outline', size: 'large', text: intent === 'register' ? 'signup_with' : 'signin_with', shape: 'rectangular', width: Math.min(400, target.current.parentElement?.clientWidth || 300) });
        setReady(true);
      } catch (err) { if (active) setError(err.message || 'Google sign-in is unavailable.'); }
    }
    initialise();
    return () => { active = false; };
  }, [intent, retry]);

  return (
    <div className="space-y-3">
      <div className={`flex justify-center ${busy || disabled ? 'opacity-60 pointer-events-none' : ''}`} ref={target} />
      {!ready && !error && <p className="text-xs text-center text-slate-500">Loading Google sign-in…</p>}
      {busy && <p role="status" className="text-xs text-center text-slate-600">Signing in with Google…</p>}
      {error && <div role="alert" className="rounded-lg border border-brand-accent bg-brand-50 p-3 text-sm text-slate-800"><p>{error}</p>{existingEmail ? <button type="button" onClick={() => onNavigate('login', { email: existingEmail })} className="mt-2 font-semibold underline">Sign in to your existing account</button> : !ready && <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 font-semibold underline">Try again</button>}</div>}
    </div>
  );
}
