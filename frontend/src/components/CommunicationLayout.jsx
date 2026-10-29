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
      <header className="communication-header">
        <div className="communication-heading">
          <div className="communication-identity">
            <div className="communication-icon"><Megaphone className="icon-medium" aria-hidden="true" /></div>
            <div><h1 className="communication-title">Communication</h1><p className="communication-intro">{isAdmin ? 'Share notices with your members and personalise your organisation’s emails.' : 'Stay up to date with the latest notices and news from your organisation.'}</p></div>
          </div>
          <p className="communication-organisation"><Building2 className="communication-organisation-icon" aria-hidden="true" /><span className="communication-organisation-name">{user?.activeOrganisation?.name}</span></p>
        </div>
        <nav aria-label="Communication sections" className="communication-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return <PageLink key={tab.id} page={tab.page} onNavigate={onNavigate} aria-current={activeTab === tab.id ? 'page' : undefined} className={`communication-tab ${activeTab === tab.id ? "communication-tab-active" : "communication-tab-idle"}`}><Icon className="icon-default" aria-hidden="true" />{tab.label}</PageLink>;
          })}
        </nav>
      </header>
      {children}
    </section>
  );
}
