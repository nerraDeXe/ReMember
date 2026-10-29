import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard, Users, Layers, Calendar, BarChart3, ScrollText, Mail,
  CreditCard, User, Receipt, Building2, ArrowLeft, Megaphone,
  FileText, ChevronDown,
} from 'lucide-react';
import OrganisationImage from './OrganisationImage.jsx';
import { PageLink } from '../routing.jsx';

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
      { id: 'admin-payments', label: 'Payment Gateway', icon: CreditCard },
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
      { id: 'member-membership', label: 'Manage Membership', icon: CreditCard },
      { id: 'member-invoices', label: 'Invoices & Receipts', icon: Receipt },
    ] },
    { label: 'Your community', links: [
      { id: 'member-communication', label: 'Communication', icon: Megaphone },
      ...(membershipActive ? [{ id: 'member-events', label: 'Community Events', icon: Calendar }] : []),
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
      <PageLink key={link.id} page={link.id} onNavigate={onNavigate} aria-current={selected ? 'page' : undefined}
        className={`sidebar-link ${nested ? 'sidebar-link-nested' : 'sidebar-link-main'} ${selected ? 'sidebar-link-active' : 'sidebar-link-idle'}`}>
        <Icon className={`sidebar-link-icon ${selected ? 'sidebar-icon-active' : 'sidebar-icon-idle'}`} aria-hidden="true" />
        <span>{link.label}</span>
      </PageLink>
    );
  };

  return (
    <>
      <nav aria-label="Mobile portal navigation" className="mobile-portal-nav">
        <label htmlFor="mobile-portal-page" className="mobile-portal-label">{isAdmin ? 'Admin portal' : 'Member portal'} · {user?.activeOrganisation?.name || 'My account'}</label>
        <select id="mobile-portal-page" value={mobileValue} onChange={event => onNavigate(event.target.value)} className="mobile-portal-select">
          {!mobileValue && <option value="" disabled>Choose a page</option>}
          {mobileGroups.map(group => <optgroup key={group.label} label={group.label}>{group.links.map(link => <option key={link.id} value={link.id}>{link.label}</option>)}</optgroup>)}
        </select>
      </nav>

      <aside className="sidebar">
        <PageLink page="account-organisations" onNavigate={onNavigate} className="sidebar-back-link"><ArrowLeft className="sidebar-back-icon" />My Organisations</PageLink>
        <div className="sidebar-organisation">
          <OrganisationImage src={user?.activeOrganisation?.logoUrl} alt="" className="sidebar-organisation-logo" />
          <div className="sidebar-organisation-details"><p className="sidebar-organisation-name">{user?.activeOrganisation?.name || 'My account'}</p><p className="sidebar-portal-name">{isAdmin ? 'Admin Portal' : 'Member Portal'}</p></div>
        </div>
        <nav aria-label={isAdmin ? 'Admin portal navigation' : 'Member portal navigation'} className="sidebar-groups">
          {groups.map(group => (
            <div key={group.label}>
              <p className="sidebar-group-label">{group.label}</p>
              <div className="sidebar-group-links">
                {group.links.map(link => link.children ? (
                  <div key={link.id}>
                    <button type="button" onClick={() => setCommunicationOpen(open => !open)} aria-expanded={communicationOpen} aria-controls="admin-communication-links" className={`sidebar-communication-button ${communicationSelected ? 'sidebar-communication-active' : 'sidebar-link-idle'}`}>
                      <Megaphone className="sidebar-communication-icon" aria-hidden="true" /><span className="sidebar-communication-label">Communication</span><ChevronDown className={`sidebar-communication-chevron ${communicationOpen ? 'sidebar-communication-open' : ''}`} aria-hidden="true" />
                    </button>
                    {communicationOpen && <div id="admin-communication-links" className="sidebar-nested-links">{link.children.map(child => renderLink(child, true))}</div>}
                  </div>
                ) : renderLink(link))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer"><p className="sidebar-help-text">{isAdmin ? 'Manage members, share updates and keep your community connected.' : 'Your membership, organisation updates and upcoming events, together.'}</p></div>
      </aside>
    </>
  );
}
