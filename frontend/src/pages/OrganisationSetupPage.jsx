import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Globe, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AccountShell from '../components/AccountShell.jsx';
import { useNavigation, useUrlQuery, useUrlState } from '../routing.jsx';
import { hasDuplicateTierPricing } from '../../../shared/tierPricing.js';

const inputClass = "control control-standard focus:border-brand-primary";
const labelClass = "field-label";
const newTier = () => ({ key: crypto.randomUUID(), name: '', price: '', interval: 'monthly' });

export default function OrganisationSetupPage({ onNavigate }) {
  const { user, refreshUser, selectOrganisation } = useAuth();
  const { showToast } = useToast();
  const { getSnapshot } = useNavigation();
  const [stepValue, setStepValue] = useUrlState('step', '1');
  const { closeQuery } = useUrlQuery();
  const step = stepValue === '2' ? 2 : 1;
  const goToTiers = () => { closeQuery(['step']); setError(''); };
  const [tiers, setTiers] = useState(() => [newTier()]);
  const [form, setForm] = useState({ name: '', description: '', category: '', location: '', visibility: 'public' });
  const [saving, setSaving] = useState(false);
  const [createdOrganisation, setCreatedOrganisation] = useState(null);
  const [error, setError] = useState('');
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));
  const updateTier = (key, field, value) => setTiers((previous) => previous.map((tier) => tier.key === key ? { ...tier, [field]: value } : tier));

  const validateTiers = () => {
    if (!tiers.length) {
      setError('Create at least one membership tier for your organisation.');
      return false;
    }
    if (tiers.some((tier) => !tier.name.trim() || !/^\d+(\.\d{1,2})?$/.test(tier.price) || !Number.isFinite(Number(tier.price)) || Number(tier.price) < 0)) {
      setError('Give each tier a name and a valid amount with up to two decimal places. Use 0 for a free tier.');
      return false;
    }
    const names = tiers.map((tier) => tier.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Give each membership tier a different name.');
      return false;
    }
    if (hasDuplicateTierPricing(tiers)) {
      setError('Each membership tier needs a different price and billing interval combination.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validateTiers()) return;
    if (step === 1) { setStepValue('2'); return; }
    if (!form.name.trim() || !form.description.trim()) {
      setError('Please enter an organisation name and description.');
      return;
    }
    const submittedRoute = getSnapshot();
    setSaving(true);
    let organisation = createdOrganisation;
    try {
      if (!organisation) {
        const result = await api.createOrganisation({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          location: form.location.trim(),
          visibility: form.visibility,
          isPublic: form.visibility === 'public',
          tiers: tiers.map((tier) => ({ name: tier.name.trim(), price: Number(tier.price), interval: tier.interval, currency: 'MYR' })),
        });
        if (!result.success) throw new Error(result.message || 'We could not create your organisation.');
        organisation = result.organisation;
        setCreatedOrganisation(organisation);
      }
      await refreshUser();
      if (getSnapshot() === submittedRoute && organisation?._id) await selectOrganisation(organisation._id);
      showToast(`Your organisation "${form.name.trim()}" is ready.`, 'success');
      if (getSnapshot() === submittedRoute) onNavigate('admin-dashboard');
    } catch (err) {
      if (getSnapshot() === submittedRoute) setError(organisation ? 'Your organisation was created, but we could not open its dashboard. Retry below to continue.' : err.message || 'We could not create your organisation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell wide title="Create your organisation" description="Set up a home for your community. You will manage your organisation from its admin dashboard." onNavigate={onNavigate}>
      <ol className="setup-progress" aria-label="Organisation setup progress">
        <li className={`setup-progress-step ${step === 1 ? "choice-selected text-brand-ink" : "setup-step-idle"}`} aria-current={step === 1 ? 'step' : undefined}>1. Membership tiers</li>
        <li className={`setup-progress-step ${step === 2 ? "choice-selected text-brand-ink" : "setup-step-idle"}`} aria-current={step === 2 ? 'step' : undefined}>2. Organisation details</li>
      </ol>
      <form onSubmit={handleSubmit} className="section-stack">
        {step === 1 ? (
          <>
            <div><h2 className="section-title">Start with your membership tiers</h2><p className="text-description mt-1.5 leading-relaxed">Create at least one tier and choose its name and amount. Set an amount of 0 for free membership. You can add more tiers later.</p></div>
            <div className="form-stack">
              {tiers.map((tier, index) => (
                <fieldset key={tier.key} className="setup-tier-fieldset">
                  <legend className="text-hint-strong px-1">Tier {index + 1}</legend>
                  <div className="setup-tier-fields">
                    <div><label htmlFor={`tier-name-${tier.key}`} className={labelClass}>Tier Name *</label><input id={`tier-name-${tier.key}`} type="text" value={tier.name} onChange={(event) => updateTier(tier.key, 'name', event.target.value)} required maxLength={80} placeholder="e.g. Community" className={inputClass} /></div>
                    <div><label htmlFor={`tier-price-${tier.key}`} className={labelClass}>Amount (MYR) *</label><input id={`tier-price-${tier.key}`} type="number" inputMode="decimal" min="0" step="0.01" value={tier.price} onChange={(event) => updateTier(tier.key, 'price', event.target.value)} required placeholder="0.00" className={inputClass} /></div>
                    <div><label htmlFor={`tier-interval-${tier.key}`} className={labelClass}>Billing Period</label><select id={`tier-interval-${tier.key}`} value={tier.interval} onChange={(event) => updateTier(tier.key, 'interval', event.target.value)} className={inputClass}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
                  </div>
                  <button type="button" onClick={() => setTiers((previous) => previous.filter((item) => item.key !== tier.key))} disabled={tiers.length === 1} title={tiers.length === 1 ? 'Your organisation needs at least one membership tier.' : undefined} className="row-icon-inline setup-add-tier"><Trash2 className="icon-small" aria-hidden="true" /> Remove tier</button>
                </fieldset>
              ))}
              <button type="button" onClick={() => setTiers((previous) => [...previous, newTier()])} disabled={tiers.length >= 20} className="button-secondary button-inline setup-back-button"><Plus className="icon-default" aria-hidden="true" /> Add another tier</button>
            </div>
          </>
        ) : (
          <>
            <div><h2 className="section-title">Tell us about your organisation</h2><p className="text-description mt-1.5">Fields marked with * are required.</p></div>
            <div><label htmlFor="organisation-name" className={labelClass}>Organisation Name *</label><input id="organisation-name" name="name" type="text" value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={120} disabled={saving || !!createdOrganisation} className={inputClass} /></div>
            <div><label htmlFor="organisation-description" className={labelClass}>Description *</label><textarea id="organisation-description" name="description" rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} required maxLength={2000} disabled={saving || !!createdOrganisation} className={inputClass} /></div>
            <div className="form-grid">
              <div><label htmlFor="organisation-category" className={labelClass}>Category <span className="font-normal text-slate-500">(optional)</span></label><input id="organisation-category" type="text" value={form.category} onChange={(event) => update('category', event.target.value)} maxLength={80} disabled={saving || !!createdOrganisation} placeholder="e.g. Arts & Culture" className={inputClass} /></div>
              <div><label htmlFor="organisation-location" className={labelClass}>Location <span className="font-normal text-slate-500">(optional)</span></label><input id="organisation-location" type="text" value={form.location} onChange={(event) => update('location', event.target.value)} maxLength={120} disabled={saving || !!createdOrganisation} className={inputClass} /></div>
            </div>
            <fieldset>
              <legend className={`${labelClass} mb-2`}>Organisation Visibility</legend>
              <div className="organisation-choice-grid">
                {[{ value: 'public', title: 'Public', description: 'People can find your organisation and join from the directory.', Icon: Globe }, { value: 'private', title: 'Private', description: 'Your organisation is hidden from public searches.', Icon: Lock }].map(({ value, title, description, Icon }) => (
                  <label key={value} className={`row-start setup-visibility-choice ${form.visibility === value ? "choice-selected" : "border-slate-200"}`}>
                    <input type="radio" name="visibility" value={value} checked={form.visibility === value} onChange={() => update('visibility', value)} disabled={saving || !!createdOrganisation} className="mt-1" />
                    <span><span className="row-inline-tight text-semibold text-slate-900"><Icon className="icon-default" aria-hidden="true" />{title}</span><span className="text-help block leading-relaxed">{description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="text-description setup-tier-summary">
              {`${tiers.length} membership ${tiers.length === 1 ? 'tier' : 'tiers'} ready.`}{' '}<button type="button" onClick={goToTiers} disabled={saving || !!createdOrganisation} className="link-brand">Edit tiers</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="account-notice">{error}</p>}
        <div className="row-wrap-wide setup-navigation">
          <button type="button" onClick={() => { if (step === 2) goToTiers(); else onNavigate(user?.onboardingCompleted ? 'account-organisations' : 'account-onboarding'); }} disabled={saving || !!createdOrganisation} className="button-inline text-description setup-navigation-back"><ArrowLeft className="icon-default" aria-hidden="true" /> Back</button>
          <div className="row-wrap-wide">
            <button type="submit" disabled={saving} className="button-primary button-inline setup-submit">
              {saving ? <RefreshCw className="icon-spinner" aria-hidden="true" /> : step === 1 ? <ArrowRight className="icon-default" aria-hidden="true" /> : <Building2 className="icon-default" aria-hidden="true" />}
              {saving ? createdOrganisation ? 'Opening dashboard…' : 'Creating organisation…' : step === 1 ? 'Continue' : createdOrganisation ? 'Open Dashboard' : 'Create Organisation'}
            </button>
          </div>
        </div>
      </form>
    </AccountShell>
  );
}
