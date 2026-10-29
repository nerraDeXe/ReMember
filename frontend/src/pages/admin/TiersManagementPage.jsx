import React, { useState, useEffect, useRef } from 'react';
import { getOrganisationBadgeColor } from '../../theme.js';
import { Layers, Plus, Edit2, Trash2, Check, RefreshCw, Save } from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import TierModal from '../../components/TierModal.jsx';
import { useUrlState, useNavigation } from '../../routing.jsx';

export default function TiersManagementPage() {
  const { showToast } = useToast();
  const { user, getCurrentUser } = useAuth();
  const organisationId = user?.activeOrganisationId;
  const [result, setResult] = useState(null);
  const [requestLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [badgeColor, setBadgeColor] = useState('#FFD700');
  const [savingAccent, setSavingAccent] = useState(false);
  const [accentMessage, setAccentMessage] = useState('');
  const [accentError, setAccentError] = useState('');
  const [tierRoute, setTierRoute] = useUrlState('tier');
  const { route, getSnapshot, closeQuery } = useNavigation();
  const mounted = useRef(false);
  const requestRevision = useRef(0);
  const currentResult = result?.organisationId === organisationId ? result : null;
  const tiers = currentResult?.tiers || [];
  const loading = requestLoading || (!currentResult && !loadError);
  const savedBadgeColor = getOrganisationBadgeColor(currentResult?.organisation);
  const editingTier = tiers.find(tier => tier._id === tierRoute) || null;
  const closeEditor = () => {
    if (mounted.current && getSnapshot() === route) closeQuery(['tier']);
  };

  const loadTiers = () => setRevision(value => value + 1);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestRevision.current += 1;
    setLoading(true);
    setLoadError('');
    setSavingAccent(false);
    setAccentMessage('');
    setAccentError('');
    Promise.all([api.getTiers(organisationId), api.getOrganisation(organisationId)]).then(([data, organisationData]) => {
      if (!data.success) throw new Error(data.message || 'Could not load tiers.');
      if (!organisationData.success || !organisationData.organisation) throw new Error(organisationData.message || 'Could not load the organisation badge accent.');
      if (cancelled) return;
      setResult({ organisationId, tiers: data.tiers || [], organisation: organisationData.organisation });
      setBadgeColor(getOrganisationBadgeColor(organisationData.organisation));
    }).catch(error => {
      if (!cancelled) setLoadError(error.message || 'Could not load membership settings.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; requestRevision.current += 1; };
  }, [organisationId, revision]);

  const saveBadgeAccent = async event => {
    event.preventDefault();
    const colour = badgeColor.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(colour)) {
      setAccentError('Enter a six-digit hex colour, such as #FFD700.');
      setAccentMessage('');
      return;
    }
    const expectedUserId = user?._id;
    const expectedRevision = requestRevision.current;
    const isCurrent = () => mounted.current && requestRevision.current === expectedRevision && getCurrentUser()?._id === expectedUserId && getCurrentUser()?.activeOrganisationId === organisationId;
    if (!isCurrent()) return;
    setSavingAccent(true);
    setAccentError('');
    setAccentMessage('');
    try {
      const response = await api.updateOrganisation(organisationId, { badgeColor: colour });
      if (!response.success || !response.organisation) throw new Error(response.message || 'Could not save the badge accent.');
      if (!isCurrent()) return;
      setResult(previous => previous?.organisationId === organisationId ? { ...previous, organisation: response.organisation } : previous);
      setBadgeColor(getOrganisationBadgeColor(response.organisation));
      setAccentMessage('Badge accent saved for every membership in this organisation.');
    } catch (error) {
      if (isCurrent()) setAccentError(error.message || 'Could not save the badge accent.');
    } finally {
      if (isCurrent()) setSavingAccent(false);
    }
  };

  const handleDeleteTier = async (tier) => {
    if (!window.confirm(`Are you sure you want to delete tier "${tier.name}"?`)) return;

    try {
      const response = await api.deleteTier(tier._id);
      if (!mounted.current || getCurrentUser()?.activeOrganisationId !== organisationId) return;
      if (response.success) {
        showToast(response.message, 'success');
        loadTiers();
      }
    } catch (err) {
      if (mounted.current && getCurrentUser()?.activeOrganisationId === organisationId) showToast(err.message || 'Failed to delete tier.', 'error');
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
          onClick={() => setTierRoute('new')}
          disabled={loading || Boolean(loadError)}
          className="py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Membership Tier</span>
        </button>
      </div>

      {!loading && !loadError && <form onSubmit={saveBadgeAccent} aria-labelledby="membership-badge-accent-title" className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="space-y-3">
            <div>
              <h2 id="membership-badge-accent-title" className="text-sm font-bold text-slate-900">Membership badge accent</h2>
              <p className="text-xs text-slate-500 mt-1">One badge colour for all membership tiers in this organisation.</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="color" aria-label="Membership badge accent colour picker" value={/^#[0-9a-f]{6}$/i.test(badgeColor) ? badgeColor : savedBadgeColor} onChange={event => { setBadgeColor(event.target.value); setAccentError(''); setAccentMessage(''); }} disabled={savingAccent} className="h-10 w-14 shrink-0 rounded cursor-pointer bg-white border border-slate-300 p-1" />
              <div>
                <label htmlFor="membership-badge-accent" className="block text-xs font-semibold text-slate-700 mb-1">Badge accent hex colour</label>
                <input id="membership-badge-accent" type="text" value={badgeColor} onChange={event => { setBadgeColor(event.target.value); setAccentError(''); setAccentMessage(''); }} disabled={savingAccent} maxLength={7} spellCheck={false} aria-describedby="membership-badge-accent-help" aria-invalid={Boolean(accentError)} className="w-36 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono focus:outline-none focus:border-brand-primary" />
              </div>
            </div>
            <p id="membership-badge-accent-help" className="text-xs text-slate-500">Applies to all membership badges in this organisation.</p>
          </div>
          <button type="submit" disabled={savingAccent || badgeColor.trim().toUpperCase() === savedBadgeColor.toUpperCase()} className="inline-flex self-start sm:self-auto items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-brand-ink hover:bg-brand-secondary disabled:opacity-50">
            {savingAccent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingAccent ? 'Saving badge accent...' : 'Save badge accent'}
          </button>
        </div>
        {accentError && <p role="alert" className="mt-3 text-xs text-red-700">{accentError}</p>}
        {accentMessage && <p role="status" className="mt-3 text-xs text-green-700">{accentMessage}</p>}
      </form>}

      {/* Tiers Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <p>{loadError}</p><button onClick={loadTiers} className="mt-3 font-semibold underline">Retry</button>
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
                      aria-label={`${tier.name} badge accent`}
                      style={{ backgroundColor: savedBadgeColor }}
                    />
                    <h3 className="text-base font-bold text-slate-900">{tier.name}</h3>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-black text-slate-900">MYR {tier.price}</span>
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
                  onClick={() => setTierRoute(tier._id)}
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
      {tierRoute && tierRoute !== 'new' && !loading && !editingTier && (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <p>{loadError || 'This membership tier could not be found. It may have been removed.'}</p>
          <button onClick={closeEditor} className="mt-3 font-semibold text-brand-ink underline">Return to tiers</button>
        </div>
      )}
      <TierModal
        key={`${organisationId}-${tierRoute}`}
        isOpen={!loading && !loadError && Boolean(tierRoute) && (tierRoute === 'new' || Boolean(editingTier))}
        onClose={closeEditor}
        tierToEdit={editingTier}
        onSaved={() => { if (mounted.current && getSnapshot() === route) loadTiers(); }}
      />
    </div>
  );
}
