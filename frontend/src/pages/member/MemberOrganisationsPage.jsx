import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Search, Users, X, ArrowRight, RefreshCw, Globe } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import OrganisationImage from '../../components/OrganisationImage.jsx';
import { filterOrganisations } from '../../organisationDirectory.js';

export default function MemberOrganisationsPage({ onNavigate, onJoined }) {
  const { selectOrganisation } = useAuth();
  const { showToast } = useToast();
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [details, setDetails] = useState(null);
  const [tierId, setTierId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.getOrganisations({ visibility: 'public' }).then(data => setOrganisations(data.organisations || [])).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);
  const categories = useMemo(() => ['All', ...new Set(organisations.map(org => org.category).filter(Boolean))], [organisations]);
  const filtered = useMemo(() => filterOrganisations(organisations, {
    search, category, fields: ['name', 'description', 'location', 'tags']
  }), [organisations, search, category]);
  const openDetails = async (org) => {
    setBusy(true);
    setError('');
    try {
      const data = await api.getOrganisation(org._id);
      setDetails(data);
      setTierId(data.membership?.tierId || data.tiers?.[0]?._id || '');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  const handleJoin = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await api.joinOrganisation(details.organisation._id, tierId);
      showToast(response.requiresPayment ? 'Complete checkout to activate your membership.' : 'You have joined this organisation.', 'success');
      await onJoined(response);
      setDetails(null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const handleOpen = async () => {
    setBusy(true);
    try {
      const account = await selectOrganisation(details.organisation._id);
      setDetails(null);
      onNavigate(account.organisationRole === 'owner' ? 'admin-dashboard' : 'member-dashboard');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const alreadyJoined = details?.organisationRole === 'owner' || ['active', 'expired'].includes(details?.membership?.status);
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap justify-between items-start gap-4">
        <div><p className="text-xs uppercase font-bold text-slate-600 mb-1">Public directory</p><h1 className="text-2xl font-bold">Find Your Organisation</h1><p className="text-sm text-slate-600 mt-2">Explore public communities and choose the membership that suits you.</p></div>
        <button onClick={() => onNavigate('organisation-setup')} className="bg-brand-primary hover:bg-brand-secondary text-brand-ink font-semibold text-xs rounded-lg px-4 py-2.5">Create Organisation</button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1"><span className="sr-only">Search organisations</span><Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, location, or interests" className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 text-sm" /></label>
        <label><span className="sr-only">Organisation category</span><select value={category} onChange={event => setCategory(event.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm">{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      {error && !details && <p role="alert" className="text-sm text-slate-700">{error}</p>}
      {loading ? <div className="py-16 text-center"><RefreshCw className="animate-spin w-6 h-6 mx-auto" /><p className="mt-2 text-sm">Loading organisations…</p></div> : filtered.length === 0 ? <div className="bg-white border border-slate-200 rounded-xl p-10 text-center"><Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" /><h2 className="font-semibold">No organisations found</h2><p className="text-sm text-slate-600 mt-2">Try another search, or create your own organisation.</p></div> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{filtered.map(org => (
          <article key={org._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <OrganisationImage src={org.bannerUrl} kind="banner" alt={`${org.name} banner`} className="h-32 w-full" />
            <div className="p-5 flex-1"><p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1"><Globe className="w-3 h-3" />Public · {org.category}</p><div className="flex items-center gap-3 mt-2"><OrganisationImage src={org.logoUrl} alt={`${org.name} logo`} className="w-10 h-10 rounded-lg border border-slate-200 shrink-0" /><h2 className="font-bold text-lg">{org.name}</h2></div><p className="text-xs text-slate-500 mt-1">{org.location}</p><p className="text-sm text-slate-600 line-clamp-3 mt-3">{org.description}</p></div>
            <div className="border-t border-slate-200 p-4 flex justify-between items-center"><span className="flex items-center gap-1.5 text-xs text-slate-600"><Users className="w-4 h-4" />{org.memberCount || 0} members</span><button disabled={busy} onClick={() => openDetails(org)} className="flex items-center gap-1 text-xs font-bold bg-brand-primary hover:bg-brand-secondary px-3 py-2 rounded-lg disabled:opacity-60">View & Join<ArrowRight className="w-3 h-3" /></button></div>
          </article>
        ))}</div>
      )}
      {details && <div className="fixed inset-0 z-50 bg-brand-muted/35 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-labelledby="join-organisation-title" className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto p-6 space-y-5">
        <div className="flex justify-between items-start gap-4"><div><h2 id="join-organisation-title" className="text-xl font-bold">{details.organisation.name}</h2><p className="text-sm text-slate-600 mt-2">{details.organisation.description}</p></div><button aria-label="Close organisation details" disabled={busy} onClick={() => setDetails(null)} className="p-1"><X className="w-5 h-5" /></button></div>
        {!alreadyJoined && <fieldset className="space-y-2"><legend className="text-sm font-semibold mb-2">Choose Your Membership</legend>{details.tiers?.map(tier => <label key={tier._id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${tierId === tier._id ? 'border-brand-primary bg-brand-50' : 'border-slate-300'}`}><input type="radio" name="join-tier" checked={tierId === tier._id} onChange={() => setTierId(tier._id)} value={tier._id} className="accent-brand-primary" /><span className="flex-1 text-sm"><strong>{tier.name}</strong>{tier.description && <span className="block text-xs text-slate-600 mt-1">{tier.description}</span>}</span><span className="font-semibold text-sm">{Number(tier.price) === 0 ? 'Free' : `$${Number(tier.price).toFixed(2)}`}<span className="block text-xs font-normal text-slate-500">{Number(tier.price) > 0 ? `/${tier.interval}` : ''}</span></span></label>)}{!details.tiers?.length && <p className="text-sm text-slate-600">Membership tiers are not available yet.</p>}</fieldset>}
        {details.membership?.status === 'pending' && <p className="text-sm text-slate-600">Your membership is awaiting payment. Continue to checkout to activate it.</p>}
        {error && <p role="alert" className="text-sm text-slate-800">{error}</p>}
        <button disabled={busy || (!alreadyJoined && !tierId)} onClick={alreadyJoined ? handleOpen : handleJoin} className="w-full flex justify-center items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold rounded-lg py-3 text-sm disabled:opacity-60">{busy && <RefreshCw className="w-4 h-4 animate-spin" />}{alreadyJoined ? details.organisationRole === 'owner' ? 'Open Management' : 'Open Membership' : Number(details.tiers?.find(tier => tier._id === tierId)?.price) > 0 ? 'Join & Continue to Checkout' : 'Join Organisation'}</button>
      </div></div>}
    </div>
  );
}
