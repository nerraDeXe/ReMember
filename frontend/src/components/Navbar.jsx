import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { isAccountPage } from '../navigation.js';
import { PageLink } from '../routing.jsx';
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
      <header className="navbar">
        <div className="navbar-content">
          {/* Logo */}
          <PageLink
            page={accountPage ? 'account-home' : adminPortal ? 'admin-dashboard' : 'member-dashboard'} onNavigate={onNavigate}
            className="navbar-brand group"
          >
            
            <div>
              <div className="navbar-brand-row">
                <img
                  src="/remember-logo.png"
                  alt="ReMember"
                  className="navbar-logo"
                />
                <span
                  className={`navbar-portal-badge ${
                    adminPortal
                      ? 'navbar-portal-admin'
                      : 'navbar-portal-member'
                  }`}
                >
                  {accountPage ? 'My Account' : adminPortal ? 'Admin Console' : 'Member Portal'}
                </span>
              </div>
              
            </div>
          </PageLink>

          {/* Right Tools & Profile */}
          <div className="navbar-tools">
            <PageLink page="account-organisations" onNavigate={onNavigate} aria-label="My Organisations" className={`navbar-organisations ${currentPage === 'account-organisations' ? 'navbar-organisations-active' : 'navbar-organisations-idle'}`}>
              <Building2 className="navbar-tool-icon" /><span className="navbar-organisations-label">My Organisations</span>
            </PageLink>

            {/* User Profile Pill */}
            <div className="navbar-account">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                aria-controls="account-menu"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="navbar-account-button"
              >
                <div role="img" className="navbar-avatar" aria-label={user?.avatarUrl ? `${user?.name} profile photo` : 'Default profile icon'}>
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="navbar-avatar-image" /> : <User className="navbar-avatar-icon" aria-hidden="true" />}
                </div>
                <div className="navbar-account-summary">
                  <div className="navbar-account-name">
                    {user?.name?.split(' ')[0]}
                  </div>
                  {!accountPage && !isAdmin && (
                    <div className="navbar-account-tier">
                      {user?.tierName || 'ReMember account'}
                    </div>
                  )}
                </div>
                <ChevronDown className="navbar-menu-chevron" />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div
                  id="account-menu"
                  className="navbar-account-menu"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="navbar-menu-details">
                    <p className="navbar-menu-name">{user?.name}</p>
                    <p className="navbar-menu-email">{user?.email}</p>
                    <p className="navbar-membership-number">
                      {user?.membershipNumber}
                    </p>
                  </div>

                  <div className="navbar-menu-links">
                    <PageLink page="account-organisations" onNavigate={onNavigate} onClick={() => setUserMenuOpen(false)} className="navbar-menu-link"><Building2 className="navbar-menu-icon" />My Organisations</PageLink>
                      <PageLink page="member-profile" onNavigate={onNavigate}
                        onClick={() => {
                          setUserMenuOpen(false);
                        }}
                        className="navbar-profile-link"
                      >
                        <User className="navbar-profile-icon" />
                        <span>Edit Personal Profile</span>
                      </PageLink>

                    <PageLink page="member-organisations" onNavigate={onNavigate} onClick={() => setUserMenuOpen(false)} className="navbar-menu-link"><Building2 className="navbar-menu-icon" />Find Organisations</PageLink>
                    <PageLink page="organisation-setup" onNavigate={onNavigate} onClick={() => setUserMenuOpen(false)} className="navbar-menu-link"><Building2 className="navbar-menu-icon" />Create Organisation</PageLink>
                  </div>

                  <div className="navbar-signout-section">
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="navbar-signout-button"
                    >
                      <LogOut className="navbar-menu-icon" />
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
