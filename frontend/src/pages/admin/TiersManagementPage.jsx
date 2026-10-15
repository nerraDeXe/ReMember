import React, { useState, useEffect } from 'react';
import { getTierBadgeColor } from '../../theme.js';
import { Layers, Plus, Edit2, Trash2, Check, RefreshCw } from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import TierModal from '../../components/TierModal.jsx';

export default function TiersManagementPage() {
  const { showToast } = useToast();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);

  const loadTiers = async () => {
    try {
      const data = await api.getTiers();
      if (data.success) {
        setTiers(data.tiers || []);
      }
    } catch (err) {
      console.error('Failed to load tiers:', err);
      showToast('Could not load tiers: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
  }, []);

  const handleDeleteTier = async (tier) => {
    if (!window.confirm(`Are you sure you want to delete tier "${tier.name}"?`)) return;

    try {
      const response = await api.deleteTier(tier._id);
      if (response.success) {
        showToast(response.message, 'success');
        await loadTiers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete tier.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-ink" />
            Custom Membership Tiers & Pricing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, modify, and delete custom membership tiers, pricing intervals, and exclusive perks.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTier(null);
            setModalOpen(true);
          }}
          className="py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Tier</span>
        </button>
      </div>

      {/* Tiers Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier._id}
              className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors relative group"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getTierBadgeColor(tier) }}
                    />
                    <h3 className="text-base font-bold text-slate-900">{tier.name}</h3>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                    Lvl {tier.accessLevel || 1}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-black text-slate-900">${tier.price}</span>
                  <span className="text-xs text-slate-500 ml-1">/{tier.interval}</span>
                </div>

                <p className="text-xs text-slate-600 mb-5 leading-relaxed min-h-[36px]">
                  {tier.description || 'No description provided.'}
                </p>

                {/* Perks List */}
                <div className="space-y-2 pt-4 border-t border-slate-100 text-xs">
                  {(tier.perks || []).map((perk, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-brand-ink shrink-0 mt-0.5" />
                      <span className="text-slate-700">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingTier(tier);
                    setModalOpen(true);
                  }}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Modify Tier Rules"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteTier(tier)}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-brand-silver text-brand-ink text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Delete Tier"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tier Create/Edit Modal */}
      <TierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        tierToEdit={editingTier}
        onSaved={loadTiers}
      />
    </div>
  );
}
