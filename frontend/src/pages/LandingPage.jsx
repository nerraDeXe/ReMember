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
  Wallet
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
    <div className="landing-page">
      {/* Top Bar */}
      <nav className="landing-navbar">
        <div className="landing-navbar-content">
          <div className="landing-navbar-actions">

            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="landing-logo"
            />
          </div>

          <div className="landing-navbar-actions">
            <button
              onClick={() => onNavigate('login')}
              className="landing-signin"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="landing-signup"
            >
              Join ReMember
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          {/* Hero Quick Search Shortcut */}
          <div className="landing-search">
            <div className="landing-search-field">
              <Search className="landing-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search public organisations (e.g. AI, Climate, Arts, London)..."
                className="landing-search-input"
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
            <div className="landing-directory-label">
              <Building2 className="icon-default" />
              <span>Public Directory</span>
            </div>
            <h2 className="landing-heading">
              Browse Public Organisations
            </h2>
            <p className="landing-directory-description">
              Admins configure whether organisations are open to the public or set to private invite.
            </p>
          </div>

          {/* Live Result Count */}
          <div className="landing-results-count">
            <span className="landing-results-indicator" />
            <span>
              {loadingOrgs ? 'Loading organisations...' : `${filteredOrganisations.length} Public Organisation${filteredOrganisations.length === 1 ? '' : 's'} Available`}
            </span>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="landing-category-filters">
          <span className="landing-filter-label">
            <Filter className="icon-small" /> Filter:
          </span>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`landing-category-filter ${
                  isActive
                    ? "landing-category-active"
                    : "landing-category-idle"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Organisations Grid */}
        {loadingOrgs ? (
          <div className="landing-loading">
            <div className="directory-loading-spinner" />
            <p className="landing-loading-message">LOADING PUBLIC ORGANISATIONS...</p>
          </div>
        ) : filteredOrganisations.length === 0 ? (
          <div className="landing-empty">
            <Building2 className="landing-empty-icon" />
            <h3 className="landing-empty-title">
              {organisations.length === 0 ? 'No Public Organisations Available' : 'No Matching Organisations Found'}
            </h3>
            <p className="landing-empty-description">
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
                className="landing-clear-filters"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div className="landing-cards">
            {filteredOrganisations.map((org) => (
              <div
                key={org._id}
                className="group landing-card"
              >
                <div>
                  {/* Card Banner */}
                  <div className="landing-card-banner">
                    <OrganisationImage src={org.bannerUrl} kind="banner" alt={`${org.name} banner`} className="landing-banner-image" imageClassName="landing-card-banner-zoom" />
                    <div className="landing-banner-shade" />
                    
                    {/* Public Visibility Badge */}
                    <div className="landing-public-badge-position">
                      <span className="landing-card-public-badge">
                        <Globe className="icon-tiny" />
                        Public
                      </span>
                    </div>

                    {/* Category Tag */}
                    <div className="landing-category-position">
                      <span className="landing-category-badge">
                        {org.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="landing-card-content">
                    <div className="landing-card-heading">
                      <OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="landing-card-logo" />
                      <div className="landing-card-identity">
                        <h3 className="landing-card-name">
                          {org.name}
                        </h3>
                        <div className="landing-card-location">
                          <MapPin className="landing-card-location-icon" />
                          <span className="landing-location-text">{org.location}</span>
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
                            className="landing-card-tag"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="landing-card-footer">
                  <div className="landing-member-count">
                    <Users className="landing-detail-icon" />
                    <span>{org.memberCount || 1} Members</span>
                  </div>

                  <div className="landing-actions">
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
        <div className="landing-features-content">
          <div className="landing-features-heading">
            <h2 className="landing-heading">
              Built for Public Communities & Private Invites
            </h2>
            <p className="landing-features-description">
              Admins have complete control over public discoverability or private invitation access.
            </p>
          </div>

          <div className="landing-feature-grid">
            <div className="landing-discovery-feature">
              <div className="landing-discovery-icon">
                <Globe className="icon-medium" />
              </div>
              <h3 className="landing-feature-title">Public Search & Discovery</h3>
              <p className="landing-detail-copy">
                Members can search and explore any organisation set to public. Public organisations receive open discovery and instant applicant registration.
              </p>
            </div>

            <div className="landing-privacy-feature">
              <div className="landing-privacy-icon">
                <Lock className="icon-medium" />
              </div>
              <h3 className="landing-feature-title">Private Invite Controls</h3>
              <p className="landing-detail-copy">
                Admins can toggle any organisation between Public and Private with 1 click. Private organisations are strictly hidden from public directories.
              </p>
            </div>

            <div className="landing-wallet-feature">
              <div className="landing-wallet-icon">
                <Wallet className="icon-medium" />
              </div>
              <h3 className="landing-feature-title">Google Wallet Digital Pass</h3>
              <p className="landing-detail-copy">
                Instant digital pass issuance for verified members with barcode credentials, live sync, and automated confirmation emails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Organisation Details Modal */}
      {selectedOrgId && !selectedOrg && (
        <div className="landing-details-overlay">
          <div role="dialog" aria-modal="true" aria-label="Organisation details" className="landing-details-status">
            <p role={loadingOrgs ? 'status' : 'alert'} className="landing-details-message">{loadingOrgs ? 'Loading organisation...' : loadError || 'This public organisation could not be found.'}</p>
            <button onClick={() => closeQuery(['organisationDetails'])} className="landing-back-to-directory">Back to directory</button>
          </div>
        </div>
      )}
      {selectedOrg && (
        <div className="landing-details-overlay">
          <div role="dialog" aria-modal="true" aria-label={`${selectedOrg.name} details`} className="landing-details-dialog">
            {/* Modal Header Banner */}
            <div className="landing-details-banner">
              <OrganisationImage src={selectedOrg.bannerUrl} kind="banner" alt={`${selectedOrg.name} banner`} className="landing-banner-image" />
              <div className="landing-banner-shade" />
              <button
                onClick={() => closeQuery(['organisationDetails'])}
                aria-label="Close organisation details"
                className="landing-details-close"
              >
                <X className="icon-default" />
              </button>
              <div className="landing-details-badges">
                <span className="landing-public-badge">
                  <Globe className="icon-tiny" />
                  Public Organisation
                </span>
                <span className="landing-category-badge">
                  {selectedOrg.category}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="landing-details-body">
              <div className="landing-details-heading">
                <OrganisationImage src={selectedOrg.logoUrl} alt={`${selectedOrg.name} logo`} className="landing-details-logo" />
                <div>
                  <h3 className="landing-details-name">
                    {selectedOrg.name}
                  </h3>
                  <div className="landing-details-summary">
                    <span className="landing-summary-item">
                      <MapPin className="landing-summary-icon" />
                      {selectedOrg.location}
                    </span>
                    <span className="landing-summary-item">
                      <Users className="landing-detail-icon" />
                      {selectedOrg.memberCount} Members
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="landing-about-heading">
                  About this Organisation
                </h4>
                <p className="landing-about-text">
                  {selectedOrg.description}
                </p>
              </div>

              <div className="landing-join-policy">
                <h4 className="landing-policy-heading">
                  <CheckCircle2 className="landing-detail-icon" />
                  Join Requirements & Policy
                </h4>
                <p className="landing-detail-copy">
                  {selectedOrg.joinRequirements || 'Open enrollment for verified members with instant digital pass issuance.'}
                </p>
              </div>

              {selectedOrg.tags && selectedOrg.tags.length > 0 && (
                <div>
                  <h4 className="landing-tags-heading">
                    Community Focus & Tags
                  </h4>
                  <div className="landing-details-tags">
                    {selectedOrg.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="landing-details-tag"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="landing-details-footer">
              {selectedOrg.website ? (
                <a
                  href={selectedOrg.website}
                  target="_blank"
                  rel="noreferrer"
                  className="landing-website-link"
                >
                  <ExternalLink className="icon-small" />
                  <span>Visit Website</span>
                </a>
              ) : (
                <span className="landing-partner-label">Official ReMember Network Partner</span>
              )}

              <div className="landing-actions">
                <button
                  onClick={() => closeQuery(['organisationDetails'])}
                  className="landing-details-dismiss"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onNavigate('register');
                  }}
                  className="landing-apply-button"
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
      <footer className="landing-footer">
        <p>ReMember Community Management System &copy; 2026. Public Directory & Private Invite Network.</p>
      </footer>
    </div>
  );
}
