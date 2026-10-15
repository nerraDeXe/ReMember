import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Globe, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AccountShell from '../components/AccountShell.jsx';

const inputClass = 'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-brand-primary';
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1.5';
const newTier = () => ({ key: crypto.randomUUID(), name: '', price: '', interval: 'monthly' });

export default function OrganisationSetupPage({ onNavigate }) {
  const { user, refreshUser, selectOrganisation } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
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
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validateTiers()) return;
    if (step === 1) { setStep(2); return; }
    if (!form.name.trim() || !form.description.trim()) {
      setError('Please enter an organisation name and description.');
      return;
    }
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
          tiers: tiers.map((tier) => ({ name: tier.name.trim(), price: Number(tier.price), interval: tier.interval, currency: 'USD' })),
        });
        if (!result.success) throw new Error(result.message || 'We could not create your organisation.');
        organisation = result.organisation;
        setCreatedOrganisation(organisation);
      }
      await refreshUser();
      if (organisation?._id) await selectOrganisation(organisation._id);
      showToast(`Your organisation "${form.name.trim()}" is ready.`, 'success');
      onNavigate('admin-dashboard');
    } catch (err) {
      setError(organisation ? 'Your organisation was created, but we could not open its dashboard. Retry below to continue.' : err.message || 'We could not create your organisation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell wide title="Create your organisation" description="Set up a home for your community. You will manage your organisation from its admin dashboard." onNavigate={onNavigate}>
      <ol className="grid grid-cols-2 gap-3 mb-7 text-xs font-semibold" aria-label="Organisation setup progress">
        <li className={`rounded-lg border p-3 ${step === 1 ? 'border-brand-primary bg-brand-50 text-brand-ink' : 'border-slate-200 bg-slate-50 text-slate-600'}`} aria-current={step === 1 ? 'step' : undefined}>1. Membership tiers</li>
        <li className={`rounded-lg border p-3 ${step === 2 ? 'border-brand-primary bg-brand-50 text-brand-ink' : 'border-slate-200 bg-slate-50 text-slate-600'}`} aria-current={step === 2 ? 'step' : undefined}>2. Organisation details</li>
      </ol>
      <form onSubmit={handleSubmit} className="space-y-5">
        {step === 1 ? (
          <>
            <div><h2 className="text-lg font-bold text-slate-900">Start with your membership tiers</h2><p className="text-sm text-slate-600 mt-1.5 leading-relaxed">Create at least one tier and choose its name and amount. Set an amount of 0 for free membership. You can add more tiers later.</p></div>
            <div className="space-y-4">
              {tiers.map((tier, index) => (
                <fieldset key={tier.key} className="rounded-xl border border-slate-200 p-4">
                  <legend className="px-1 text-xs font-semibold text-slate-600">Tier {index + 1}</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><label htmlFor={`tier-name-${tier.key}`} className={labelClass}>Tier Name *</label><input id={`tier-name-${tier.key}`} type="text" value={tier.name} onChange={(event) => updateTier(tier.key, 'name', event.target.value)} required maxLength={80} placeholder="e.g. Community" className={inputClass} /></div>
                    <div><label htmlFor={`tier-price-${tier.key}`} className={labelClass}>Amount (USD) *</label><input id={`tier-price-${tier.key}`} type="number" inputMode="decimal" min="0" step="0.01" value={tier.price} onChange={(event) => updateTier(tier.key, 'price', event.target.value)} required placeholder="0.00" className={inputClass} /></div>
                    <div><label htmlFor={`tier-interval-${tier.key}`} className={labelClass}>Billing Period</label><select id={`tier-interval-${tier.key}`} value={tier.interval} onChange={(event) => updateTier(tier.key, 'interval', event.target.value)} className={inputClass}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
                  </div>
                  <button type="button" onClick={() => setTiers((previous) => previous.filter((item) => item.key !== tier.key))} disabled={tiers.length === 1} title={tiers.length === 1 ? 'Your organisation needs at least one membership tier.' : undefined} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remove tier</button>
                </fieldset>
              ))}
              <button type="button" onClick={() => setTiers((previous) => [...previous, newTier()])} disabled={tiers.length >= 20} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-60"><Plus className="w-4 h-4" aria-hidden="true" /> Add another tier</button>
            </div>
          </>
        ) : (
          <>
            <div><h2 className="text-lg font-bold text-slate-900">Tell us about your organisation</h2><p className="text-sm text-slate-600 mt-1.5">Fields marked with * are required.</p></div>
            <div><label htmlFor="organisation-name" className={labelClass}>Organisation Name *</label><input id="organisation-name" name="name" type="text" value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={120} disabled={saving || !!createdOrganisation} className={inputClass} /></div>
            <div><label htmlFor="organisation-description" className={labelClass}>Description *</label><textarea id="organisation-description" name="description" rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} required maxLength={2000} disabled={saving || !!createdOrganisation} className={inputClass} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label htmlFor="organisation-category" className={labelClass}>Category <span className="font-normal text-slate-500">(optional)</span></label><input id="organisation-category" type="text" value={form.category} onChange={(event) => update('category', event.target.value)} maxLength={80} disabled={saving || !!createdOrganisation} placeholder="e.g. Arts & Culture" className={inputClass} /></div>
              <div><label htmlFor="organisation-location" className={labelClass}>Location <span className="font-normal text-slate-500">(optional)</span></label><input id="organisation-location" type="text" value={form.location} onChange={(event) => update('location', event.target.value)} maxLength={120} disabled={saving || !!createdOrganisation} className={inputClass} /></div>
            </div>
            <fieldset>
              <legend className={`${labelClass} mb-2`}>Organisation Visibility</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[{ value: 'public', title: 'Public', description: 'People can find your organisation and join from the directory.', Icon: Globe }, { value: 'private', title: 'Private', description: 'Your organisation is hidden from public searches.', Icon: Lock }].map(({ value, title, description, Icon }) => (
                  <label key={value} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${form.visibility === value ? 'border-brand-primary bg-brand-50' : 'border-slate-200'}`}>
                    <input type="radio" name="visibility" value={value} checked={form.visibility === value} onChange={() => update('visibility', value)} disabled={saving || !!createdOrganisation} className="mt-1" />
                    <span><span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Icon className="w-4 h-4" aria-hidden="true" />{title}</span><span className="block text-xs text-slate-600 mt-1 leading-relaxed">{description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {`${tiers.length} membership ${tiers.length === 1 ? 'tier' : 'tiers'} ready.`}{' '}<button type="button" onClick={() => { setStep(1); setError(''); }} disabled={saving || !!createdOrganisation} className="font-semibold text-brand-ink hover:underline">Edit tiers</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <button type="button" onClick={() => { if (step === 2) { setStep(1); setError(''); } else onNavigate(user?.onboardingCompleted ? 'account-organisations' : 'account-onboarding'); }} disabled={saving || !!createdOrganisation} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 px-2 py-2"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold text-sm bg-brand-primary hover:bg-brand-secondary text-brand-ink disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : step === 1 ? <ArrowRight className="w-4 h-4" aria-hidden="true" /> : <Building2 className="w-4 h-4" aria-hidden="true" />}
              {saving ? createdOrganisation ? 'Opening dashboard…' : 'Creating organisation…' : step === 1 ? 'Continue' : createdOrganisation ? 'Open Dashboard' : 'Create Organisation'}
            </button>
          </div>
        </div>
      </form>
    </AccountShell>
  );
}
