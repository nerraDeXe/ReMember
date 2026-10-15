import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Users,
  Layers,
  Calendar,
  BarChart3,
  ScrollText,
  CreditCard,
  User,
  Wallet,
  Receipt,
  Building2,
  ArrowLeft
} from 'lucide-react';

export default function Sidebar({ currentPage, onNavigate, isAdmin }) {
  const { user } = useAuth();
  const adminLinks = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin-members', label: 'Member Directory', icon: Users },
    { id: 'admin-tiers', label: 'Custom Tiers & Pricing', icon: Layers },
    { id: 'admin-events', label: 'Community Events', icon: Calendar },
    { id: 'admin-finances', label: 'Financial Analytics', icon: BarChart3 },
    { id: 'admin-logs', label: 'Audit Activity Log', icon: ScrollText },
  ];

  const memberLinks = [
    { id: 'member-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { id: 'member-organisations', label: 'Explore Organisations', icon: Building2 },
    { id: 'member-pass', label: 'Google Wallet Pass', icon: Wallet },
    { id: 'member-events', label: 'Upcoming Events & RSVP', icon: Calendar },
    { id: 'member-renew', label: 'Renew Membership', icon: CreditCard },
    { id: 'member-invoices', label: 'Invoices & Receipts', icon: Receipt },
    { id: 'member-profile', label: 'Personal Profile', icon: User },
  ];

  const accountLinks = [
    { id: 'account-organisations', label: 'My Organisations', icon: Building2 },
    { id: 'member-organisations', label: 'Find Organisations', icon: Building2 },
    { id: 'organisation-setup', label: 'Create Organisation', icon: Building2 },
    { id: 'member-profile', label: 'Personal Profile', icon: User },
  ];
  const membershipActive = user?.membershipStatus === 'active' && (!user.expirationDate || new Date(user.expirationDate) > new Date());
  const membershipLinks = memberLinks.filter(link => membershipActive || !['member-pass', 'member-events'].includes(link.id));
  const links = isAdmin ? adminLinks : user?.activeOrganisationId ? membershipLinks : accountLinks;

  return (
    <aside className="w-64 shrink-0 hidden md:block bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4">
      <button onClick={() => onNavigate('account-organisations')} className="w-full flex items-center gap-2 px-3 py-2 mb-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" />My Organisations</button>
      <p className="px-3 pb-3 text-sm font-bold text-slate-900 break-words border-b border-slate-200 mb-2">{user?.activeOrganisation?.name}</p>
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {isAdmin ? 'Administration Portal' : 'Member Portal'}
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = currentPage === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-primary text-brand-ink'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-ink' : 'text-slate-500'}`} />
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
