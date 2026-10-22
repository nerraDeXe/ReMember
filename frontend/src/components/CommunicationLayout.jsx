import React from 'react';
import { FileText, Mail, Megaphone, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function CommunicationLayout({ activeTab = 'posts', onNavigate, children }) {
  const { user, isAdmin } = useAuth();
  const tabs = [
    { id: 'posts', label: 'Posts', icon: FileText, page: isAdmin ? 'admin-posts' : 'member-communication' },
    ...(isAdmin ? [{ id: 'email-settings', label: 'Email Settings', icon: Mail, page: 'admin-email-settings' }] : []),
  ];
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-5 sm:px-6 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-brand-primary/20 text-brand-ink flex items-center justify-center shrink-0"><Megaphone className="w-5 h-5" aria-hidden="true" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900">Communication</h1><p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{isAdmin ? 'Share notices with your members and personalise your organisation’s emails.' : 'Stay up to date with the latest notices and news from your organisation.'}</p></div>
          </div>
          <p className="inline-flex items-center gap-2 self-start rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 max-w-full sm:max-w-48"><Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{user?.activeOrganisation?.name}</span></p>
        </div>
        <nav aria-label="Communication sections" className="flex gap-5 px-5 sm:px-6 border-t border-slate-100">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return <button key={tab.id} type="button" onClick={() => onNavigate(tab.page)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`inline-flex items-center gap-2 py-3.5 border-b-2 text-xs font-bold transition-colors ${activeTab === tab.id ? 'border-brand-primary text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'}`}><Icon className="w-4 h-4" aria-hidden="true" />{tab.label}</button>;
          })}
        </nav>
      </header>
      {children}
    </section>
  );
}
