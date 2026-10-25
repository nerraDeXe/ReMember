import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard, Users, Layers, Calendar, BarChart3, ScrollText, Mail,
  CreditCard, User, Wallet, Receipt, Building2, ArrowLeft, Megaphone,
  FileText, ChevronDown,
} from 'lucide-react';
import OrganisationImage from './OrganisationImage.jsx';

export default function Sidebar({ currentPage, onNavigate, isAdmin }) {
  const { user } = useAuth();
  const communicationSelected = ['admin-posts', 'admin-email-settings'].includes(currentPage);
  const [communicationOpen, setCommunicationOpen] = useState(communicationSelected);
  useEffect(() => {
    if (['admin-posts', 'admin-email-settings'].includes(currentPage)) setCommunicationOpen(true);
  }, [currentPage]);

  const communication = {
    id: 'communication', label: 'Communication', icon: Megaphone,
    children: [
      { id: 'admin-posts', label: 'Posts', icon: FileText },
      { id: 'admin-email-settings', label: 'Email Settings', icon: Mail },
    ],
  };
  const adminGroups = [
    { label: 'Overview', links: [{ id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'Manage organisation', links: [
      { id: 'admin-members', label: 'Member Directory', icon: Users },
      { id: 'admin-tiers', label: 'Tiers & Pricing', icon: Layers },
      { id: 'admin-events', label: 'Community Events', icon: Calendar },
      communication,
    ] },
    { label: 'Reports & activity', links: [
      { id: 'admin-finances', label: 'Financial Analytics', icon: BarChart3 },
      { id: 'admin-logs', label: 'Audit Activity Log', icon: ScrollText },
    ] },
  ];
  const membershipActive = user?.membershipStatus === 'active' && (!user.expirationDate || new Date(user.expirationDate) > new Date());
  const memberGroups = [
    { label: 'Your membership', links: [
      { id: 'member-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
      ...(membershipActive ? [{ id: 'member-pass', label: 'Digital Membership Pass', icon: Wallet }] : []),
      { id: 'member-renew', label: 'Renew Membership', icon: CreditCard },
      { id: 'member-invoices', label: 'Invoices & Receipts', icon: Receipt },
    ] },
    { label: 'Your community', links: [
      { id: 'member-communication', label: 'Communication', icon: Megaphone },
      ...(membershipActive ? [{ id: 'member-events', label: 'Events & RSVP', icon: Calendar }] : []),
    ] },
  ];
  const accountGroups = [{ label: 'My account', links: [
    { id: 'account-organisations', label: 'My Organisations', icon: Building2 },
    { id: 'member-organisations', label: 'Find Organisations', icon: Building2 },
    { id: 'organisation-setup', label: 'Create Organisation', icon: Building2 },
    { id: 'member-profile', label: 'Personal Profile', icon: User },
  ] }];
  const groups = isAdmin ? adminGroups : user?.activeOrganisationId ? memberGroups : accountGroups;
  const mobileGroups = groups.flatMap(group => group.links.some(link => link.children)
    ? [
      { label: group.label, links: group.links.filter(link => !link.children) },
      ...group.links.filter(link => link.children).map(link => ({ label: link.label, links: link.children })),
    ]
    : [group]);
  const mobileValue = mobileGroups.some(group => group.links.some(link => link.id === currentPage)) ? currentPage : '';

  const renderLink = (link, nested = false) => {
    const Icon = link.icon;
    const selected = currentPage === link.id;
    return (
      <button key={link.id} type="button" onClick={() => onNavigate(link.id)} aria-current={selected ? 'page' : undefined}
        className={`w-full flex items-center gap-3 rounded-lg text-xs font-semibold transition-colors text-left ${nested ? 'px-3 py-2.5' : 'px-3.5 py-2.5'} ${selected ? 'bg-brand-primary text-brand-ink shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
        <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-brand-ink' : 'text-slate-500'}`} aria-hidden="true" />
        <span>{link.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav aria-label="Mobile portal navigation" className="md:hidden w-full border-b border-slate-200 bg-white px-4 py-3">
        <label htmlFor="mobile-portal-page" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{isAdmin ? 'Admin portal' : 'Member portal'} · {user?.activeOrganisation?.name || 'My account'}</label>
        <select id="mobile-portal-page" value={mobileValue} onChange={event => onNavigate(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary">
          {!mobileValue && <option value="" disabled>Choose a page</option>}
          {mobileGroups.map(group => <optgroup key={group.label} label={group.label}>{group.links.map(link => <option key={link.id} value={link.id}>{link.label}</option>)}</optgroup>)}
        </select>
      </nav>

      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4">
        <button type="button" onClick={() => onNavigate('account-organisations')} className="w-full flex items-center gap-2 px-3 py-2 mb-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" />My Organisations</button>
        <div className="flex items-center gap-3 p-3 mb-5 rounded-xl bg-slate-50 border border-slate-200">
          <OrganisationImage src={user?.activeOrganisation?.logoUrl} alt="" className="w-10 h-10 rounded-lg border border-slate-200 shrink-0" />
          <div className="min-w-0"><p className="text-xs font-bold text-slate-900 break-words">{user?.activeOrganisation?.name || 'My account'}</p><p className="text-[10px] text-slate-500 mt-1">{isAdmin ? 'Admin Portal' : 'Member Portal'}</p></div>
        </div>
        <nav aria-label={isAdmin ? 'Admin portal navigation' : 'Member portal navigation'} className="space-y-5">
          {groups.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.label}</p>
              <div className="space-y-1">
                {group.links.map(link => link.children ? (
                  <div key={link.id}>
                    <button type="button" onClick={() => setCommunicationOpen(open => !open)} aria-expanded={communicationOpen} aria-controls="admin-communication-links" className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors ${communicationSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                      <Megaphone className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" /><span className="flex-1">Communication</span><ChevronDown className={`w-3.5 h-3.5 transition-transform ${communicationOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {communicationOpen && <div id="admin-communication-links" className="ml-5 mt-1 pl-2 border-l border-slate-200 space-y-1">{link.children.map(child => renderLink(child, true))}</div>}
                  </div>
                ) : renderLink(link))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-6"><p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 text-[11px] text-slate-500 leading-relaxed">{isAdmin ? 'Manage members, share updates and keep your community connected.' : 'Your membership, organisation updates and upcoming events, together.'}</p></div>
      </aside>
    </>
  );
}
