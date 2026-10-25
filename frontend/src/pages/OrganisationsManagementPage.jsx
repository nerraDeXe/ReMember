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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-ink">
                My Organisations
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-ink border border-brand-primary/30">
                Public / Private Controls
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              Organisations & Visibility
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Manage your organisations and their visibility here. Open an organisation's admin portal to manage its members, tiers, events, and finances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openCreateModal}
              className="py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Organisation</span>
            </button>
          </div>
        </div>
      </div>

      <dl aria-label="Organisation summary" className="grid grid-cols-2 rounded-lg border border-slate-200 bg-white sm:grid-cols-4">
        <div className="min-w-0 px-4 py-3 sm:px-5">
          <dt className="text-xs font-medium text-slate-600">Total organisations</dt>
          <dd className="mt-1 text-[32px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums break-words md:text-[40px]">{organisations.length.toLocaleString()}</dd>
        </div>
        <div className="min-w-0 border-l border-slate-200 px-4 py-3 sm:px-5">
          <dt className="text-xs font-medium text-slate-600">Public</dt>
          <dd className="mt-1 text-[32px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums break-words md:text-[40px]">{publicCount.toLocaleString()}</dd>
        </div>
        <div className="min-w-0 border-t border-slate-200 px-4 py-3 sm:border-l sm:border-t-0 sm:px-5">
          <dt className="text-xs font-medium text-slate-600">Private</dt>
          <dd className="mt-1 text-[32px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums break-words md:text-[40px]">{privateCount.toLocaleString()}</dd>
        </div>
        <div className="min-w-0 border-l border-t border-slate-200 px-4 py-3 sm:border-t-0 sm:px-5">
          <dt className="text-xs font-medium text-slate-600">Community members</dt>
          <dd className="mt-1 text-[32px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums break-words md:text-[40px]">{totalMembers.toLocaleString()}</dd>
        </div>
      </dl>

      <div><h2 className="text-lg font-bold">Organisations You Own</h2><p className="text-xs text-slate-600 mt-1">Each organisation has its own administration portal.</p></div>
      {loadError && <div role="alert" className="flex items-center justify-between gap-3 bg-white border border-slate-300 rounded-lg p-4 text-sm"><p>{loadError}</p><button onClick={loadOrganisations} className="font-semibold underline">Retry</button></div>}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, or location..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">Visibility:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setVisibilityFilter('all')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                visibilityFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({organisations.length})
            </button>
            <button
              onClick={() => setVisibilityFilter('public')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                visibilityFilter === 'public'
                  ? 'bg-white text-brand-ink shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3 h-3 text-brand-ink" />
              Public ({publicCount})
            </button>
            <button
              onClick={() => setVisibilityFilter('private')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                visibilityFilter === 'private'
                  ? 'bg-white text-brand-ink shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3 h-3 text-brand-ink" />
              Private ({privateCount})
            </button>
          </div>
        </div>
      </div>

      {/* Organisations Table / Cards */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">LOADING ORGANISATIONS...</p>
        </div>
      ) : !loadError && filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 p-8">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Organisations Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No organisations matching your current filter. Create a new one or adjust your search.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 bg-brand-primary text-brand-ink text-xs font-bold rounded-lg hover:bg-brand-secondary transition-colors"
          >
            Create Organisation
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((org) => {
              const isPub = org.isPublic === true || org.visibility === 'public';
              const isToggling = togglingId === org._id;

              return (
                <div
                  key={org._id}
                  className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="w-12 h-12 rounded-xl border border-slate-200 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {org.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {org.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-1 mt-1 leading-relaxed">
                        {org.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {org.location}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Users className="w-3.5 h-3.5 text-brand-ink" />
                          {org.memberCount || 1} Members
                        </span>
                        {org.website && (
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-ink hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Link</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Visibility Switch & Actions */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <button disabled={!!openingId} onClick={() => openPortal(org._id, true)} aria-label={`Open admin portal for ${org.name}`} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink text-xs font-bold disabled:opacity-60">
                      {openingId === org._id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}Open Admin Portal
                    </button>
                    {/* Visibility Switch Controller */}
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isPub ? 'bg-brand-primary' : 'bg-brand-muted'
                            }`}
                          />
                          <span className="text-xs font-bold text-brand-ink">
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
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isPub ? 'bg-brand-primary' : 'bg-brand-silver'
                        }`}
                        title={isPub ? 'Click to make Private (Invite Only)' : 'Click to make Public'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isPub ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(org)}
                        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Edit Organisation"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrganisation(org)}
                        className="p-2 rounded-lg text-brand-ink hover:text-brand-ink hover:bg-slate-100 transition-colors"
                        title="Delete Organisation"
                      >
                        <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-muted/35">
          <div role="dialog" aria-modal="true" aria-label="Edit organisation" className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <p role={loading ? 'status' : 'alert'} className="text-sm text-slate-700">{loading ? 'Loading organisation...' : loadError || 'This organisation could not be found or you no longer own it.'}</p>
            <button onClick={closeEditModal} className="text-sm font-semibold text-brand-ink hover:underline">Back to organisations</button>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-muted/35 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-primary text-brand-ink flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingOrg ? 'Edit Organisation' : 'Create New Organisation'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure community profile and public or private invite visibility
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                aria-label="Close organisation editor"
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrganisation} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Visibility Choice Radio Cards (CRITICAL REQUIREMENT) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Organisation Access & Visibility Level *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setFormVisibility('public')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      formVisibility === 'public'
                        ? 'border-brand-primary bg-brand-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formVisibility === 'public'}
                      onChange={() => setFormVisibility('public')}
                      className="mt-0.5 accent-brand-primary text-brand-ink focus:ring-brand-primary"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-brand-ink" />
                        <span>Public Organisation</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        Discoverable on the Home Page public search. Open for prospective members to find and apply.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setFormVisibility('private')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      formVisibility === 'private'
                        ? 'border-brand-muted bg-slate-100/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={formVisibility === 'private'}
                      onChange={() => setFormVisibility('private')}
                      className="mt-0.5 accent-brand-primary text-brand-ink focus:ring-brand-primary"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-brand-ink" />
                        <span>Private / Invite Only</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        Strictly hidden from public home page search. Access is restricted to direct invite links or admin codes.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Organisation Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="e.g. Apex Tech Founders Alliance"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description *
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                  placeholder="Detail the mission, activities, and community vision of this organisation..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Location & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA & Hybrid"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Website</label>
                  <input
                    type="url"
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Tags & Join Requirements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="e.g. AI, Founders, DeepTech"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Join Requirements
                  </label>
                  <input
                    type="text"
                    value={formJoinRequirements}
                    onChange={(e) => setFormJoinRequirements(e.target.value)}
                    placeholder="e.g. Open enrollment / Invite by existing member"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Organisation images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImageUploadField label="Logo" kind="logo" value={formLogoUrl} onChange={setFormLogoUrl} onBusyChange={busy => setReadingImages(previous => ({ ...previous, logo: busy }))} disabled={saving} />
                <ImageUploadField label="Banner" kind="banner" value={formBannerUrl} onChange={setFormBannerUrl} onBusyChange={busy => setReadingImages(previous => ({ ...previous, banner: busy }))} disabled={saving} />
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || imagesBusy}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold bg-brand-primary hover:bg-brand-secondary text-brand-ink flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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
