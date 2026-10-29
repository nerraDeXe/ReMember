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
        <div className="orgs-header">
          <div>
            <h1 className="orgs-title">
              Organisations & Visibility
            </h1>
            <p className="orgs-intro">
              Manage your organisations and their visibility here. Open an organisation's admin portal to manage its members, tiers, events, and finances.
            </p>
          </div>

          <div className="orgs-header-actions">
            <button
              onClick={openCreateModal}
              className="orgs-create"
            >
              <Plus className="icon-default" />
              <span>Create New Organisation</span>
            </button>
          </div>
        </div>
      </div>

      <dl aria-label="Organisation summary" className="orgs-summary">
        <div className="orgs-stat-total">
          <dt className="orgs-stat-label">Total organisations</dt>
          <dd className="orgs-stat-value">{organisations.length.toLocaleString()}</dd>
        </div>
        <div className="orgs-stat-public">
          <dt className="orgs-stat-label">Public</dt>
          <dd className="orgs-stat-value">{publicCount.toLocaleString()}</dd>
        </div>
        <div className="orgs-stat-private">
          <dt className="orgs-stat-label">Private</dt>
          <dd className="orgs-stat-value">{privateCount.toLocaleString()}</dd>
        </div>
        <div className="orgs-stat-members">
          <dt className="orgs-stat-label">Community members</dt>
          <dd className="orgs-stat-value">{totalMembers.toLocaleString()}</dd>
        </div>
      </dl>

      <div><h2 className="orgs-list-heading">Organisations You Own</h2><p className="orgs-list-description">Each organisation has its own administration portal.</p></div>
      {loadError && <div role="alert" className="orgs-load-error"><p>{loadError}</p><button onClick={loadOrganisations} className="orgs-retry">Retry</button></div>}

      {/* Filter and Search Bar */}
      <div className="orgs-filters">
        <div className="orgs-search">
          <Search className="orgs-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, or location..."
            className="orgs-search-input"
          />
        </div>

        <div className="orgs-visibility-filter">
          <span className="orgs-filter-label">Visibility:</span>
          <div className="orgs-filter-options">
            <button
              onClick={() => setVisibilityFilter('all')}
              className={`orgs-filter-all ${
                visibilityFilter === 'all'
                  ? 'orgs-filter-all-active'
                  : "orgs-filter-idle"
              }`}
            >
              All ({organisations.length})
            </button>
            <button
              onClick={() => setVisibilityFilter('public')}
              className={`orgs-filter-option ${
                visibilityFilter === 'public'
                  ? 'orgs-filter-visibility-active'
                  : "orgs-filter-idle"
              }`}
            >
              <Globe className="orgs-filter-icon" />
              Public ({publicCount})
            </button>
            <button
              onClick={() => setVisibilityFilter('private')}
              className={`orgs-filter-option ${
                visibilityFilter === 'private'
                  ? 'orgs-filter-visibility-active'
                  : "orgs-filter-idle"
              }`}
            >
              <Lock className="orgs-filter-icon" />
              Private ({privateCount})
            </button>
          </div>
        </div>
      </div>

      {/* Organisations Table / Cards */}
      {loading ? (
        <div className="orgs-loading">
          <div className="directory-loading-spinner" />
          <p className="orgs-loading-message">LOADING ORGANISATIONS...</p>
        </div>
      ) : !loadError && filtered.length === 0 ? (
        <div className="orgs-empty">
          <Building2 className="orgs-empty-icon" />
          <h3 className="orgs-empty-title">No Organisations Found</h3>
          <p className="orgs-empty-description">
            No organisations matching your current filter. Create a new one or adjust your search.
          </p>
          <button
            onClick={openCreateModal}
            className="orgs-create-first"
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
                  className="orgs-list-item"
                >
                  {/* Left: Info */}
                  <div className="orgs-identity">
                    <OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="orgs-logo" />
                    <div className="orgs-details">
                      <div className="orgs-name-row">
                        <h3 className="orgs-name">
                          {org.name}
                        </h3>
                        <span className="orgs-category">
                          {org.category}
                        </span>
                      </div>

                      <p className="orgs-description">
                        {org.description}
                      </p>

                      <div className="orgs-metadata">
                        <span className="orgs-location">
                          <MapPin className="orgs-location-icon" />
                          {org.location}
                        </span>
                        <span className="orgs-member-count">
                          <Users className="orgs-detail-icon" />
                          {org.memberCount || 1} Members
                        </span>
                        {org.website && (
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noreferrer"
                            className="orgs-website"
                          >
                            <ExternalLink className="icon-tiny" />
                            <span>Link</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Visibility Switch & Actions */}
                  <div className="orgs-actions">
                    <button disabled={!!openingId} onClick={() => openPortal(org._id, true)} aria-label={`Open admin portal for ${org.name}`} className="orgs-open-portal">
                      {openingId === org._id ? <RefreshCw className="icon-spinner" /> : <ArrowRight className="icon-default" />}Open Admin Portal
                    </button>
                    {/* Visibility Switch Controller */}
                    <div className="orgs-visibility-control">
                      <div className="orgs-visibility-summary">
                        <div className="orgs-visibility-heading">
                          <span
                            className={`orgs-visibility-dot ${
                              isPub ? "orgs-visibility-public" : "orgs-visibility-private"
                            }`}
                          />
                          <span className="orgs-visibility-title">
                            {isPub ? 'Public' : 'Private'}
                          </span>
                        </div>
                        <p className="orgs-visibility-description">
                          {isPub ? 'Searchable by members' : 'Invite-only, hidden from search'}
                        </p>
                      </div>

                      {/* Interactive Toggle Button */}
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleVisibility(org)}
                        className={`orgs-visibility-switch ${
                          isPub ? "orgs-visibility-public" : "orgs-switch-off"
                        }`}
                        title={isPub ? 'Click to make Private (Invite Only)' : 'Click to make Public'}
                      >
                        <span
                          className={`orgs-switch-thumb ${
                            isPub ? "orgs-thumb-on" : "orgs-thumb-off"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="orgs-edit-actions">
                      <button
                        onClick={() => openEditModal(org)}
                        className="orgs-edit"
                        title="Edit Organisation"
                      >
                        <Edit2 className="icon-default" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrganisation(org)}
                        className="orgs-delete"
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
        <div className="orgs-editor-overlay">
          <div role="dialog" aria-modal="true" aria-label="Edit organisation" className="orgs-editor-status">
            <p role={loading ? 'status' : 'alert'} className="orgs-editor-message">{loading ? 'Loading organisation...' : loadError || 'This organisation could not be found or you no longer own it.'}</p>
            <button onClick={closeEditModal} className="orgs-back-to-list">Back to organisations</button>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="orgs-editor-overlay">
          <div className="orgs-editor">
            <div className="orgs-editor-header">
              <div className="orgs-editor-heading">
                <div className="orgs-editor-icon">
                  <Building2 className="icon-default" />
                </div>
                <div>
                  <h3 className="card-title">
                    {editingOrg ? 'Edit Organisation' : 'Create New Organisation'}
                  </h3>
                  <p className="orgs-editor-subtitle">
                    Configure community profile and public or private invite visibility
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                aria-label="Close organisation editor"
                className="orgs-editor-close"
              >
                <X className="icon-medium" />
              </button>
            </div>

            <form onSubmit={handleSaveOrganisation} className="orgs-editor-form">
              {/* Visibility Choice Radio Cards (CRITICAL REQUIREMENT) */}
              <div>
                <label className="orgs-visibility-legend">
                  Organisation Access & Visibility Level *
                </label>
                <div className="orgs-visibility-options">
                  <label
                    onClick={() => setFormVisibility('public')}
                    className={`orgs-visibility-option ${
                      formVisibility === 'public'
                        ? 'orgs-visibility-public-active'
                        : "orgs-visibility-option-idle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formVisibility === 'public'}
                      onChange={() => setFormVisibility('public')}
                      className="orgs-visibility-radio"
                    />
                    <div>
                      <div className="orgs-visibility-option-title">
                        <Globe className="orgs-detail-icon" />
                        <span>Public Organisation</span>
                      </div>
                      <p className="orgs-visibility-option-description">
                        Discoverable on the Home Page public search. Open for prospective members to find and apply.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setFormVisibility('private')}
                    className={`orgs-visibility-option ${
                      formVisibility === 'private'
                        ? 'orgs-visibility-private-active'
                        : "orgs-visibility-option-idle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={formVisibility === 'private'}
                      onChange={() => setFormVisibility('private')}
                      className="orgs-visibility-radio"
                    />
                    <div>
                      <div className="orgs-visibility-option-title">
                        <Lock className="orgs-detail-icon" />
                        <span>Private / Invite Only</span>
                      </div>
                      <p className="orgs-visibility-option-description">
                        Strictly hidden from public home page search. Access is restricted to direct invite links or admin codes.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Name & Category */}
              <div className="orgs-editor-fields">
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
                    className="orgs-editor-input"
                  />
                </div>

                <div>
                  <label className="field-label">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="orgs-editor-input"
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
                  className="orgs-editor-input"
                />
              </div>

              {/* Location & Website */}
              <div className="orgs-editor-fields">
                <div>
                  <label className="field-label">Location</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA & Hybrid"
                    className="orgs-editor-input"
                  />
                </div>

                <div>
                  <label className="field-label">Website</label>
                  <input
                    type="url"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="orgs-editor-input"
                  />
                </div>
              </div>

              {/* Tags & Join Requirements */}
              <div className="orgs-editor-fields">
                <div>
                  <label className="field-label">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="e.g. AI, Founders, DeepTech"
                    className="orgs-editor-input"
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
                    className="orgs-editor-input"
                  />
                </div>
              </div>

              {/* Organisation images */}
              <div className="orgs-editor-fields">
                <ImageUploadField label="Logo" kind="logo" value={formLogoUrl} onChange={setFormLogoUrl} onBusyChange={busy => setReadingImages(previous => ({ ...previous, logo: busy }))} disabled={saving} />
                <ImageUploadField label="Banner" kind="banner" value={formBannerUrl} onChange={setFormBannerUrl} onBusyChange={busy => setReadingImages(previous => ({ ...previous, banner: busy }))} disabled={saving} />
              </div>

              {/* Modal Buttons */}
              <div className="orgs-editor-footer">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="orgs-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || imagesBusy}
                  className="orgs-save"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="orgs-save-spinner" />
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
