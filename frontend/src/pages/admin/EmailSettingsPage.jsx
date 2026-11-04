import React, { useEffect, useState } from 'react';
import { Mail, Save, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useUrlState } from '../../routing.jsx';
import EmailTemplateField from '../../components/EmailTemplateField.jsx';
import {
  getOrganisationEmailSettings,
  normaliseOrganisationEmailSettings,
  interpolateOrganisationEmail,
} from '../../../../shared/organisationEmails.js';

const inputClass = "control control-ring-strong control-editor disabled:bg-slate-50";
const emailTypes = [
  { key: 'welcome', title: 'Welcome email', description: 'Sent when a member first activates their membership in this organisation.' },
  { key: 'renewal', title: 'Renewal reminder', description: 'Sent once before each membership expiry, at the lead time you choose.' },
];

export default function EmailSettingsPage({ embedded = false }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const organisationId = user?.activeOrganisationId;
  const organisationName = user?.activeOrganisation?.name || 'Your organisation';
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [requestedPreview, setPreviewType] = useUrlState('preview', 'welcome');
  const previewType = emailTypes.some(type => type.key === requestedPreview) ? requestedPreview : 'welcome';
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
    <div className="page-stack">
      {!embedded && <div>
        <h1 className="page-title"><Mail className="icon-large" />Email Settings</h1>
        <p className="text-intro">Customise member emails for <strong>{organisationName}</strong>.</p>
      </div>}

      {loading ? (
        <div role="status" className="row-inline-wide text-description py-12"><RefreshCw className="icon-medium-spinner" />Loading email settings...</div>
      ) : !settings ? (
        <div role="alert" className="email-settings-panel">
          <p className="text-sm text-slate-700">{error}</p>
          <button onClick={() => setReload(value => value + 1)} className="link-underlined text-sm">Retry</button>
        </div>
      ) : (
        <form onSubmit={save} className="page-stack">
          <div className="surface-card email-editing-help">
            Click where you want a member detail in the subject or message, then choose a tag below that field. Tags insert automatically and are replaced with each member’s details when the email is sent.
          </div>

          <div className="email-editor-layout">
            <div className="section-stack">
              {emailTypes.map(({ key, title, description }) => (
                <section key={key} aria-labelledby={`${key}-title`} className="panel-responsive">
                  <div className="row-between-start mb-5">
                    <div>
                      <h2 id={`${key}-title`} className="card-title">{title}</h2>
                      <p className="text-help leading-relaxed">{description}</p>
                    </div>
                    <label className="row-inline email-toggle-label">
                      <input type="checkbox" checked={settings[key].enabled} onChange={event => update(key, 'enabled', event.target.checked)} disabled={saving} className="icon-default accent-brand-primary" aria-label={`Enable ${title.toLowerCase()}`} />Enabled
                    </label>
                  </div>
                  <fieldset disabled={saving} className="form-stack">
                    {key === 'renewal' && (
                      <div>
                        <label htmlFor="renewal-days" className="email-reminder-label">Send reminder before membership expires</label>
                        <div className="row-inline-wide">
                          <input id="renewal-days" type="number" min="1" max="365" step="1" required value={settings.renewal.daysBefore} onChange={event => update('renewal', 'daysBefore', event.target.value === '' ? '' : Number(event.target.value))} className={`${inputClass} max-w-24`} />
                          <span className="text-description">days before expiry</span>
                        </div>
                      </div>
                    )}
                    <EmailTemplateField id={`${key}-subject`} label="Email subject" templateTitle={title}
                      value={settings[key].subject} onChange={value => update(key, 'subject', value)} maxLength={160} />
                    <EmailTemplateField id={`${key}-body`} label="Message" templateTitle={title}
                      value={settings[key].body} onChange={value => update(key, 'body', value)} maxLength={5000} multiline />
                  </fieldset>
                  <button type="button" onClick={() => setPreviewType(key)} className="button-inline link-underlined email-disconnect"><Eye className="icon-default" />Preview {title.toLowerCase()}</button>
                </section>
              ))}
            </div>

            <aside aria-label="Email preview" className="table-frame email-preview-aside">
              <div className="email-preview-header">
                <h2 className="row-inline text-sm font-bold"><Eye className="icon-default" />Email preview</h2>
                <p className="page-description">Sample member details. Preview updates as you type.</p>
                <div className="email-preview-tabs" role="group" aria-label="Choose email preview">
                  {emailTypes.map(type => <button key={type.key} type="button" aria-pressed={previewType === type.key} onClick={() => setPreviewType(type.key)} className={`email-template-tab ${previewType === type.key ? "email-tab-selected" : "email-tab-idle"}`}>{type.title}</button>)}
                </div>
              </div>
              <div className="p-5 sm:p-6">
                {!preview.enabled && <p className="email-template-note">This email is disabled. Enable it and save to send automatically.</p>}
                <p className="text-caption mb-1">To: Alex Member</p>
                <p className="email-preview-title">{interpolateOrganisationEmail(preview.subject, previewContext)}</p>
                <p className="email-preview-content">{interpolateOrganisationEmail(preview.body, previewContext)}</p>
              </div>
            </aside>
          </div>

          <p className="text-caption">Emails respect each member's email notification preference. Members without an expiry date do not receive renewal reminders.</p>
          {error && <p role="alert" className="text-error email-error">{error}</p>}
          <div className="row-wrap-wide email-settings-actions">
            <p role="status" className="text-caption mr-auto">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
            <button type="submit" disabled={saving || !dirty} className="button-primary button-inline email-save">{saving ? <RefreshCw className="icon-spinner" /> : <Save className="icon-default" />}{saving ? 'Saving...' : 'Save email settings'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
