import React, { useState } from 'react';
import { ArrowRight, Building2, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import AccountShell from '../components/AccountShell.jsx';

export default function AccountOnboardingPage({ onNavigate }) {
  const { user, completeOnboarding, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const browse = async () => {
    setLoading(true);
    setError('');
    try {
      await completeOnboarding();
      onNavigate('member-organisations');
    } catch (err) {
      setError(err.message || 'We could not save your choice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountShell wide title={`Welcome${user?.firstName ? `, ${user.firstName}` : ''}!`} description="Your email is confirmed. What would you like to do first?" onNavigate={onNavigate}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button type="button" onClick={() => onNavigate('organisation-setup')} disabled={loading} className="rounded-xl border border-brand-primary bg-brand-50 p-5 text-left hover:bg-brand-100 transition-colors disabled:opacity-60">
          <span className="w-11 h-11 rounded-xl bg-brand-primary flex items-center justify-center mb-4"><Building2 className="w-5 h-5 text-brand-ink" aria-hidden="true" /></span>
          <h2 className="text-lg font-bold text-slate-900">Create an organisation</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">Build your community, set your membership tiers and manage it from your admin dashboard.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">Get started <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
        </button>
        <button type="button" onClick={browse} disabled={loading} className="rounded-xl border border-slate-300 bg-white p-5 text-left hover:bg-slate-50 transition-colors disabled:opacity-60">
          <span className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4"><Search className="w-5 h-5 text-brand-ink" aria-hidden="true" /></span>
          <h2 className="text-lg font-bold text-slate-900">Find an organisation</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">Discover public organisations and choose a community to join. You can create your own later.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">{loading ? <><RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Opening directory…</> : <>Browse organisations <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}</span>
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-slate-800 rounded-lg border border-slate-300 bg-slate-50 p-3">{error}</p>}
      <p className="mt-5 text-sm text-slate-500 leading-relaxed">Creating an organisation is optional. Your ReMember account lets you belong to multiple communities.</p>
      <div className="mt-5 text-center"><button type="button" onClick={() => { logout(); onNavigate('login'); }} disabled={loading} className="text-xs font-semibold text-slate-600 hover:underline">Sign out</button></div>
    </AccountShell>
  );
}
