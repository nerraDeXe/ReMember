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
    <div className="tier-modal-overlay">
      <div className="tier-modal-dialog">
        {/* Header */}
        <div className="tier-modal-header">
          <div className="tier-modal-heading">
            <div className="tier-modal-icon">
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
            className="tier-modal-close"
          >
            <X className="icon-medium" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="tier-modal-form">
          <div className="tier-modal-pricing-fields">
            <div>
              <label htmlFor="tier-name" className="tier-modal-field-label">Tier Name</label>
              <input
                id="tier-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diamond Patron"
                required
                className="tier-modal-input"
              />
            </div>
            <div>
              <label htmlFor="tier-price" className="tier-modal-field-label">Price (MYR)</label>
              <input
                id="tier-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="tier-modal-input"
              />
            </div>
          </div>

          <div>
            <div>
              <label htmlFor="tier-interval" className="tier-modal-field-label">Billing Interval</label>
              <select
                id="tier-interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="tier-modal-input"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tier-description" className="tier-modal-field-label">Short Description</label>
            <input
              id="tier-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Elevated perks for community patrons"
              className="tier-modal-input"
            />
          </div>

          <div>
            <label htmlFor="tier-perks" className="tier-modal-field-label">
              Tier Perks (one benefit per line)
            </label>
            <textarea
              id="tier-perks"
              rows={4}
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              placeholder="Enter perk on each line..."
              className="tier-modal-perks-input"
            />
          </div>

          <div>
            <div>
              <label htmlFor="tier-capacity" className="tier-modal-field-label">Max Member Capacity</label>
              <input
                id="tier-capacity"
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                placeholder="Unlimited"
                className="tier-modal-input"
              />
            </div>
          </div>

          <div className="tier-modal-footer">
            <button
              type="submit"
              disabled={saving}
              className="tier-modal-save"
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
