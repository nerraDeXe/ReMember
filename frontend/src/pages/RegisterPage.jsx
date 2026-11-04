import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AccountShell from '../components/AccountShell.jsx';
import CountrySelect from '../components/CountrySelect.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { PASSWORD_HINT, passwordError } from '../../../shared/accountRules.js';
import { normalisePhone, rebasePhone } from '../phone.js';

const inputClass = "control control-standard focus:border-brand-primary";
const labelClass = "field-label";

export default function RegisterPage({ onNavigate, googleSignup = false }) {
  const { register, pendingGoogleSignup, completeGoogleSignup } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ firstName: googleSignup ? pendingGoogleSignup?.profile.firstName || '' : '', lastName: googleSignup ? pendingGoogleSignup?.profile.lastName || '' : '', email: googleSignup ? pendingGoogleSignup?.profile.email || '' : '', password: '', country: '', phone: '', bio: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.country) {
      setError('Please enter your first and last name and choose your country.');
      return;
    }
    const invalidPassword = googleSignup ? '' : passwordError(form.password);
    if (invalidPassword) {
      setError(invalidPassword);
      return;
    }
    setLoading(true);
    try {
      const details = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(!googleSignup && { email: form.email.trim(), password: form.password }),
        country: form.country,
        phone: normalisePhone(form.phone, form.country),
        bio: form.bio.trim(),
      };
      const result = googleSignup ? await completeGoogleSignup(details) : await register(details);
      showToast(result.user.emailVerified ? 'Your account is ready.' : 'Your account is ready. Confirm your email to continue.', 'success');
      onNavigate('account-home');
    } catch (err) {
      setError(err.message || 'We could not create your account. Please try again.');
      setAccountExists(err.status === 409);
    } finally {
      setLoading(false);
    }
  };

  if (googleSignup && !pendingGoogleSignup) return <AccountShell title="Continue with Google" description="Choose your Google account again to complete signup." onNavigate={onNavigate}><button onClick={() => onNavigate('register')} className="link-underlined text-sm">Back to sign up</button></AccountShell>;

  return (
    <AccountShell wide title={googleSignup ? 'Complete your ReMember account' : 'Create your ReMember account'} description={googleSignup ? 'Review your Google name and add your country. Your email is supplied by Google; your name is editable.' : 'Start with your personal account. After confirming your email, you can create an organisation or join a community.'} onNavigate={onNavigate}>
      {!googleSignup && <div className="mb-6"><GoogleSignIn intent="register" onNavigate={onNavigate} disabled={loading} onBusyChange={setGoogleBusy} /><p className="text-caption text-center mt-5">Or sign up with your email</p></div>}
      <form onSubmit={handleSubmit} className="section-stack">
        <fieldset disabled={googleBusy} className="space-y-5 min-w-0">
        <p className="text-caption">Fields marked with * are required.</p>
        <div className="form-grid">
          <div>
            <label htmlFor="register-first-name" className={labelClass}>First Name *</label>
            <input id="register-first-name" name="firstName" type="text" autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required maxLength={80} disabled={loading} className={inputClass} />
          </div>
          <div>
            <label htmlFor="register-last-name" className={labelClass}>Last Name *</label>
            <input id="register-last-name" name="lastName" type="text" autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required maxLength={80} disabled={loading} className={inputClass} />
          </div>
        </div>
        <div className="form-grid">
          <div>
            {googleSignup ? <>
              <p id="register-google-email-label" className={labelClass}>Google Account Email</p>
              <div aria-labelledby="register-google-email-label" className="surface-muted row-inline control-standard text-slate-700">
                <LockKeyhole className="icon-default shrink-0 text-slate-500" aria-hidden="true" />
                <span className="break-all">{pendingGoogleSignup.profile.email}</span>
              </div>
              <p className="text-caption mt-1.5">This email is linked to your selected Google account and cannot be changed here.</p>
            </> : <>
              <label htmlFor="register-email" className={labelClass}>Email Address *</label>
              <input id="register-email" name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} required maxLength={254} disabled={loading} className={inputClass} />
            </>}
          </div>
          {!googleSignup && <div>
            <label htmlFor="register-password" className={labelClass}>Password *</label>
            <div className="relative">
              <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={8} maxLength={72} disabled={loading} aria-describedby="register-password-hint" className={`${inputClass} pr-12`} />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="register-password"
                aria-pressed={showPassword}
                className="auth-password-toggle disabled:opacity-60"
              >
                {showPassword ? <EyeOff className="icon-default" aria-hidden="true" /> : <Eye className="icon-default" aria-hidden="true" />}
              </button>
            </div>
            <p id="register-password-hint" className="text-caption mt-1.5">{PASSWORD_HINT}</p>
          </div>}
        </div>
        <div className="form-grid">
          <div>
            <label htmlFor="register-country" className={labelClass}>Country *</label>
            <CountrySelect id="register-country" value={form.country} onChange={(value) => setForm(previous => ({ ...previous, country: value, phone: rebasePhone(previous.phone, previous.country, value) }))} required disabled={loading} />
          </div>
          <div>
            <label htmlFor="register-phone" className={labelClass}>Phone Number <span className="font-normal text-slate-500">(optional)</span></label>
            <PhoneInput id="register-phone" country={form.country} value={form.phone} onChange={(value) => update('phone', value)} disabled={loading} />
          </div>
        </div>
        <div>
          <label htmlFor="register-bio" className={labelClass}>Member Bio <span className="font-normal text-slate-500">(optional)</span></label>
          <textarea id="register-bio" name="bio" rows={3} value={form.bio} onChange={(event) => update('bio', event.target.value)} maxLength={500} disabled={loading} aria-describedby="register-bio-count" placeholder="Tell your communities a little about yourself." className={inputClass} />
          <p id="register-bio-count" className="page-description text-right">{form.bio.length}/500 characters</p>
        </div>
        {error && <p role="alert" className="account-notice">{error}</p>}
        {accountExists && <button type="button" onClick={() => onNavigate('login', { email: googleSignup ? pendingGoogleSignup.profile.email : form.email })} className="link-underlined text-sm">Sign in to your existing account</button>}
        <button type="submit" disabled={loading} className="button-block-primary register-submit">
          {loading ? <RefreshCw className="icon-spinner" aria-hidden="true" /> : <ArrowRight className="icon-default" aria-hidden="true" />}
          {loading ? 'Creating your account…' : 'Create Account'}
        </button>
        </fieldset>
      </form>
      <p className="register-signin-prompt">Already have an account?{' '}<button type="button" onClick={() => onNavigate('login')} className="link-brand">Sign in</button></p>
    </AccountShell>
  );
}
