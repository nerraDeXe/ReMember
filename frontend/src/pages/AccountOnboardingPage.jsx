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
      <div className="form-grid">
        <button type="button" onClick={() => onNavigate('organisation-setup')} disabled={loading} className="choice-selected onboarding-owner-choice">
          <span className="icon-center onboarding-owner-icon"><Building2 className="icon-brand-medium" aria-hidden="true" /></span>
          <h2 className="section-title">Create an organisation</h2>
          <p className="text-intro leading-relaxed">Build your community, set your membership tiers and manage it from your admin dashboard.</p>
          <span className="button-inline text-semibold onboarding-action">Get started <ArrowRight className="icon-default" aria-hidden="true" /></span>
        </button>
        <button type="button" onClick={browse} disabled={loading} className="onboarding-member-choice">
          <span className="icon-center onboarding-member-icon"><Search className="icon-brand-medium" aria-hidden="true" /></span>
          <h2 className="section-title">Find an organisation</h2>
          <p className="text-intro leading-relaxed">Discover public organisations and choose a community to join. You can create your own later.</p>
          <span className="button-inline text-semibold onboarding-action">{loading ? <><RefreshCw className="icon-spinner" aria-hidden="true" /> Opening directory…</> : <>Browse organisations <ArrowRight className="icon-default" aria-hidden="true" /></>}</span>
        </button>
      </div>
      {error && <p role="alert" className="account-notice mt-4">{error}</p>}
      <p className="onboarding-note">Creating an organisation is optional. Your ReMember account lets you belong to multiple communities.</p>
      <div className="mt-5 text-center"><button type="button" onClick={() => { logout(); onNavigate('login'); }} disabled={loading} className="text-hint-strong hover:underline">Sign out</button></div>
    </AccountShell>
  );
}
