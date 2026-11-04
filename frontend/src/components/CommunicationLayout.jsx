import React from 'react';
import { FileText, Mail, Megaphone, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLink } from '../routing.jsx';

export default function CommunicationLayout({ activeTab = 'posts', onNavigate, children }) {
  const { user, isAdmin } = useAuth();
  const tabs = [
    { id: 'posts', label: 'Posts', icon: FileText, page: isAdmin ? 'admin-posts' : 'member-communication' },
    ...(isAdmin ? [{ id: 'email-settings', label: 'Email Settings', icon: Mail, page: 'admin-email-settings' }] : []),
  ];
  return (
    <section className="section-stack">
      <header className="surface-large shadow-sm overflow-hidden">
        <div className="page-header communication-header">
          <div className="communication-heading">
            <div className="communication-icon"><Megaphone className="icon-medium" aria-hidden="true" /></div>
            <div><h1 className="heading-large">Communication</h1><p className="communication-description">{isAdmin ? 'Share notices with your members and personalise your organisation’s emails.' : 'Stay up to date with the latest notices and news from your organisation.'}</p></div>
          </div>
          <p className="surface-muted button-inline communication-context"><Building2 className="icon-small shrink-0" aria-hidden="true" /><span className="truncate">{user?.activeOrganisation?.name}</span></p>
        </div>
        <nav aria-label="Communication sections" className="communication-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return <PageLink key={tab.id} page={tab.page} onNavigate={onNavigate} aria-current={activeTab === tab.id ? 'page' : undefined} className={`button-inline communication-tab ${activeTab === tab.id ? "communication-tab-active" : "communication-tab-idle"}`}><Icon className="icon-default" aria-hidden="true" />{tab.label}</PageLink>;
          })}
        </nav>
      </header>
      {children}
    </section>
  );
}
