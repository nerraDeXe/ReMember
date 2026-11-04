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
    <div className="page-stack">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Layers className="icon-brand-large" />
            Custom Membership Tiers & Pricing
          </h1>
          <p className="page-description">
            Create, modify, and delete custom membership tiers, pricing intervals, and exclusive perks.
          </p>
        </div>

        <button
          onClick={() => setTierRoute('new')}
          disabled={loading || Boolean(loadError)}
          className="button-primary row-inline tiers-add-button"
        >
          <Plus className="icon-default" />
          <span>Add Membership Tier</span>
        </button>
      </div>

      {!loading && !loadError && <form onSubmit={saveBadgeAccent} aria-labelledby="membership-badge-accent-title" className="panel-compact">
        <div className="tiers-accent-layout">
          <div className="content-stack">
            <div>
              <h2 id="membership-badge-accent-title" className="panel-title">Membership badge accent</h2>
              <p className="page-description">One badge colour for all membership tiers in this organisation.</p>
            </div>
            <div className="row-inline-wide">
              <input type="color" aria-label="Membership badge accent colour picker" value={/^#[0-9a-f]{6}$/i.test(badgeColor) ? badgeColor : savedBadgeColor} onChange={event => { setBadgeColor(event.target.value); setAccentError(''); setAccentMessage(''); }} disabled={savingAccent} className="tiers-color-picker" />
              <div>
                <label htmlFor="membership-badge-accent" className="label-compact">Badge accent hex colour</label>
                <input id="membership-badge-accent" type="text" value={badgeColor} onChange={event => { setBadgeColor(event.target.value); setAccentError(''); setAccentMessage(''); }} disabled={savingAccent} maxLength={7} spellCheck={false} aria-describedby="membership-badge-accent-help" aria-invalid={Boolean(accentError)} className="control-focus tiers-color-input" />
              </div>
            </div>
            <p id="membership-badge-accent-help" className="text-caption">Applies to all membership badges in this organisation.</p>
          </div>
          <button type="submit" disabled={savingAccent || badgeColor.trim().toUpperCase() === savedBadgeColor.toUpperCase()} className="button-primary button-inline tiers-accent-save">
            {savingAccent ? <RefreshCw className="icon-spinner" /> : <Save className="icon-default" />}
            {savingAccent ? 'Saving badge accent...' : 'Save badge accent'}
          </button>
        </div>
        {accentError && <p role="alert" className="tiers-accent-error">{accentError}</p>}
        {accentMessage && <p role="status" className="tiers-accent-message">{accentMessage}</p>}
      </form>}

      {/* Tiers Grid */}
      {loading ? (
        <div className="loading-container">
          <RefreshCw className="loading-spinner" />
        </div>
      ) : loadError ? (
        <div role="alert" className="surface-card text-description p-5">
          <p>{loadError}</p><button onClick={loadTiers} className="link-underlined mt-3">Retry</button>
        </div>
      ) : (
        <div className="tiers-grid">
          {tiers.map((tier) => (
            <div
              key={tier._id}
              className="panel-card tier-card group"
            >
              <div>
                {/* Header */}
                <div className="row-between mb-3">
                  <div className="row-inline">
                    <span
                      className="icon-tiny rounded-full"
                      aria-label={`${tier.name} badge accent`}
                      style={{ backgroundColor: savedBadgeColor }}
                    />
                    <h3 className="card-title">{tier.name}</h3>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="tier-price">MYR {tier.price}</span>
                  <span className="text-caption ml-1">/{tier.interval}</span>
                </div>

                <p className="tier-description">
                  {tier.description || 'No description provided.'}
                </p>

                {/* Perks List */}
                <div className="detail-stack tier-perks">
                  {(tier.perks || []).map((perk, i) => (
                    <div key={i} className="tier-perk">
                      <Check className="icon-brand-small shrink-0 mt-0.5" />
                      <span className="text-slate-700">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="row-inline tier-actions">
                <button
                  onClick={() => setTierRoute(tier._id)}
                  className="button-muted-bordered row-icon tier-edit-button"
                  title="Modify Tier Rules"
                >
                  <Edit2 className="icon-small" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteTier(tier)}
                  className="button-icon-brand row-icon tier-delete-button"
                  title="Delete Tier"
                >
                  <Trash2 className="icon-small" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tier Create/Edit Modal */}
      {tierRoute && tierRoute !== 'new' && !loading && !editingTier && (
        <div role="alert" className="surface-card text-description p-5">
          <p>{loadError || 'This membership tier could not be found. It may have been removed.'}</p>
          <button onClick={closeEditor} className="link-underlined mt-3 text-brand-ink">Return to tiers</button>
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
