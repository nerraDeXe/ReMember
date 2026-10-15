import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { User, Phone, MapPin, Mail, Save, RefreshCw, Bell, Shield, Upload, Trash2 } from 'lucide-react';
import { api } from '../../api.js';

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
      setCountry(user.address?.country || 'United States');
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
        phone,
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <User className="w-6 h-6 text-brand-ink" />
          Personal Member Profile
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your personal details stored in the MongoDB database and update notification settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Details Card */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-200">
            <div className="w-20 h-20 shrink-0 rounded-full border-2 border-brand-primary bg-slate-50" aria-label={avatarUrl ? `${name} profile photo` : 'No profile photo'}>
              {avatarUrl && <img src={avatarUrl} alt={`${name} profile`} className="w-full h-full rounded-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700 mb-1">Profile Photo</p>
              <p className="text-[11px] text-slate-500 mb-3">JPEG, PNG, or WebP. Maximum file size: 2 MB.</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
              {avatarFileName && <p className="text-[11px] text-slate-500 mt-2 truncate">Selected: {avatarFileName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-[10px] text-slate-500">(Account Identifier)</span>
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Membership Number
              </label>
              <input
                type="text"
                value={user?.membershipNumber || ''}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-brand-ink cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Personal Bio</label>
            <textarea
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
            <p className="text-[11px] text-slate-500 text-right mt-1">{bio.length}/500 characters</p>
          </div>
        </div>

        {/* Address Card */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-ink" />
            Mailing & Residence Address
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Community Blvd"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>
        </div>

        {/* Notifications Preferences */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-ink" />
            Automated Notification Preferences
          </h3>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="w-4 h-4 rounded text-brand-ink accent-brand-primary bg-white border-slate-300 cursor-pointer"
              />
              <span className="text-xs text-slate-700">
                Receive automated email receipts upon renewal payments and registration
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEvents}
                onChange={(e) => setNotifyEvents(e.target.checked)}
                className="w-4 h-4 rounded text-brand-ink accent-brand-primary bg-white border-slate-300 cursor-pointer"
              />
              <span className="text-xs text-slate-700">
                Receive instant RSVP confirmation emails with calendar invitations
              </span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="py-2.5 px-6 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-sm flex items-center gap-2 transition-colors shadow-sm active:scale-[0.99]"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to MongoDB...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
