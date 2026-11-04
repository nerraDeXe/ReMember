import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Building2,
  Globe,
  MapPin,
  Users,
  ArrowRight,
  ExternalLink,
  X,
  CheckCircle2,
  Filter,
  Lock,
  IdCard
} from 'lucide-react';
import { api } from '../api.js';
import OrganisationImage from '../components/OrganisationImage.jsx';
import { filterOrganisations } from '../organisationDirectory.js';
import { useUrlQuery, useUrlState } from '../routing.jsx';

export default function LandingPage({ onNavigate }) {
  const [organisations, setOrganisations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [searchQuery, setSearchQuery] = useUrlState('search', '', { replace: true });
  const [selectedCategory, setSelectedCategory] = useUrlState('category', 'All', { replace: true });
  const [selectedOrgId, setSelectedOrgId] = useUrlState('organisationDetails');
  const { closeQuery } = useUrlQuery();
  const [loadError, setLoadError] = useState('');
  const selectedOrg = organisations.find(org => String(org._id) === selectedOrgId) || null;

  useEffect(() => {
    async function fetchOrganisations() {
      try {
        setLoadingOrgs(true);
        // Public search returns public organisations
        const data = await api.getOrganisations({ visibility: 'public' });
        if (data.success) {
          setOrganisations(data.organisations || []);
        }
      } catch (err) {
        setLoadError(err.message || 'Could not load public organisations.');
        console.error('Failed to load organisations:', err);
      } finally {
        setLoadingOrgs(false);
      }
    }
    fetchOrganisations();
  }, []);

  const categories = useMemo(() => {
    const list = Array.from(new Set(organisations.map((o) => o.category).filter(Boolean)));
    return ['All', ...list];
  }, [organisations]);

  const filteredOrganisations = useMemo(() => filterOrganisations(organisations, {
    search: searchQuery, category: selectedCategory, visibility: 'public'
  }), [organisations, selectedCategory, searchQuery]);


  return (
    <div className="page-background">
      {/* Top Bar */}
      <nav className="landing-header">
        <div className="row-between landing-header-content">
          <div className="row-inline-wide">

            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="landing-brand-logo"
            />
          </div>

          <div className="row-inline-wide">
            <button
              onClick={() => onNavigate('login')}
              className="button-small landing-signin"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="button-primary button-small transition-colors"
            >
              Join ReMember
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-12">
        <div className="landing-hero-content">
          {/* Hero Quick Search Shortcut */}
          <div className="landing-search-container">
            <div className="landing-search-field">
              <Search className="icon-medium landing-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search public organisations (e.g. AI, Climate, Arts, London)..."
                className="control-focus landing-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="landing-clear-search"
                >
                  <X className="icon-default" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Organisation Search & Discovery Section */}
      <section id="organisations" className="landing-directory">
        <div className="landing-directory-heading">
          <div>
            <div className="row-inline landing-eyebrow">
              <Building2 className="icon-default" />
              <span>Public Directory</span>
            </div>
            <h2 className="landing-section-heading">
              Browse Public Organisations
            </h2>
            <p className="page-description sm:text-sm">
              Admins configure whether organisations are open to the public or set to private invite.
            </p>
          </div>

          {/* Live Result Count */}
          <div className="landing-results-count">
            <span className="landing-results-dot" />
            <span>
              {loadingOrgs ? 'Loading organisations...' : `${filteredOrganisations.length} Public Organisation${filteredOrganisations.length === 1 ? '' : 's'} Available`}
            </span>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="landing-category-filters">
          <span className="row-icon landing-filter-label">
            <Filter className="icon-small" /> Filter:
          </span>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`landing-filter ${
                  isActive
                    ? "tab-selected"
                    : "landing-filter-idle"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Organisations Grid */}
        {loadingOrgs ? (
          <div className="py-16 text-center">
            <div className="directory-loading-spinner" />
            <p className="text-caption font-mono">LOADING PUBLIC ORGANISATIONS...</p>
          </div>
        ) : filteredOrganisations.length === 0 ? (
          <div className="surface-card landing-empty">
            <Building2 className="directory-no-results-icon" />
            <h3 className="directory-no-results-title">
              {organisations.length === 0 ? 'No Public Organisations Available' : 'No Matching Organisations Found'}
            </h3>
            <p className="page-description max-w-sm mx-auto">
              {organisations.length === 0
                ? 'No public organisations have been registered yet. Administrators can create organisations and set them as public to appear in this directory.'
                : `We couldn't find any public organisations matching "${searchQuery}". Organisations set to private invite are hidden from public search.`}
            </p>
            {organisations.length > 0 && (searchQuery || selectedCategory !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="button-muted button-small mt-4 transition-colors"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div className="landing-organisation-grid">
            {filteredOrganisations.map((org) => (
              <div
                key={org._id}
                className="surface-card landing-card group"
              >
                <div>
                  {/* Card Banner */}
                  <div className="landing-card-banner">
                    <OrganisationImage src={org.bannerUrl} kind="banner" alt={`${org.name} banner`} className="w-full h-full" imageClassName="landing-card-image" />
                    <div className="directory-banner-overlay" />
                    
                    {/* Public Visibility Badge */}
                    <div className="landing-card-public-position">
                      <span className="landing-card-public-badge">
                        <Globe className="icon-tiny" />
                        Public
                      </span>
                    </div>

                    {/* Category Tag */}
                    <div className="landing-card-category-position">
                      <span className="badge-small landing-category">
                        {org.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <div className="row-start mb-3">
                      <OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="surface-rounded landing-logo" />
                      <div className="flex-1 min-w-0">
                        <h3 className="card-title landing-card-title">
                          {org.name}
                        </h3>
                        <div className="row-inline-tight text-note mt-0.5">
                          <MapPin className="icon-tiny shrink-0 text-slate-400" />
                          <span className="truncate">{org.location}</span>
                        </div>
                      </div>
                    </div>

                    <p className="landing-card-description">
                      {org.description}
                    </p>

                    {/* Tags */}
                    {org.tags && org.tags.length > 0 && (
                      <div className="landing-card-tags">
                        {org.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="badge-small landing-card-tag"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="row-between landing-card-footer">
                  <div className="row-inline-tight text-hint-strong">
                    <Users className="icon-brand-small" />
                    <span>{org.memberCount || 1} Members</span>
                  </div>

                  <div className="row-inline">
                    <button
                      onClick={() => setSelectedOrgId(String(org._id))}
                      className="landing-details-button"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => onNavigate('register')}
                      className="landing-join-button"
                    >
                      <span>Join</span>
                      <ArrowRight className="icon-tiny" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Feature Highlights Grid */}
      <section className="landing-features">
        <div className="landing-content-width">
          <div className="landing-features-heading">
            <h2 className="landing-section-heading">
              Built for Public Communities & Private Invites
            </h2>
            <p className="text-caption sm:text-sm mt-2">
              Admins have complete control over public discoverability or private invitation access.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature hover:border-brand-primary/50">
              <div className="icon-center landing-feature-icon">
                <Globe className="icon-medium" />
              </div>
              <h3 className="card-title mb-2">Public Search & Discovery</h3>
              <p className="directory-detail-text">
                Members can search and explore any organisation set to public. Public organisations receive open discovery and instant applicant registration.
              </p>
            </div>

            <div className="landing-feature hover:border-brand-secondary/50">
              <div className="icon-center landing-feature-icon-secondary">
                <Lock className="icon-medium" />
              </div>
              <h3 className="card-title mb-2">Private Invite Controls</h3>
              <p className="directory-detail-text">
                Admins can toggle any organisation between Public and Private with 1 click. Private organisations are strictly hidden from public directories.
              </p>
            </div>

            <div className="landing-feature hover:border-brand-accent">
              <div className="icon-center landing-feature-icon-accent">
                <IdCard className="icon-medium" />
              </div>
              <h3 className="card-title mb-2">Membership Card</h3>
              <p className="directory-detail-text">
                View your membership card with your member ID, tier, status, and membership dates, styled in your organisation's colour.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Organisation Details Modal */}
      {selectedOrgId && !selectedOrg && (
        <div className="icon-center directory-overlay">
          <div role="dialog" aria-modal="true" aria-label="Organisation details" className="dialog-panel space-y-4">
            <p role={loadingOrgs ? 'status' : 'alert'} className="text-sm text-slate-700">{loadingOrgs ? 'Loading organisation...' : loadError || 'This public organisation could not be found.'}</p>
            <button onClick={() => closeQuery(['organisationDetails'])} className="link-brand text-sm">Back to directory</button>
          </div>
        </div>
      )}
      {selectedOrg && (
        <div className="icon-center directory-overlay">
          <div role="dialog" aria-modal="true" aria-label={`${selectedOrg.name} details`} className="surface-large directory-dialog">
            {/* Modal Header Banner */}
            <div className="directory-detail-banner">
              <OrganisationImage src={selectedOrg.bannerUrl} kind="banner" alt={`${selectedOrg.name} banner`} className="w-full h-full" />
              <div className="directory-banner-overlay" />
              <button
                onClick={() => closeQuery(['organisationDetails'])}
                aria-label="Close organisation details"
                className="icon-center directory-close"
              >
                <X className="icon-default" />
              </button>
              <div className="row-inline directory-detail-badges">
                <span className="row-icon directory-public-badge">
                  <Globe className="icon-tiny" />
                  Public Organisation
                </span>
                <span className="badge-small landing-category">
                  {selectedOrg.category}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="form-stack directory-dialog-content">
              <div className="directory-detail-heading">
                <OrganisationImage src={selectedOrg.logoUrl} alt={`${selectedOrg.name} logo`} className="directory-logo" />
                <div>
                  <h3 className="directory-detail-title">
                    {selectedOrg.name}
                  </h3>
                  <div className="row-inline-wide page-description">
                    <span className="row-icon">
                      <MapPin className="icon-small text-slate-400" />
                      {selectedOrg.location}
                    </span>
                    <span className="row-icon">
                      <Users className="icon-brand-small" />
                      {selectedOrg.memberCount} Members
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="directory-label mb-1.5">
                  About this Organisation
                </h4>
                <p className="directory-detail-description">
                  {selectedOrg.description}
                </p>
              </div>

              <div className="directory-membership-note">
                <h4 className="row-inline-tight directory-membership-heading">
                  <CheckCircle2 className="icon-brand-small" />
                  Join Requirements & Policy
                </h4>
                <p className="directory-detail-text">
                  {selectedOrg.joinRequirements || 'Open enrollment for verified members with an in-app membership card.'}
                </p>
              </div>

              {selectedOrg.tags && selectedOrg.tags.length > 0 && (
                <div>
                  <h4 className="directory-label mb-2">
                    Community Focus & Tags
                  </h4>
                  <div className="tag-list">
                    {selectedOrg.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="directory-tag"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="row-between directory-footer">
              {selectedOrg.website ? (
                <a
                  href={selectedOrg.website}
                  target="_blank"
                  rel="noreferrer"
                  className="row-icon text-hint-strong hover:text-brand-ink"
                >
                  <ExternalLink className="icon-small" />
                  <span>Visit Website</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400">Official ReMember Network Partner</span>
              )}

              <div className="row-inline">
                <button
                  onClick={() => closeQuery(['organisationDetails'])}
                  className="button-small directory-back-button"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onNavigate('register');
                  }}
                  className="button-primary row-inline-tight directory-join-button"
                >
                  <span>Apply & Join</span>
                  <ArrowRight className="icon-small" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-caption landing-footer">
        <p>ReMember Community Management System &copy; 2026. Public Directory & Private Invite Network.</p>
      </footer>
    </div>
  );
}
