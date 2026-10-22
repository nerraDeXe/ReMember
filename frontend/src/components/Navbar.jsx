import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { isAccountPage } from '../navigation.js';
import {
  User,
  LogOut,
  Megaphone,
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
          <div
            onClick={() => onNavigate(accountPage ? 'account-home' : adminPortal ? 'admin-dashboard' : 'member-dashboard')}
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
          </div>

          {/* Right Tools & Profile */}
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('account-organisations')} aria-label="My Organisations" className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-semibold border ${currentPage === 'account-organisations' ? 'bg-brand-primary border-brand-primary text-brand-ink' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
              <Building2 className="w-4 h-4" /><span className="hidden sm:inline">My Organisations</span>
            </button>

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
                <div className="w-8 h-8 rounded-full border border-brand-secondary bg-slate-50" aria-label={user?.avatarUrl ? `${user?.name} profile photo` : 'No profile photo'}>
                  {user?.avatarUrl && <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="w-full h-full rounded-full object-cover" />}
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
                    <button onClick={() => { onNavigate('account-organisations'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />My Organisations</button>
                      <button
                        onClick={() => {
                          onNavigate('member-profile');
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit Personal Profile</span>
                      </button>

                    <button onClick={() => { onNavigate('member-organisations'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />Find Organisations</button>
                    <button onClick={() => { onNavigate('organisation-setup'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />Create Organisation</button>
                    {user?.activeOrganisationId && (
                      <button
                        onClick={() => {
                          onNavigate(isAdmin ? 'admin-posts' : 'member-communication');
                          setUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Megaphone className="w-3.5 h-3.5 text-slate-400" />
                        <span>Communication</span>
                      </button>
                    )}
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
