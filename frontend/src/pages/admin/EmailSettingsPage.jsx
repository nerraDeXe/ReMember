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

const inputClass = "email-settings-input";
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
        <p className="email-settings-introduction">Customise member emails for <strong>{organisationName}</strong>.</p>
      </div>}

      {loading ? (
        <div role="status" className="email-settings-loading"><RefreshCw className="email-settings-spinner" />Loading email settings...</div>
      ) : !settings ? (
        <div role="alert" className="email-settings-load-error">
          <p className="email-settings-load-error-message">{error}</p>
          <button onClick={() => setReload(value => value + 1)} className="email-settings-retry-button">Retry</button>
        </div>
      ) : (
        <form onSubmit={save} className="page-stack">
          <div className="email-settings-delivery-notice">
            Click where you want a member detail in the subject or message, then choose a tag below that field. Tags insert automatically and are replaced with each member’s details when the email is sent.
          </div>

          <div className="email-settings-workspace">
            <div className="section-stack">
              {emailTypes.map(({ key, title, description }) => (
                <section key={key} aria-labelledby={`${key}-title`} className="email-settings-template">
                  <div className="email-settings-template-heading">
                    <div>
                      <h2 id={`${key}-title`} className="card-title">{title}</h2>
                      <p className="email-settings-template-description">{description}</p>
                    </div>
                    <label className="email-settings-enabled-toggle">
                      <input type="checkbox" checked={settings[key].enabled} onChange={event => update(key, 'enabled', event.target.checked)} disabled={saving} className="email-settings-checkbox" aria-label={`Enable ${title.toLowerCase()}`} />Enabled
                    </label>
                  </div>
                  <fieldset disabled={saving} className="form-stack">
                    {key === 'renewal' && (
                      <div>
                        <label htmlFor="renewal-days" className="email-settings-reminder-label">Send reminder before membership expires</label>
                        <div className="email-settings-reminder-timing">
                          <input id="renewal-days" type="number" min="1" max="365" step="1" required value={settings.renewal.daysBefore} onChange={event => update('renewal', 'daysBefore', event.target.value === '' ? '' : Number(event.target.value))} className={`${inputClass} email-settings-renewal-days`} />
                          <span className="text-description">days before expiry</span>
                        </div>
                      </div>
                    )}
                    <EmailTemplateField id={`${key}-subject`} label="Email subject" templateTitle={title}
                      value={settings[key].subject} onChange={value => update(key, 'subject', value)} maxLength={160} />
                    <EmailTemplateField id={`${key}-body`} label="Message" templateTitle={title}
                      value={settings[key].body} onChange={value => update(key, 'body', value)} maxLength={5000} multiline />
                  </fieldset>
                  <button type="button" onClick={() => setPreviewType(key)} className="email-settings-preview-button"><Eye className="icon-default" />Preview {title.toLowerCase()}</button>
                </section>
              ))}
            </div>

            <aside aria-label="Email preview" className="email-settings-preview">
              <div className="email-settings-preview-header">
                <h2 className="email-settings-preview-title"><Eye className="icon-default" />Email preview</h2>
                <p className="page-description">Sample member details. Preview updates as you type.</p>
                <div className="email-settings-preview-tabs" role="group" aria-label="Choose email preview">
                  {emailTypes.map(type => <button key={type.key} type="button" aria-pressed={previewType === type.key} onClick={() => setPreviewType(type.key)} className={`email-settings-preview-tab ${previewType === type.key ? "email-settings-preview-tab-selected" : "email-settings-preview-tab-idle"}`}>{type.title}</button>)}
                </div>
              </div>
              <div className="email-settings-preview-content">
                {!preview.enabled && <p className="email-settings-preview-disabled-notice">This email is disabled. Enable it and save to send automatically.</p>}
                <p className="email-settings-preview-recipient">To: Alex Member</p>
                <p className="email-settings-preview-subject">{interpolateOrganisationEmail(preview.subject, previewContext)}</p>
                <p className="email-settings-preview-body">{interpolateOrganisationEmail(preview.body, previewContext)}</p>
              </div>
            </aside>
          </div>

          <p className="text-caption">Emails respect each member's email notification preference. Members without an expiry date do not receive renewal reminders.</p>
          {error && <p role="alert" className="email-settings-save-error">{error}</p>}
          <div className="email-settings-save-footer">
            <p role="status" className="email-settings-save-status">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
            <button type="submit" disabled={saving || !dirty} className="email-settings-save-button">{saving ? <RefreshCw className="icon-spinner" /> : <Save className="icon-default" />}{saving ? 'Saving...' : 'Save email settings'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
