import React, { useRef } from 'react';
import { Building2, CreditCard } from 'lucide-react';
import OrganisationsManagementPage from './OrganisationsManagementPage.jsx';
import MemberOrganisationsPage from './member/MemberOrganisationsPage.jsx';

const tabs = [
  { id: 'organisations', label: 'My Organisations', page: 'account-organisations', icon: Building2 },
  { id: 'memberships', label: 'My Memberships', page: 'account-memberships', icon: CreditCard },
];

export default function AccountHomePage({ activeTab = 'organisations', onNavigate, onJoined }) {
  const tabRefs = useRef([]);
  const handleTabKeyDown = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    onNavigate(tabs[next].page);
  };

  return (
    <div className="section-stack">
      <div role="tablist" aria-label="My account sections" className="account-tabs">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return <button key={tab.id} ref={element => { tabRefs.current[index] = element; }} id={`account-tab-${tab.id}`} role="tab" type="button" aria-selected={selected} aria-controls={`account-panel-${tab.id}`} tabIndex={selected ? 0 : -1} onClick={() => onNavigate(tab.page)} onKeyDown={event => handleTabKeyDown(event, index)} className={`account-tab ${selected ? "account-tab-active" : "account-tab-idle"}`}><Icon aria-hidden="true" className="account-tab-icon" />{tab.label}</button>;
        })}
      </div>
      {tabs.map(tab => <section key={tab.id} id={`account-panel-${tab.id}`} role="tabpanel" aria-labelledby={`account-tab-${tab.id}`} tabIndex={0} hidden={activeTab !== tab.id}>
        {activeTab === tab.id && (tab.id === 'memberships'
          ? <MemberOrganisationsPage onNavigate={onNavigate} onJoined={onJoined} />
          : <OrganisationsManagementPage onNavigate={onNavigate} />)}
      </section>)}
    </div>
  );
}
