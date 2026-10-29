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
          events: notifyEvents
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
    <div className="profile-page">
      <div>
        <h1 className="page-title">
          <User className="profile-user-icon" />
          Personal Member Profile
        </h1>
        <p className="page-description">
          Manage your personal details stored in the MongoDB database and update notification settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="page-stack">
        {/* Profile Details Card */}
        <div className="profile-personal-details">
          <div className="profile-avatar-section">
            <div role="img" className="profile-avatar" aria-label={avatarUrl ? `${name} profile photo` : 'Default profile icon'}>
              {avatarUrl ? <img src={avatarUrl} alt={`${name} profile`} className="profile-avatar-image" /> : <User className="profile-avatar-placeholder" aria-hidden="true" />}
            </div>
            <div className="profile-avatar-controls">
              <p className="profile-avatar-label">Profile Photo</p>
              <p className="profile-avatar-requirements">JPEG, PNG, or WebP. Maximum file size: 2 MB.</p>
              <div className="profile-avatar-actions">
                <label className="profile-avatar-upload-button">
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
                    className="profile-avatar-remove-button"
                  >
                    <Trash2 className="icon-default" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
              {avatarFileName && <p className="profile-avatar-selected-file">Selected: {avatarFileName}</p>}
            </div>
          </div>

          <div className="profile-personal-fields">
            <div>
              <label className="field-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="profile-name-input"
              />
            </div>

            <div>
              <label className="field-label">
                Email Address <span className="profile-email-hint">(Account Identifier)</span>
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="profile-email-input"
              />
            </div>
          </div>

          <div className="profile-personal-fields">
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
                className="profile-member-number-input"
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
              className="profile-detail-input"
            />
            <p className="profile-bio-character-count">{bio.length}/500 characters</p>
          </div>
        </div>

        {/* Address Card */}
        <div className="profile-address-panel">
          <h3 className="profile-panel-title">
            <MapPin className="profile-panel-icon" />
            Mailing & Residence Address
          </h3>

          <div>
            <label className="profile-address-label">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Community Blvd"
              className="profile-detail-input"
            />
          </div>

          <div className="profile-address-fields">
            {[
              { id: 'profile-city', label: 'City', value: city, update: setCity },
              { id: 'profile-state', label: 'State / Province', value: state, update: setState },
              { id: 'profile-postal-code', label: 'Postal Code', value: postalCode, update: setPostalCode },
            ].map(({ id, label, value, update }) => (
              <div key={id}>
                <label htmlFor={id} className="profile-address-label">{label}</label>
                <input id={id} type="text" value={value} onChange={event => update(event.target.value)}
                  className="profile-detail-input" />
              </div>
            ))}
            <div>
              <label htmlFor="profile-country" className="profile-address-label">Country</label>
              <CountrySelect id="profile-country" value={country} onChange={value => { setPhone(previous => rebasePhone(previous, country, value)); setCountry(value); }} required disabled={saving} />
            </div>
          </div>
        </div>

        {/* Notifications Preferences */}
        <div className="profile-notifications-panel">
          <h3 className="profile-panel-title">
            <Bell className="profile-panel-icon" />
            Automated Notification Preferences
          </h3>

          <div className="profile-notification-options">
            {[
              { label: 'Receive welcome emails, renewal reminders and payment receipts', checked: notifyEmail, update: setNotifyEmail },
              { label: 'Receive instant RSVP confirmation emails with calendar invitations', checked: notifyEvents, update: setNotifyEvents },
            ].map(({ label, checked, update }) => (
              <label key={label} className="profile-notification-option">
                <input type="checkbox" checked={checked} onChange={event => update(event.target.checked)}
                  className="profile-notification-checkbox" />
                <span className="profile-notification-label">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="profile-form-actions">
          <button
            type="submit"
            disabled={saving}
            className="profile-save-button"
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
