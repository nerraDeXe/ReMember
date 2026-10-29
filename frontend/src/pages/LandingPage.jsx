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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">

            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="h-12 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('login')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-secondary text-brand-ink rounded-lg transition-colors"
            >
              Join ReMember
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          {/* Hero Quick Search Shortcut */}
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search public organisations (e.g. AI, Climate, Arts, London)..."
                className="w-full pl-12 pr-10 py-3.5 bg-white border-2 border-slate-200 hover:border-brand-primary/50 focus:border-brand-primary rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Organisation Search & Discovery Section */}
      <section id="organisations" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-brand-ink uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>Public Directory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
              Browse Public Organisations
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Admins configure whether organisations are open to the public or set to private invite.
            </p>
          </div>

          {/* Live Result Count */}
          <div className="text-xs font-semibold text-slate-600 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2 self-start md:self-auto">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span>
              {loadingOrgs ? 'Loading organisations...' : `${filteredOrganisations.length} Public Organisation${filteredOrganisations.length === 1 ? '' : 's'} Available`}
            </span>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 pl-1 pr-2 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'bg-brand-primary text-brand-ink shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
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
            <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-mono">LOADING PUBLIC ORGANISATIONS...</p>
          </div>
        ) : filteredOrganisations.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200 p-8 max-w-lg mx-auto shadow-sm">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              {organisations.length === 0 ? 'No Public Organisations Available' : 'No Matching Organisations Found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrganisations.map((org) => (
              <div
                key={org._id}
                className="bg-white rounded-xl border border-slate-200 hover:border-brand-primary/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Card Banner */}
                  <div className="h-28 relative overflow-hidden bg-slate-100">
                    <OrganisationImage src={org.bannerUrl} kind="banner" alt={`${org.name} banner`} className="w-full h-full" imageClassName="group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-brand-muted/10" />
                    
                    {/* Public Visibility Badge */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-500/90 text-brand-ink backdrop-blur-xs flex items-center gap-1 shadow-sm">
                        <Globe className="w-3 h-3" />
                        Public
                      </span>
                    </div>

                    {/* Category Tag */}
                    <div className="absolute bottom-2.5 left-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/90 text-slate-800 backdrop-blur-xs">
                        {org.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="w-11 h-11 rounded-lg border border-slate-200 shrink-0 -mt-8 relative z-10 bg-white shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-ink transition-colors truncate">
                          {org.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{org.location}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                      {org.description}
                    </p>

                    {/* Tags */}
                    {org.tags && org.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {org.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Users className="w-3.5 h-3.5 text-brand-ink" />
                    <span>{org.memberCount || 1} Members</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOrgId(String(org._id))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => onNavigate('register')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-primary hover:bg-brand-secondary text-brand-ink flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900">
              Built for Public Communities & Private Invites
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Admins have complete control over public discoverability or private invitation access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 hover:border-brand-primary/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand-primary text-brand-ink flex items-center justify-center mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Public Search & Discovery</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Members can search and explore any organisation set to public. Public organisations receive open discovery and instant applicant registration.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 hover:border-brand-secondary/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand-secondary text-brand-ink flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Private Invite Controls</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Admins can toggle any organisation between Public and Private with 1 click. Private organisations are strictly hidden from public directories.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 hover:border-brand-accent transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand-accent text-slate-950 flex items-center justify-center mb-4">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Google Wallet Digital Pass</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Instant digital pass issuance for verified members with barcode credentials, live sync, and automated confirmation emails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Organisation Details Modal */}
      {selectedOrgId && !selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-muted/40">
          <div role="dialog" aria-modal="true" aria-label="Organisation details" className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <p role={loadingOrgs ? 'status' : 'alert'} className="text-sm text-slate-700">{loadingOrgs ? 'Loading organisation...' : loadError || 'This public organisation could not be found.'}</p>
            <button onClick={() => closeQuery(['organisationDetails'])} className="text-sm font-semibold text-brand-ink hover:underline">Back to directory</button>
          </div>
        </div>
      )}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-muted/40 backdrop-blur-xs animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-label={`${selectedOrg.name} details`} className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] flex flex-col">
            {/* Modal Header Banner */}
            <div className="h-36 relative overflow-hidden bg-slate-100 shrink-0">
              <OrganisationImage src={selectedOrg.bannerUrl} kind="banner" alt={`${selectedOrg.name} banner`} className="w-full h-full" />
              <div className="absolute inset-0 bg-brand-muted/10" />
              <button
                onClick={() => closeQuery(['organisationDetails'])}
                aria-label="Close organisation details"
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-brand-ink flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-4 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500 text-brand-ink flex items-center gap-1 shadow-sm">
                  <Globe className="w-3 h-3" />
                  Public Organisation
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/90 text-slate-800">
                  {selectedOrg.category}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-start gap-4">
                <OrganisationImage src={selectedOrg.logoUrl} alt={`${selectedOrg.name} logo`} className="w-14 h-14 rounded-xl border-2 border-white shadow-md -mt-10 relative z-10 bg-white shrink-0" />
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">
                    {selectedOrg.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedOrg.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-brand-ink" />
                      {selectedOrg.memberCount} Members
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  About this Organisation
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {selectedOrg.description}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-brand-50/70 border border-brand-primary/60">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-ink" />
                  Join Requirements & Policy
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedOrg.joinRequirements || 'Open enrollment for verified members with instant digital pass issuance.'}
                </p>
              </div>

              {selectedOrg.tags && selectedOrg.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Community Focus & Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrg.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              {selectedOrg.website ? (
                <a
                  href={selectedOrg.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-600 hover:text-brand-ink flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Visit Website</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400">Official ReMember Network Partner</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => closeQuery(['organisationDetails'])}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onNavigate('register');
                  }}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-brand-primary hover:bg-brand-secondary text-brand-ink flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Apply & Join</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <p>ReMember Community Management System &copy; 2026. Public Directory & Private Invite Network.</p>
      </footer>
    </div>
  );
}
