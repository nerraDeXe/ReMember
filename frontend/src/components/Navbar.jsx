import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { isAccountPage } from '../navigation.js';
import PageLink from './PageLink.jsx';
import {
  User,
  LogOut,
  Building2,
  ChevronDown
} from 'lucide-react';

export default function Navbar({ onNavigate, currentPage }) {
  const { user, isAdmin, logout } = useAuth();
  const accountPage = isAccountPage(currentPage);
  const adminPortal = !accountPage && isAdmin;
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <PageLink
            page={accountPage ? 'account-home' : adminPortal ? 'admin-dashboard' : 'member-dashboard'} onNavigate={onNavigate}
            className="flex items-center gap-3 cursor-pointer group"
          >
            
            <div>
              <div className="flex items-center gap-2">
                <img
                  src="/remember-logo.png"
                  alt="ReMember"
                  className="h-12 w-auto object-contain"
                />
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    adminPortal
                      ? 'bg-brand-primary/10 text-brand-ink border-brand-primary/30'
                      : 'bg-brand-accent/20 text-slate-800 border-brand-accent/40 font-semibold'
                  }`}
                >
                  {accountPage ? 'My Account' : adminPortal ? 'Admin Console' : 'Member Portal'}
                </span>
              </div>
              
            </div>
          </PageLink>

          {/* Right Tools & Profile */}
          <div className="flex items-center gap-3">
            <PageLink page="account-organisations" onNavigate={onNavigate} aria-label="My Organisations" className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-semibold border ${currentPage === 'account-organisations' ? 'bg-brand-primary border-brand-primary text-brand-ink' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
              <Building2 className="w-4 h-4" /><span className="hidden sm:inline">My Organisations</span>
            </PageLink>

            {/* User Profile Pill */}
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                aria-controls="account-menu"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
              >
                <div role="img" className="w-8 h-8 shrink-0 rounded-full border border-brand-secondary bg-slate-50 flex items-center justify-center" aria-label={user?.avatarUrl ? `${user?.name} profile photo` : 'Default profile icon'}>
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="w-full h-full rounded-full object-cover" /> : <User className="w-4 h-4 text-slate-500" aria-hidden="true" />}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                    {user?.name?.split(' ')[0]}
                  </div>
                  {!accountPage && !isAdmin && (
                    <div className="text-[10px] text-brand-ink font-mono font-bold">
                      {user?.tierName || 'ReMember account'}
                    </div>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div
                  id="account-menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-fadeIn"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <p className="text-[10px] text-brand-ink font-mono font-bold mt-0.5">
                      {user?.membershipNumber}
                    </p>
                  </div>

                  <div className="py-1">
                    <PageLink page="account-organisations" onNavigate={onNavigate} onClick={() => setUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />My Organisations</PageLink>
                      <PageLink page="member-profile" onNavigate={onNavigate}
                        onClick={() => {
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit Personal Profile</span>
                      </PageLink>

                    <PageLink page="member-organisations" onNavigate={onNavigate} onClick={() => setUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />Find Organisations</PageLink>
                    <PageLink page="organisation-setup" onNavigate={onNavigate} onClick={() => setUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />Create Organisation</PageLink>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-brand-ink hover:bg-slate-100 flex items-center gap-2 font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
