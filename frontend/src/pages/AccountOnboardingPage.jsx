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
      <div className="onboarding-choices">
        <button type="button" onClick={() => onNavigate('organisation-setup')} disabled={loading} className="onboarding-create-choice">
          <span className="onboarding-create-icon"><Building2 className="onboarding-choice-icon" aria-hidden="true" /></span>
          <h2 className="section-title">Create an organisation</h2>
          <p className="onboarding-choice-description">Build your community, set your membership tiers and manage it from your admin dashboard.</p>
          <span className="onboarding-choice-action">Get started <ArrowRight className="icon-default" aria-hidden="true" /></span>
        </button>
        <button type="button" onClick={browse} disabled={loading} className="onboarding-browse-choice">
          <span className="onboarding-browse-icon"><Search className="onboarding-choice-icon" aria-hidden="true" /></span>
          <h2 className="section-title">Find an organisation</h2>
          <p className="onboarding-choice-description">Discover public organisations and choose a community to join. You can create your own later.</p>
          <span className="onboarding-choice-action">{loading ? <><RefreshCw className="icon-spinner" aria-hidden="true" /> Opening directory…</> : <>Browse organisations <ArrowRight className="icon-default" aria-hidden="true" /></>}</span>
        </button>
      </div>
      {error && <p role="alert" className="onboarding-error">{error}</p>}
      <p className="onboarding-account-note">Creating an organisation is optional. Your ReMember account lets you belong to multiple communities.</p>
      <div className="onboarding-footer"><button type="button" onClick={() => { logout(); onNavigate('login'); }} disabled={loading} className="onboarding-signout">Sign out</button></div>
    </AccountShell>
  );
}
