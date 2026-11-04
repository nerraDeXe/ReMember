import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Building2,
  Globe,
  Lock,
  Plus,
  Search,
  Users,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { api } from '../api.js';
import OrganisationImage from '../components/OrganisationImage.jsx';
import ImageUploadField from '../components/ImageUploadField.jsx';
import { filterOrganisations } from '../organisationDirectory.js';
import { useNavigation, useUrlQuery, useUrlState } from '../routing.jsx';

export default function OrganisationsManagementPage({ onNavigate }) {
  const { user, refreshUser, selectOrganisation } = useAuth();
  const { showToast } = useToast();
  const { route, getSnapshot } = useNavigation();
  const editorRoute = useRef(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useUrlState('search', '', { replace: true });
  const [visibilityFilter, setVisibilityFilter] = useUrlState('visibility', 'all', { replace: true });
  const [openingId, setOpeningId] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Modal state
  const [editingOrgId, setEditingOrgId] = useUrlState('orgEdit');
  const { closeQuery } = useUrlQuery();
  const editingOrg = organisations.find(org => String(org._id) === editingOrgId) || null;
  const isModalOpen = !!editingOrg;
  const closeEditModal = () => closeQuery(['orgEdit']);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Technology & AI');
  const [formDescription, setFormDescription] = useState('');
  const [formVisibility, setFormVisibility] = useState('public'); // 'public' | 'private'
  const [formLocation, setFormLocation] = useState('Global Network');
  const [formWebsite, setFormWebsite] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formJoinRequirements, setFormJoinRequirements] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formBannerUrl, setFormBannerUrl] = useState('');
  const [readingImages, setReadingImages] = useState({ logo: false, banner: false });
  const imagesBusy = readingImages.logo || readingImages.banner;

  const loadOrganisations = async () => {
    try {
      setLoading(true);
      setLoadError('');
      // This account page lists only organisations owned by the signed-in user.
      const data = await api.getOrganisations({ mine: true, visibility: 'all' });
      if (data.success) {
        setOrganisations((data.organisations || []).filter(org => String(org.adminId) === String(user._id)));
      }
    } catch (err) {
      setLoadError(err.message || 'Could not load your organisations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
  }, []);

  const openPortal = async (organisationId, owner = false) => {
    const openingRoute = getSnapshot();
    setOpeningId(organisationId);
    try {
      const account = await selectOrganisation(organisationId);
      if (owner && account.organisationRole !== 'owner') throw new Error('You no longer own this organisation.');
      if (getSnapshot() === openingRoute) onNavigate(account.organisationRole === 'owner' ? 'admin-dashboard' : 'member-dashboard');
    } catch (err) {
      showToast(err.message || 'Could not open this organisation.', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  const openCreateModal = () => {
    onNavigate('organisation-setup');
  };

  useEffect(() => {
    if (!editingOrg) { editorRoute.current = null; return; }
    if (editorRoute.current === route) return;
    editorRoute.current = route;
    const org = editingOrg;
    setFormName(org.name || '');
    setFormCategory(org.category || 'General');
    setFormDescription(org.description || '');
    setFormVisibility(org.isPublic || org.visibility === 'public' ? 'public' : 'private');
    setFormLocation(org.location || 'Global Network');
    setFormWebsite(org.website || '');
    setFormTags(Array.isArray(org.tags) ? org.tags.join(', ') : '');
    setFormJoinRequirements(org.joinRequirements || '');
    setFormLogoUrl(org.logoUrl || '');
    setFormBannerUrl(org.bannerUrl || '');
    setReadingImages({ logo: false, banner: false });
  }, [editingOrg, route]);

  const openEditModal = (org) => setEditingOrgId(String(org._id));

  // Toggle Public / Private visibility
  const handleToggleVisibility = async (org) => {
    const newIsPublic = !org.isPublic;
    const newVisibility = newIsPublic ? 'public' : 'private';
    setTogglingId(org._id);

    try {
      const res = await api.updateOrganisationVisibility(org._id, newIsPublic);
      if (res.success) {
        // Update local state
        setOrganisations((prev) =>
          prev.map((o) =>
            o._id === org._id
              ? { ...o, isPublic: newIsPublic, visibility: newVisibility }
              : o
          )
        );
        showToast(
          `"${org.name}" is now set to ${newVisibility.toUpperCase()} (${newIsPublic ? 'Visible in public search' : 'Hidden from public search, Invite-Only'})`,
          'success'
        );
      }
    } catch (err) {
      showToast('Failed to update visibility: ' + err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveOrganisation = async (e) => {
    e.preventDefault();
    if (saving || imagesBusy) return;
    if (!formName.trim() || !formDescription.trim()) {
      showToast('Please provide an organisation name and description.', 'error');
      return;
    }

    const submittedRoute = getSnapshot();
    setSaving(true);
    const isPub = formVisibility === 'public';
    const payload = {
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim(),
      visibility: formVisibility,
      isPublic: isPub,
      location: formLocation.trim(),
      website: formWebsite.trim(),
      tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
      joinRequirements: formJoinRequirements.trim(),
      logoUrl: formLogoUrl,
      bannerUrl: formBannerUrl
    };

    try {
      const res = await api.updateOrganisation(editingOrg._id, payload);
      if (res.success) {
        showToast(`Organisation "${payload.name}" updated successfully.`, 'success');
        if (getSnapshot() === submittedRoute) closeEditModal();
        await loadOrganisations();
        await refreshUser();
      }
    } catch (err) {
      showToast('Error saving organisation: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrganisation = async (org) => {
    if (!window.confirm(`Are you sure you want to delete organisation "${org.name}"?`)) {
      return;
    }

    try {
      const res = await api.deleteOrganisation(org._id);
      if (res.success) {
        showToast(`Organisation "${org.name}" deleted successfully.`, 'success');
        setOrganisations((prev) => prev.filter((o) => o._id !== org._id));
        await refreshUser();
      }
    } catch (err) {
      showToast('Failed to delete organisation: ' + err.message, 'error');
    }
  };

  // Filter organisations
  const filtered = useMemo(() => filterOrganisations(organisations, {
    search, visibility: visibilityFilter, fields: ['name', 'description', 'category', 'location']
  }), [organisations, search, visibilityFilter]);

  const publicCount = organisations.filter((o) => o.isPublic || o.visibility === 'public').length;
  const privateCount = organisations.filter((o) => !o.isPublic && o.visibility === 'private').length;
  const totalMembers = organisations.reduce((sum, o) => sum + (o.memberCount || 0), 0);

  return (
    <div className="page-stack">
      {/* Header Banner */}
      <div className="panel-card">
        <div className="management-header">
          <div>
            <h1 className="organisation-metric-total">
              Organisations & Visibility
            </h1>
            <p className="text-help max-w-2xl">
              Manage your organisations and their visibility here. Open an organisation's admin portal to manage its members, tiers, events, and finances.
            </p>
          </div>

          <div className="row-wrap-wide">
            <button
              onClick={openCreateModal}
              className="button-primary row-inline management-add-button"
            >
              <Plus className="icon-default" />
              <span>Create New Organisation</span>
            </button>
          </div>
        </div>
      </div>

      <dl aria-label="Organisation summary" className="surface-rounded grid-pair sm:grid-cols-4">
        <div className="organisation-metric-cell-first">
          <dt className="text-hint">Total organisations</dt>
          <dd className="metric-summary">{organisations.length.toLocaleString()}</dd>
        </div>
        <div className="organisation-metric-cell">
          <dt className="text-hint">Public</dt>
          <dd className="metric-summary">{publicCount.toLocaleString()}</dd>
        </div>
        <div className="organisation-metric-cell-lower">
          <dt className="text-hint">Private</dt>
          <dd className="metric-summary">{privateCount.toLocaleString()}</dd>
        </div>
        <div className="organisation-metric-cell-last">
          <dt className="text-hint">Community members</dt>
          <dd className="metric-summary">{totalMembers.toLocaleString()}</dd>
        </div>
      </dl>

      <div><h2 className="text-lg font-bold">Organisations You Own</h2><p className="text-help">Each organisation has its own administration portal.</p></div>
      {loadError && <div role="alert" className="row-inline-wide organisation-error"><p>{loadError}</p><button onClick={loadOrganisations} className="link-underlined">Retry</button></div>}

      {/* Filter and Search Bar */}
      <div className="surface-card row-inline-wide organisation-toolbar">
        <div className="organisation-search-field">
          <Search className="icon-default control-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, or location..."
            className="surface-muted control-focus organisation-search"
          />
        </div>

        <div className="row-inline w-full sm:w-auto">
          <span className="text-label-muted">Visibility:</span>
          <div className="surface-muted organisation-view-tabs">
            <button
              onClick={() => setVisibilityFilter('all')}
              className={`organisation-view-tab ${
                visibilityFilter === 'all'
                  ? 'orgs-filter-all-active'
                  : "organisation-view-tab-idle"
              }`}
            >
              All ({organisations.length})
            </button>
            <button
              onClick={() => setVisibilityFilter('public')}
              className={`row-icon organisation-view-tab ${
                visibilityFilter === 'public'
                  ? 'orgs-filter-visibility-active'
                  : "organisation-view-tab-idle"
              }`}
            >
              <Globe className="icon-tiny text-brand-ink" />
              Public ({publicCount})
            </button>
            <button
              onClick={() => setVisibilityFilter('private')}
              className={`row-icon organisation-view-tab ${
                visibilityFilter === 'private'
                  ? 'orgs-filter-visibility-active'
                  : "organisation-view-tab-idle"
              }`}
            >
              <Lock className="icon-tiny text-brand-ink" />
              Private ({privateCount})
            </button>
          </div>
        </div>
      </div>

      {/* Organisations Table / Cards */}
      {loading ? (
        <div className="surface-card py-20 text-center">
          <div className="directory-loading-spinner" />
          <p className="text-caption font-mono">LOADING ORGANISATIONS...</p>
        </div>
      ) : !loadError && filtered.length === 0 ? (
        <div className="surface-card organisation-no-results">
          <Building2 className="directory-no-results-icon" />
          <h3 className="directory-no-results-title">No Organisations Found</h3>
          <p className="page-description max-w-sm mx-auto">
            No organisations matching your current filter. Create a new one or adjust your search.
          </p>
          <button
            onClick={openCreateModal}
            className="button-primary button-small mt-4 transition-colors"
          >
            Create Organisation
          </button>
        </div>
      ) : (
        <div className="table-frame">
          <div className="table-body">
            {filtered.map((org) => {
              const isPub = org.isPublic === true || org.visibility === 'public';
              const isToggling = togglingId === org._id;

              return (
                <div
                  key={org._id}
                  className="organisation-row"
                >
                  {/* Left: Info */}
                  <div className="organisation-row-details">
                    <OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="organisation-logo" />
                    <div className="min-w-0">
                      <div className="row-wrap">
                        <h3 className="panel-title truncate">
                          {org.name}
                        </h3>
                        <span className="badge-small organisation-visibility">
                          {org.category}
                        </span>
                      </div>

                      <p className="text-help line-clamp-1 leading-relaxed">
                        {org.description}
                      </p>

                      <div className="text-caption organisation-meta">
                        <span className="row-icon">
                          <MapPin className="icon-small text-slate-400" />
                          {org.location}
                        </span>
                        <span className="row-icon font-semibold text-slate-700">
                          <Users className="icon-brand-small" />
                          {org.memberCount || 1} Members
                        </span>
                        {org.website && (
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noreferrer"
                            className="row-icon text-brand-ink hover:underline"
                          >
                            <ExternalLink className="icon-tiny" />
                            <span>Link</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Visibility Switch & Actions */}
                  <div className="row-between organisation-actions">
                    <button disabled={!!openingId} onClick={() => openPortal(org._id, true)} aria-label={`Open admin portal for ${org.name}`} className="button-primary button-content organisation-portal-button">
                      {openingId === org._id ? <RefreshCw className="icon-spinner" /> : <ArrowRight className="icon-default" />}Open Admin Portal
                    </button>
                    {/* Visibility Switch Controller */}
                    <div className="organisation-visibility-control">
                      <div className="text-right">
                        <div className="row-inline-tight justify-end">
                          <span
                            className={`organisation-visibility-dot ${
                              isPub ? "organisation-state-public" : "organisation-state-private"
                            }`}
                          />
                          <span className="organisation-visibility-label">
                            {isPub ? 'Public' : 'Private'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {isPub ? 'Searchable by members' : 'Invite-only, hidden from search'}
                        </p>
                      </div>

                      {/* Interactive Toggle Button */}
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleVisibility(org)}
                        className={`visibility-switch ${
                          isPub ? "organisation-state-public" : "organisation-switch-private"
                        }`}
                        title={isPub ? 'Click to make Private (Invite Only)' : 'Click to make Public'}
                      >
                        <span
                          className={`icon-medium visibility-switch-thumb ${
                            isPub ? "organisation-switch-on" : "organisation-switch-off"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="row-inline-tight">
                      <button
                        onClick={() => openEditModal(org)}
                        className="organisation-edit-button"
                        title="Edit Organisation"
                      >
                        <Edit2 className="icon-default" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrganisation(org)}
                        className="organisation-delete-button"
                        title="Delete Organisation"
                      >
                        <Trash2 className="icon-default" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Organisation Modal */}
      {editingOrgId && !editingOrg && (
        <div className="dialog-overlay">
          <div role="dialog" aria-modal="true" aria-label="Edit organisation" className="dialog-panel space-y-4">
            <p role={loading ? 'status' : 'alert'} className="text-sm text-slate-700">{loading ? 'Loading organisation...' : loadError || 'This organisation could not be found or you no longer own it.'}</p>
            <button onClick={closeEditModal} className="link-brand text-sm">Back to organisations</button>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="dialog-overlay">
          <div className="surface-large directory-dialog">
            <div className="row-between organisation-editor-header">
              <div className="row-inline">
                <div className="icon-center organisation-editor-icon">
                  <Building2 className="icon-default" />
                </div>
                <div>
                  <h3 className="card-title">
                    {editingOrg ? 'Edit Organisation' : 'Create New Organisation'}
                  </h3>
                  <p className="text-note">
                    Configure community profile and public or private invite visibility
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                aria-label="Close organisation editor"
                className="organisation-editor-close"
              >
                <X className="icon-medium" />
              </button>
            </div>

            <form onSubmit={handleSaveOrganisation} className="form-stack directory-dialog-content">
              {/* Visibility Choice Radio Cards (CRITICAL REQUIREMENT) */}
              <div>
                <label className="organisation-visibility-heading">
                  Organisation Access & Visibility Level *
                </label>
                <div className="organisation-choice-grid">
                  <label
                    onClick={() => setFormVisibility('public')}
                    className={`row-start organisation-visibility-choice ${
                      formVisibility === 'public'
                        ? 'orgs-visibility-public-active'
                        : "organisation-visibility-idle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formVisibility === 'public'}
                      onChange={() => setFormVisibility('public')}
                      className="organisation-visibility-radio"
                    />
                    <div>
                      <div className="row-inline-tight heading-small">
                        <Globe className="icon-brand-small" />
                        <span>Public Organisation</span>
                      </div>
                      <p className="text-note mt-1 leading-snug">
                        Discoverable on the Home Page public search. Open for prospective members to find and apply.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setFormVisibility('private')}
                    className={`row-start organisation-visibility-choice ${
                      formVisibility === 'private'
                        ? 'orgs-visibility-private-active'
                        : "organisation-visibility-idle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={formVisibility === 'private'}
                      onChange={() => setFormVisibility('private')}
                      className="organisation-visibility-radio"
                    />
                    <div>
                      <div className="row-inline-tight heading-small">
                        <Lock className="icon-brand-small" />
                        <span>Private / Invite Only</span>
                      </div>
                      <p className="text-note mt-1 leading-snug">
                        Strictly hidden from public home page search. Access is restricted to direct invite links or admin codes.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Name & Category */}
              <div className="form-grid">
                <div>
                  <label className="field-label">
                    Organisation Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="e.g. Apex Tech Founders Alliance"
                    className="control control-small control-focus"
                  />
                </div>

                <div>
                  <label className="field-label">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="control control-small control-focus"
                  >
                    <option value="Technology & AI">Technology & AI</option>
                    <option value="Arts & Culture">Arts & Culture</option>
                    <option value="Sustainability & Impact">Sustainability & Impact</option>
                    <option value="Science & Healthcare">Science & Healthcare</option>
                    <option value="Executive Leadership">Executive Leadership</option>
                    <option value="Deep Tech & Cryptography">Deep Tech & Cryptography</option>
                    <option value="Community & Networking">Community & Networking</option>
                    <option value="Sports & Wellness">Sports & Wellness</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="field-label">
                  Description *
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                  placeholder="Detail the mission, activities, and community vision of this organisation..."
                  className="control control-small control-focus"
                />
              </div>

              {/* Location & Website */}
              <div className="form-grid">
                <div>
                  <label className="field-label">Location</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA & Hybrid"
                    className="control control-small control-focus"
                  />
                </div>

                <div>
                  <label className="field-label">Website</label>
                  <input
                    type="url"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="control control-small control-focus"
                  />
                </div>
              </div>

              {/* Tags & Join Requirements */}
              <div className="form-grid">
                <div>
                  <label className="field-label">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="e.g. AI, Founders, DeepTech"
                    className="control control-small control-focus"
                  />
                </div>

                <div>
                  <label className="field-label">
                    Join Requirements
                  </label>
                  <input
                    type="text"
                    value={formJoinRequirements}
                    onChange={(e) => setFormJoinRequirements(e.target.value)}
                    placeholder="e.g. Open enrollment / Invite by existing member"
                    className="control control-small control-focus"
                  />
                </div>
              </div>

              {/* Organisation images */}
              <div className="form-grid">
                <ImageUploadField label="Logo" kind="logo" value={formLogoUrl} onChange={setFormLogoUrl} onBusyChange={busy => setReadingImages(previous => ({ ...previous, logo: busy }))} disabled={saving} />
                <ImageUploadField label="Banner" kind="banner" value={formBannerUrl} onChange={setFormBannerUrl} onBusyChange={busy => setReadingImages(previous => ({ ...previous, banner: busy }))} disabled={saving} />
              </div>

              {/* Modal Buttons */}
              <div className="row-inline-wide organisation-editor-actions">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="organisation-editor-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || imagesBusy}
                  className="button-primary row-inline-tight organisation-editor-save"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="icon-small-spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingOrg ? 'Save Changes' : 'Create Organisation'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
