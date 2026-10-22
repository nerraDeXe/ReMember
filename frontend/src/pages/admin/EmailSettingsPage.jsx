import React, { useEffect, useState } from 'react';
import { Mail, Save, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getOrganisationEmailSettings,
  normaliseOrganisationEmailSettings,
  interpolateOrganisationEmail,
} from '../../../../shared/organisationEmails.js';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-slate-50';
const emailTypes = [
  { key: 'welcome', title: 'Welcome email', description: 'Sent when a member first activates their membership in this organisation.' },
  { key: 'renewal', title: 'Renewal reminder', description: 'Sent once before each membership expiry, at the lead time you choose.' },
];

export default function EmailSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const organisationId = user?.activeOrganisationId;
  const organisationName = user?.activeOrganisation?.name || 'Your organisation';
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewType, setPreviewType] = useState('welcome');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    setLoading(true);
    setError('');
    api.getOrganisationEmailSettings(organisationId).then(data => {
      if (cancelled) return;
      const loaded = getOrganisationEmailSettings(data.emailSettings);
      setSettings(loaded);
      setSavedSettings(JSON.stringify(loaded));
    }).catch(err => {
      if (!cancelled) setError(err.message || 'Could not load email settings.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organisationId, reload]);

  const update = (type, field, value) => {
    setSettings(previous => ({ ...previous, [type]: { ...previous[type], [field]: value } }));
    setError('');
  };

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    let validated;
    try {
      validated = normaliseOrganisationEmailSettings(settings);
    } catch (err) {
      setError(err.message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.updateOrganisationEmailSettings(organisationId, validated);
      const saved = getOrganisationEmailSettings(response.emailSettings);
      setSettings(saved);
      setSavedSettings(JSON.stringify(saved));
      showToast('Email settings saved for ' + organisationName + '.', 'success');
    } catch (err) {
      setError(err.message || 'Could not save email settings.');
    } finally {
      setSaving(false);
    }
  };

  const previewContext = {
    memberName: 'Alex Member',
    organisationName,
    tierName: 'Community',
    expiryDate: '2026-11-30',
    renewalDays: String(settings?.renewal.daysBefore || 30),
  };
  const preview = settings?.[previewType];
  const dirty = settings && JSON.stringify(settings) !== savedSettings;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Mail className="w-6 h-6" />Email Settings</h1>
        <p className="text-sm text-slate-600 mt-2">Customise member emails for <strong>{organisationName}</strong>.</p>
      </div>

      {loading ? (
        <div role="status" className="flex items-center gap-3 py-12 text-sm text-slate-600"><RefreshCw className="w-5 h-5 animate-spin" />Loading email settings...</div>
      ) : !settings ? (
        <div role="alert" className="rounded-xl border border-slate-300 bg-white p-5 space-y-3">
          <p className="text-sm text-slate-700">{error}</p>
          <button onClick={() => setReload(value => value + 1)} className="text-sm font-semibold underline">Retry</button>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 leading-relaxed">
            Personalise your plain-text messages with <code>{'{memberName}'}</code>, <code>{'{organisationName}'}</code>, <code>{'{tierName}'}</code>, <code>{'{expiryDate}'}</code>, or <code>{'{renewalDays}'}</code>. Member details replace these placeholders automatically.
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-6 items-start">
            <div className="space-y-5">
              {emailTypes.map(({ key, title, description }) => (
                <section key={key} aria-labelledby={`${key}-title`} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                      <h2 id={`${key}-title`} className="text-base font-bold text-slate-900">{title}</h2>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 shrink-0 pt-1">
                      <input type="checkbox" checked={settings[key].enabled} onChange={event => update(key, 'enabled', event.target.checked)} disabled={saving} className="w-4 h-4 accent-brand-primary" aria-label={`Enable ${title.toLowerCase()}`} />Enabled
                    </label>
                  </div>
                  <fieldset disabled={saving} className="space-y-4">
                    {key === 'renewal' && (
                      <div>
                        <label htmlFor="renewal-days" className="block text-xs font-semibold text-slate-700 mb-2">Send reminder before membership expires</label>
                        <div className="flex items-center gap-3">
                          <input id="renewal-days" type="number" min="1" max="365" step="1" required value={settings.renewal.daysBefore} onChange={event => update('renewal', 'daysBefore', event.target.value === '' ? '' : Number(event.target.value))} className={`${inputClass} max-w-24`} />
                          <span className="text-sm text-slate-600">days before expiry</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label htmlFor={`${key}-subject`} className="block text-xs font-semibold text-slate-700 mb-2">Email subject</label>
                      <input id={`${key}-subject`} type="text" maxLength={160} required value={settings[key].subject} onChange={event => update(key, 'subject', event.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor={`${key}-body`} className="block text-xs font-semibold text-slate-700 mb-2">Message</label>
                      <textarea id={`${key}-body`} rows={7} maxLength={5000} required value={settings[key].body} onChange={event => update(key, 'body', event.target.value)} className={`${inputClass} resize-y`} />
                      <p className="text-xs text-slate-500 text-right mt-1">{settings[key].body.length.toLocaleString()} / 5,000</p>
                    </div>
                  </fieldset>
                  <button type="button" onClick={() => setPreviewType(key)} className="inline-flex items-center gap-2 mt-4 text-xs font-semibold text-slate-700 underline underline-offset-4"><Eye className="w-4 h-4" />Preview {title.toLowerCase()}</button>
                </section>
              ))}
            </div>

            <aside aria-label="Email preview" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden xl:sticky xl:top-24">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-sm font-bold flex items-center gap-2"><Eye className="w-4 h-4" />Email preview</h2>
                <p className="text-xs text-slate-500 mt-1">Sample member details. Preview updates as you type.</p>
                <div className="flex gap-2 mt-3" role="group" aria-label="Choose email preview">
                  {emailTypes.map(type => <button key={type.key} type="button" aria-pressed={previewType === type.key} onClick={() => setPreviewType(type.key)} className={`px-3 py-2 rounded-lg text-xs font-semibold border ${previewType === type.key ? 'bg-brand-primary text-brand-ink border-brand-primary' : 'border-slate-300 bg-white text-slate-600'}`}>{type.title}</button>)}
                </div>
              </div>
              <div className="p-5 sm:p-6">
                {!preview.enabled && <p className="text-xs text-slate-600 mb-4 rounded-lg bg-slate-100 px-3 py-2">This email is disabled. Enable it and save to send automatically.</p>}
                <p className="text-xs text-slate-500 mb-1">To: Alex Member</p>
                <p className="text-sm font-bold break-words border-b border-slate-100 pb-4">{interpolateOrganisationEmail(preview.subject, previewContext)}</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed mt-4">{interpolateOrganisationEmail(preview.body, previewContext)}</p>
              </div>
            </aside>
          </div>

          <p className="text-xs text-slate-500">Emails respect each member's email notification preference. Members without an expiry date do not receive renewal reminders.</p>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <p role="status" className="text-xs text-slate-500 mr-auto">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
            <button type="submit" disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink px-5 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save email settings'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
