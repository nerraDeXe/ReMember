import React, { useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AccountShell from '../components/AccountShell.jsx';
import CountrySelect from '../components/CountrySelect.jsx';

const inputClass = 'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-brand-primary';
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1.5';

export default function RegisterPage({ onNavigate }) {
  const { register } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', country: '', phone: '', bio: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.country) {
      setError('Please enter your first and last name and choose your country.');
      return;
    }
    if (new TextEncoder().encode(form.password).length > 72) {
      setError('Please shorten your password. It can contain up to 72 bytes; accented letters and emoji can use more than one byte each.');
      return;
    }
    setLoading(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        country: form.country,
        phone: form.phone.trim(),
        bio: form.bio.trim(),
      });
      showToast('Your account is ready. Confirm your email to continue.', 'success');
      onNavigate('verify-email');
    } catch (err) {
      setError(err.message || 'We could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountShell wide title="Create your ReMember account" description="Start with your personal account. After confirming your email, you can create an organisation or join a community." onNavigate={onNavigate}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-xs text-slate-500">Fields marked with * are required.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="register-first-name" className={labelClass}>First Name *</label>
            <input id="register-first-name" name="firstName" type="text" autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required maxLength={80} disabled={loading} className={inputClass} />
          </div>
          <div>
            <label htmlFor="register-last-name" className={labelClass}>Last Name *</label>
            <input id="register-last-name" name="lastName" type="text" autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required maxLength={80} disabled={loading} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="register-email" className={labelClass}>Email Address *</label>
            <input id="register-email" name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} required maxLength={254} disabled={loading} className={inputClass} />
          </div>
          <div>
            <label htmlFor="register-password" className={labelClass}>Password *</label>
            <input id="register-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={8} maxLength={72} disabled={loading} aria-describedby="register-password-hint" className={inputClass} />
            <p id="register-password-hint" className="mt-1.5 text-xs text-slate-500">Use at least 8 characters, up to 72 bytes.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="register-country" className={labelClass}>Country *</label>
            <CountrySelect id="register-country" value={form.country} onChange={(value) => update('country', value)} required disabled={loading} />
          </div>
          <div>
            <label htmlFor="register-phone" className={labelClass}>Phone Number <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="register-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} maxLength={40} disabled={loading} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="register-bio" className={labelClass}>Member Bio <span className="font-normal text-slate-500">(optional)</span></label>
          <textarea id="register-bio" name="bio" rows={3} value={form.bio} onChange={(event) => update('bio', event.target.value)} maxLength={500} disabled={loading} aria-describedby="register-bio-count" placeholder="Tell your communities a little about yourself." className={inputClass} />
          <p id="register-bio-count" className="mt-1 text-right text-xs text-slate-500">{form.bio.length}/500 characters</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-brand-primary hover:bg-brand-secondary text-brand-ink flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="w-4 h-4" aria-hidden="true" />}
          {loading ? 'Creating your account…' : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already have an account?{' '}<button type="button" onClick={() => onNavigate('login')} className="text-brand-ink hover:underline font-semibold">Sign in</button></p>
    </AccountShell>
  );
}
