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
      setPerksText('Access to monthly community meetups\nDigital membership card');
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
    <div className="dialog-overlay overflow-y-auto">
      <div className="surface-card tier-dialog">
        {/* Header */}
        <div className="row-between tier-dialog-header">
          <div className="row-inline-wide">
            <div className="tier-dialog-icon">
              <Layers className="icon-medium" />
            </div>
            <div>
              <h2 className="card-title">
                {tierToEdit ? 'Modify Membership Tier' : 'Create Custom Membership Tier'}
              </h2>
              <p className="text-caption">Configure membership pricing, perks, and capacity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="dialog-close-button"
          >
            <X className="icon-medium" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid-pair gap-4">
            <div>
              <label htmlFor="tier-name" className="label-compact">Tier Name</label>
              <input
                id="tier-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diamond Patron"
                required
                className="control control-standard control-focus"
              />
            </div>
            <div>
              <label htmlFor="tier-price" className="label-compact">Price (MYR)</label>
              <input
                id="tier-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="control control-standard control-focus"
              />
            </div>
          </div>

          <div>
            <div>
              <label htmlFor="tier-interval" className="label-compact">Billing Interval</label>
              <select
                id="tier-interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="control control-standard control-focus"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tier-description" className="label-compact">Short Description</label>
            <input
              id="tier-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Elevated perks for community patrons"
              className="control control-standard control-focus"
            />
          </div>

          <div>
            <label htmlFor="tier-perks" className="label-compact">
              Tier Perks (one benefit per line)
            </label>
            <textarea
              id="tier-perks"
              rows={4}
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              placeholder="Enter perk on each line..."
              className="control control-compact control-focus text-sm font-mono"
            />
          </div>

          <div>
            <div>
              <label htmlFor="tier-capacity" className="label-compact">Max Member Capacity</label>
              <input
                id="tier-capacity"
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                placeholder="Unlimited"
                className="control control-standard control-focus"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="button-primary button-content tier-dialog-save"
            >
              {saving ? (
                <>
                  <RefreshCw className="icon-spinner" />
                  <span>Saving Tier Rules...</span>
                </>
              ) : (
                <>
                  <Save className="icon-default" />
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
