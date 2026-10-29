import React, { useState, useEffect } from 'react';
import { X, Layers, Save, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function TierModal({ isOpen, onClose, tierToEdit, onSaved }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState(49);
  const [interval, setInterval] = useState('monthly');
  const [description, setDescription] = useState('');
  const [perksText, setPerksText] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tierToEdit) {
      setName(tierToEdit.name || '');
      setPrice(tierToEdit.price || 0);
      setInterval(tierToEdit.interval || 'monthly');
      setDescription(tierToEdit.description || '');
      setPerksText((tierToEdit.perks || []).join('\n'));
      setMaxMembers(tierToEdit.maxMembers || '');
    } else {
      setName('');
      setPrice(49);
      setInterval('monthly');
      setDescription('');
      setPerksText('Access to monthly community meetups\nDigital membership pass in Google Wallet');
      setMaxMembers('');
    }
  }, [tierToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name,
      price: Number(price),
      interval,
      description,
      perks: perksText.split('\n').filter((p) => p.trim()),
      maxMembers: maxMembers ? Number(maxMembers) : null,
    };

    try {
      if (tierToEdit?._id) {
        await api.updateTier(tierToEdit._id, payload);
        showToast(`Tier "${name}" updated successfully.`, 'success');
      } else {
        await api.createTier(payload);
        showToast(`Tier "${name}" created successfully.`, 'success');
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to save tier.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary text-brand-ink">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {tierToEdit ? 'Modify Membership Tier' : 'Create Custom Membership Tier'}
              </h2>
              <p className="text-xs text-slate-500">Configure membership pricing, perks, and capacity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tier-name" className="block text-xs font-semibold text-slate-700 mb-1">Tier Name</label>
              <input
                id="tier-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diamond Patron"
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label htmlFor="tier-price" className="block text-xs font-semibold text-slate-700 mb-1">Price (MYR)</label>
              <input
                id="tier-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div>
            <div>
              <label htmlFor="tier-interval" className="block text-xs font-semibold text-slate-700 mb-1">Billing Interval</label>
              <select
                id="tier-interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tier-description" className="block text-xs font-semibold text-slate-700 mb-1">Short Description</label>
            <input
              id="tier-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Elevated perks for community patrons"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label htmlFor="tier-perks" className="block text-xs font-semibold text-slate-700 mb-1">
              Tier Perks (one benefit per line)
            </label>
            <textarea
              id="tier-perks"
              rows={4}
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              placeholder="Enter perk on each line..."
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary font-mono text-xs"
            />
          </div>

          <div>
            <div>
              <label htmlFor="tier-capacity" className="block text-xs font-semibold text-slate-700 mb-1">Max Member Capacity</label>
              <input
                id="tier-capacity"
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Tier Rules...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{tierToEdit ? 'Save Changes' : 'Create Tier'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
