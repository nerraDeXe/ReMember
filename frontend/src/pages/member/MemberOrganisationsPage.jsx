import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Search, Users, X, ArrowRight, RefreshCw, Globe } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import OrganisationImage from '../../components/OrganisationImage.jsx';
import { filterOrganisations } from '../../organisationDirectory.js';
import { useNavigation, useUrlQuery, useUrlState } from '../../routing.jsx';

export default function MemberOrganisationsPage({ onNavigate, onJoined }) {
  const { user, selectOrganisation } = useAuth();
  const { showToast } = useToast();
  const { getSnapshot } = useNavigation();
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useUrlState('search', '', { replace: true });
  const [category, setCategory] = useUrlState('category', 'All', { replace: true });
  const [detailsId, setDetailsId] = useUrlState('organisationDetails');
  const { closeQuery } = useUrlQuery();
  const [detailsData, setDetails] = useState(null);
  const details = String(detailsData?.organisation?._id) === detailsId ? detailsData : null;
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [tierId, setTierId] = useState('');
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState('');
  const memberships = useMemo(() => {
    const ownedIds = new Set((user?.ownedOrganisations || []).map(org => String(org._id)));
    return (user?.memberships || []).filter(membership =>
      !ownedIds.has(String(membership.organisationId)) && ['active', 'pending', 'expired', 'cancelled'].includes(membership.status)
    );
  }, [user]);
  useEffect(() => {
    let cancelled = false;
    api.getOrganisations({ visibility: 'public' }).then(data => {
      if (!cancelled) setOrganisations(data.organisations || []);
    }).catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const categories = useMemo(() => ['All', ...new Set(organisations.map(org => org.category).filter(Boolean))], [organisations]);
  const filtered = useMemo(() => filterOrganisations(organisations, {
    search, category, fields: ['name', 'description', 'location', 'tags']
  }), [organisations, search, category]);
  useEffect(() => {
    if (!detailsId) return;
    let cancelled = false;
    setLoadingDetails(true);
    setDetailsError('');
    setDetails(null);
    setError('');
    api.getOrganisation(detailsId).then(data => {
      if (cancelled) return;
      if (!data.organisation) throw new Error('This organisation could not be found.');
      setDetails(data);
      setTierId(data.membership?.tierId || data.tiers?.[0]?._id || '');
    }).catch(err => { if (!cancelled) setDetailsError(err.message || 'This organisation could not be found.'); })
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [detailsId]);
  const openDetails = org => setDetailsId(String(org._id));
  const handleJoin = async () => {
    const submittedRoute = getSnapshot();
    setBusy(true);
    setError('');
    try {
      const response = await api.joinOrganisation(details.organisation._id, tierId);
      showToast(response.requiresPayment ? 'Complete checkout to activate your membership.' : 'You have joined this organisation.', 'success');
      await onJoined(response, { shouldNavigate: () => getSnapshot() === submittedRoute });
    } catch (err) { if (getSnapshot() === submittedRoute) setError(err.message); }
    finally { setBusy(false); }
  };
  const handleOpen = async () => {
    const openingRoute = getSnapshot();
    setBusy(true);
    try {
      const account = await selectOrganisation(details.organisation._id);
      if (getSnapshot() === openingRoute) onNavigate(account.organisationRole === 'owner' ? 'admin-dashboard' : 'member-dashboard');
    } catch (err) { if (getSnapshot() === openingRoute) setError(err.message); }
    finally { setBusy(false); }
  };
  const openMemberPortal = async (organisationId) => {
    if (openingId || busy) return;
    const openingRoute = getSnapshot();
    setOpeningId(organisationId);
    try {
      const account = await selectOrganisation(organisationId);
      if (getSnapshot() === openingRoute) onNavigate(account.organisationRole === 'owner' ? 'admin-dashboard' : 'member-dashboard');
    } catch (err) {
      showToast(err.message || 'Could not open this membership.', 'error');
    } finally {
      setOpeningId(null);
    }
  };
  const alreadyJoined = details?.organisationRole === 'owner' || ['active', 'expired'].includes(details?.membership?.status);
  return (
    <div className="page-stack">
      <div className="member-organisations-header">
        <div><h1 className="member-organisations-title">My Memberships</h1><p className="member-organisations-introduction">Access the communities you have joined and discover your next organisation.</p></div>
        <span className="member-organisations-membership-count">{memberships.length} {memberships.length === 1 ? 'membership' : 'memberships'}</span>
      </div>
      <section aria-labelledby="your-memberships-title" className="content-stack">
        <div><h2 id="your-memberships-title" className="section-title">Your Memberships</h2><p className="member-organisations-section-description">Open a member portal to manage your membership, events, and community updates.</p></div>
        {memberships.length > 0 ? <div className="member-organisations-memberships">
          {memberships.map(membership => {
            const expiry = membership.expirationDate ? new Date(membership.expirationDate) : null;
            const expiryLabel = expiry && !Number.isNaN(expiry.getTime()) ? expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            return <article key={membership.organisationId} className="member-organisations-membership-card">
              <div className="member-organisations-membership-identity">
                <OrganisationImage src={membership.organisation?.logoUrl} alt={`${membership.organisationName || 'Organisation'} logo`} className="member-organisations-membership-logo" />
                <div className="member-organisations-membership-name-group"><h3 className="member-organisations-membership-name">{membership.organisationName || membership.organisation?.name || 'Organisation'}</h3><p className="member-organisations-membership-tier">{membership.tierName || 'Membership'}</p></div>
              </div>
              <div className="member-organisations-membership-status"><span className={`member-organisations-status-badge ${membership.status === 'active' ? "member-organisations-status-active" : membership.status === 'pending' ? "member-organisations-status-pending" : "member-organisations-status-inactive"}`}>{membership.status === 'pending' ? 'Awaiting payment' : membership.status}</span>{expiryLabel && <span className="member-organisations-expiry">{membership.status === 'expired' ? 'Expired' : 'Expires'} {expiryLabel}</span>}</div>
              <button disabled={!!openingId || busy} onClick={() => openMemberPortal(membership.organisationId)} aria-label={`${membership.status === 'pending' ? 'Complete payment' : 'Open member portal'} for ${membership.organisationName || membership.organisation?.name || 'organisation'}`} className="member-organisations-open-portal-button">
                {openingId === membership.organisationId ? <RefreshCw className="icon-spinner" /> : <ArrowRight className="icon-default" />}{membership.status === 'pending' ? 'Complete Payment' : 'Open Member Portal'}
              </button>
            </article>;
          })}
        </div> : <div className="member-organisations-memberships-empty"><div className="member-organisations-memberships-empty-icon"><Users className="icon-medium" /></div><div><h3 className="member-organisations-memberships-empty-title">No memberships yet</h3><p className="member-organisations-memberships-empty-description">Find an organisation below and choose a membership to get started.</p></div></div>}
      </section>
      <section aria-labelledby="find-your-organisation-title" className="member-organisations-directory">
      <div className="member-organisations-directory-header">
        <div><h2 id="find-your-organisation-title" className="section-title">Find Your Organisation</h2><p className="member-organisations-section-description">Explore public communities and choose the membership that suits you.</p></div>
        <button onClick={() => onNavigate('organisation-setup')} className="member-organisations-create-button">Create Organisation</button>
      </div>
      <div className="member-organisations-filters">
        <label className="member-organisations-search-field"><span className="sr-only">Search organisations</span><Search className="member-organisations-search-icon" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, location, or interests" className="member-organisations-search-input" /></label>
        <label><span className="sr-only">Organisation category</span><select value={category} onChange={event => setCategory(event.target.value)} className="member-organisations-category-select">{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      {error && !details && <p role="alert" className="member-organisations-request-status">{error}</p>}
      {loading ? <div className="member-organisations-directory-loading"><RefreshCw className="member-organisations-spinner" /><p className="member-organisations-directory-loading-message">Loading organisations…</p></div> : filtered.length === 0 ? <div className="member-organisations-directory-empty"><Building2 className="member-organisations-directory-empty-icon" /><h2 className="member-organisations-directory-empty-title">No organisations found</h2><p className="member-organisations-introduction">Try another search, or create your own organisation.</p></div> : (
        <div className="member-organisations-directory-results">{filtered.map(org => (
          <article key={org._id} className="member-organisations-directory-card">
            <OrganisationImage src={org.bannerUrl} kind="banner" alt={`${org.name} banner`} className="member-organisations-directory-banner" />
            <div className="member-organisations-directory-card-body"><p className="member-organisations-public-category"><Globe className="icon-tiny" />Public · {org.category}</p><div className="member-organisations-directory-identity"><OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="member-organisations-directory-logo" /><h2 className="member-organisations-directory-name">{org.name}</h2></div><p className="page-description">{org.location}</p><p className="member-organisations-directory-description">{org.description}</p></div>
            <div className="member-organisations-directory-card-footer"><span className="member-organisations-member-count"><Users className="icon-default" />{org.memberCount || 0} members</span><button disabled={busy || !!openingId} onClick={() => openDetails(org)} className="member-organisations-view-button">View & Join<ArrowRight className="icon-tiny" /></button></div>
          </article>
        ))}</div>
      )}
      </section>
      {detailsId && !details && <div className="member-organisations-details-overlay"><div role="dialog" aria-modal="true" aria-label="Organisation details" className="member-organisations-details-status-dialog">
        <p role={loadingDetails || !detailsError ? 'status' : 'alert'} className="member-organisations-request-status">{loadingDetails || !detailsError ? 'Loading organisation...' : detailsError}</p>
        <button onClick={() => closeQuery(['organisationDetails'])} className="member-organisations-return-button">Back to memberships</button>
      </div></div>}
      {details && <div className="member-organisations-details-overlay"><div role="dialog" aria-modal="true" aria-labelledby="join-organisation-title" className="member-organisations-join-dialog">
        <div className="member-organisations-join-header"><div><h2 id="join-organisation-title" className="member-organisations-join-title">{details.organisation.name}</h2><p className="member-organisations-introduction">{details.organisation.description}</p></div><button aria-label="Close organisation details" disabled={busy} onClick={() => closeQuery(['organisationDetails'])} className="member-organisations-close-button"><X className="icon-medium" /></button></div>
        {!alreadyJoined && <fieldset className="detail-stack"><legend className="member-organisations-tier-legend">Choose Your Membership</legend>{details.tiers?.map(tier => <label key={tier._id} className={`member-organisations-tier-option ${tierId === tier._id ? "member-organisations-tier-selected" : "member-organisations-tier-idle"}`}><input type="radio" name="join-tier" checked={tierId === tier._id} onChange={() => setTierId(tier._id)} value={tier._id} className="member-organisations-tier-radio" /><span className="member-organisations-tier-details"><strong>{tier.name}</strong>{tier.description && <span className="member-organisations-tier-description">{tier.description}</span>}</span><span className="member-organisations-tier-price">{Number(tier.price) === 0 ? 'Free' : `MYR ${Number(tier.price).toFixed(2)}`}<span className="member-organisations-tier-interval">{Number(tier.price) > 0 ? `/${tier.interval}` : ''}</span></span></label>)}{!details.tiers?.length && <p className="text-description">Membership tiers are not available yet.</p>}</fieldset>}
        {details.membership?.status === 'pending' && <p className="text-description">Your membership is awaiting payment. Continue to checkout to activate it.</p>}
        {error && <p role="alert" className="member-organisations-join-error">{error}</p>}
        <button disabled={busy || (!alreadyJoined && !tierId)} onClick={alreadyJoined ? handleOpen : handleJoin} className="member-organisations-join-button">{busy && <RefreshCw className="icon-spinner" />}{alreadyJoined ? details.organisationRole === 'owner' ? 'Open Management' : 'Open Membership' : Number(details.tiers?.find(tier => tier._id === tierId)?.price) > 0 ? 'Join & Continue to Checkout' : 'Join Organisation'}</button>
      </div></div>}
    </div>
  );
}
