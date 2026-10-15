import React, { useState } from 'react';
import { X, Calendar, Plus, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function EventModal({ isOpen, onClose, onCreated, tiers = [] }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-11-25');
  const [time, setTime] = useState('18:30 - 21:30 EST');
  const [location, setLocation] = useState('Executive Penthouse & Live Webcast');
  const [category, setCategory] = useState('Networking');
  const [capacity, setCapacity] = useState(100);
  const [selectedTiers, setSelectedTiers] = useState([]);
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleTier = (tierName) => {
    setSelectedTiers((prev) =>
      prev.includes(tierName) ? prev.filter((t) => t !== tierName) : [...prev, tierName]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.createEvent({
        title,
        description,
        date,
        time,
        location,
        category,
        capacity: Number(capacity),
        allowedTiers: selectedTiers,
        imageUrl,
      });

      if (response.success) {
        showToast(`Event "${title}" published!`, 'success');
        if (onCreated) onCreated();
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-brand-primary text-brand-ink">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create Community Event</h2>
              <p className="text-xs text-slate-500">Specify dates, capacity limits, and tier access requirements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Artificial Intelligence Leadership Gala 2026"
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe event agenda, speakers, and venue details..."
              required
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Event Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Range</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="18:00 - 21:00 EST"
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Venue</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ballroom or Virtual Link"
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity Limit</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min="1"
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Tier Access Level Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Eligible Membership Tiers for RSVP
            </label>
            <div className="flex flex-wrap gap-2">
              {tiers.map((tier) => {
                const tName = tier.name;
                const isSelected = selectedTiers.includes(tName);
                return (
                  <button
                    key={tName}
                    type="button"
                    onClick={() => toggleTier(tName)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                      isSelected
                        ? 'bg-brand-50 border-brand-primary text-brand-ink'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '} {tName}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Select tiers to restrict access, or leave all unselected to allow every active member.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Header Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing Event...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Publish Community Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
