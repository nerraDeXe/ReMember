import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { User, MapPin, Save, RefreshCw, Bell, Upload, Trash2 } from 'lucide-react';
import { api } from '../../api.js';
import CountrySelect from '../../components/CountrySelect.jsx';
import PhoneInput from '../../components/PhoneInput.jsx';
import { normalisePhone, rebasePhone } from '../../phone.js';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyEvents, setNotifyEvents] = useState(true);
  const [eventReminderDays, setEventReminderDays] = useState(['7', '1']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
      setStreet(user.address?.street || '');
      setCity(user.address?.city || '');
      setState(user.address?.state || '');
      setPostalCode(user.address?.postalCode || '');
      setCountry(user.country || user.address?.country || '');
      setNotifyEmail(user.notifications?.email ?? true);
      setNotifyEvents(user.notifications?.events ?? true);
      setEventReminderDays((user.notifications?.eventReminderDays ?? [7, 1]).map(String));
    }
  }, [user]);

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showToast('Choose a JPEG, PNG, or WebP image.', 'error');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      showToast('Profile photos must be 2 MB or smaller.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result));
      setAvatarFileName(file.name);
    };
    reader.onerror = () => showToast('Could not read the selected image.', 'error');
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = () => {
    setAvatarUrl('');
    setAvatarFileName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const reminderDays = eventReminderDays.map(Number);
    const invalidReminderDays = reminderDays.some(days => !Number.isInteger(days) || days < 1 || days > 365) || new Set(reminderDays).size !== reminderDays.length;
    if (notifyEvents && invalidReminderDays) {
      showToast('Choose different reminder times between 1 and 365 days before an event.', 'error');
      return;
    }
    setSaving(true);

    try {
      const payload = {
        name,
        phone: normalisePhone(phone, country),
        bio,
        avatarUrl,
        address: {
          street,
          city,
          state,
          postalCode,
          country
        },
        notifications: {
          email: notifyEmail,
          events: notifyEvents,
          eventReminderDays: invalidReminderDays ? (user.notifications?.eventReminderDays ?? [7, 1]) : reminderDays
        }
      };

      const response = await api.updateProfile(payload);
      if (response.success) {
        showToast('Profile information successfully saved to MongoDB database!', 'success');
        await refreshUser();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack profile-page">
      <div>
        <h1 className="page-title">
          <User className="icon-brand-large" />
          Personal Member Profile
        </h1>
        <p className="page-description">
          Manage your personal details stored in the MongoDB database and update notification settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="page-stack">
        {/* Profile Details Card */}
        <div className="panel-card page-stack">
          <div className="profile-photo-section">
            <div role="img" className="icon-center profile-avatar" aria-label={avatarUrl ? `${name} profile photo` : 'Default profile icon'}>
              {avatarUrl ? <img src={avatarUrl} alt={`${name} profile`} className="avatar-photo" /> : <User className="profile-default-avatar" aria-hidden="true" />}
            </div>
            <div className="flex-1">
              <p className="profile-photo-label">Profile Photo</p>
              <p className="text-note mb-3">JPEG, PNG, or WebP. Maximum file size: 2 MB.</p>
              <div className="row-wrap">
                <label className="button-primary button-inline button-small cursor-pointer transition-colors">
                  <Upload className="icon-default" />
                  <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="sr-only"
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    className="button-muted button-inline button-small transition-colors"
                  >
                    <Trash2 className="icon-default" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
              {avatarFileName && <p className="text-note mt-2 truncate">Selected: {avatarFileName}</p>}
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label className="field-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="control-input px-3.5"
              />
            </div>

            <div>
              <label className="field-label">
                Email Address <span className="text-[10px] text-slate-500">(Account Identifier)</span>
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="surface-muted control-standard profile-email"
              />
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label htmlFor="profile-phone" className="field-label">Phone Number (optional)</label>
              <PhoneInput id="profile-phone" country={country} value={phone} onChange={setPhone} disabled={saving} />
            </div>

            <div>
              <label className="field-label">
                Membership Number
              </label>
              <input
                type="text"
                value={user?.membershipNumber || ''}
                disabled
                className="surface-muted control-standard profile-membership-id"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Personal Bio</label>
            <textarea
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="control control-ring control-compact"
            />
            <p className="text-note profile-bio-count">{bio.length}/500 characters</p>
          </div>
        </div>

        {/* Address Card */}
        <div className="panel-card form-stack">
          <h3 className="row-inline panel-title">
            <MapPin className="icon-brand" />
            Mailing & Residence Address
          </h3>

          <div>
            <label className="label-compact">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Community Blvd"
              className="control control-ring control-compact"
            />
          </div>

          <div className="profile-address-grid">
            {[
              { id: 'profile-city', label: 'City', value: city, update: setCity },
              { id: 'profile-state', label: 'State / Province', value: state, update: setState },
              { id: 'profile-postal-code', label: 'Postal Code', value: postalCode, update: setPostalCode },
            ].map(({ id, label, value, update }) => (
              <div key={id}>
                <label htmlFor={id} className="label-compact">{label}</label>
                <input id={id} type="text" value={value} onChange={event => update(event.target.value)}
                  className="control control-ring control-compact" />
              </div>
            ))}
            <div>
              <label htmlFor="profile-country" className="label-compact">Country</label>
              <CountrySelect id="profile-country" value={country} onChange={value => { setPhone(previous => rebasePhone(previous, country, value)); setCountry(value); }} required disabled={saving} />
            </div>
          </div>
        </div>

        {/* Notifications Preferences */}
        <div className="panel-card content-stack">
          <h3 className="row-inline panel-title">
            <Bell className="icon-brand" />
            Automated Notification Preferences
          </h3>

          <div className="content-stack pt-2">
            {[
              { label: 'Receive welcome emails, renewal reminders and payment receipts', checked: notifyEmail, update: setNotifyEmail },
              { label: 'Receive event reminders and RSVP confirmation emails with calendar invitations', checked: notifyEvents, update: setNotifyEvents },
            ].map(({ label, checked, update }) => (
              <label key={label} className="row-inline-wide cursor-pointer">
                <input type="checkbox" checked={checked} onChange={event => update(event.target.checked)}
                  className="icon-brand profile-checkbox" />
                <span className="text-xs text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          <fieldset disabled={!notifyEvents || saving} className="form-stack mt-5">
            <legend className="field-label">Upcoming event reminders</legend>
            <p className="text-note">Get a notification before an upcoming event. The defaults are one week and one day before it starts.</p>
            {eventReminderDays.map((days, index) => (
              <div key={index} className="row-wrap">
                <label htmlFor={`event-reminder-${index}`} className="text-xs text-slate-700">Reminder {index + 1}</label>
                <input id={`event-reminder-${index}`} type="number" min="1" max="365" step="1" required
                  value={days} onChange={event => setEventReminderDays(previous => previous.map((value, position) => position === index ? event.target.value : value))}
                  className="control-input w-24 px-3" />
                <span className="text-xs text-slate-700">days before</span>
                <button type="button" aria-label={`Remove reminder ${index + 1}`}
                  onClick={() => setEventReminderDays(previous => previous.filter((_, position) => position !== index))}
                  className="button-muted button-inline button-small"><Trash2 className="icon-small" aria-hidden="true" />Remove</button>
              </div>
            ))}
            {eventReminderDays.length === 0 && <p className="text-note">No upcoming event reminders are scheduled.</p>}
            {eventReminderDays.length < 5 && <button type="button" className="button-muted button-inline button-small"
              onClick={() => setEventReminderDays(previous => [...previous, String([7, 1, 3, 14, 30].find(days => !previous.map(Number).includes(days)))])}>
              <Bell className="icon-small" aria-hidden="true" />Add reminder
            </button>}
            <p className="text-note">Choose up to five different times, from 1 to 365 days before an event. Remove all reminders to turn them off.</p>
          </fieldset>
        </div>

        {/* Save Button */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={saving}
            className="button-primary row-inline profile-save"
          >
            {saving ? (
              <>
                <RefreshCw className="icon-spinner" />
                <span>Saving to MongoDB...</span>
              </>
            ) : (
              <>
                <Save className="icon-default" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
