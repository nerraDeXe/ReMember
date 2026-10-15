import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider, useToast } from './context/ToastContext.jsx';

import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';

// Pages
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import AccountOnboardingPage from './pages/AccountOnboardingPage.jsx';
import OrganisationSetupPage from './pages/OrganisationSetupPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

// Member Pages
import MemberDashboard from './pages/member/MemberDashboard.jsx';
const ProfilePage = lazy(() => import('./pages/member/ProfilePage.jsx'));
import EventsCalendarPage from './pages/member/EventsCalendarPage.jsx';
import InvoicesPage from './pages/member/InvoicesPage.jsx';
import MemberOrganisationsPage from './pages/member/MemberOrganisationsPage.jsx';
import GoogleWalletPass from './components/GoogleWalletPass.jsx';
import PaymentModal from './components/PaymentModal.jsx';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import MembersListPage from './pages/admin/MembersListPage.jsx';
import TiersManagementPage from './pages/admin/TiersManagementPage.jsx';
import EventManagementPage from './pages/admin/EventManagementPage.jsx';
import FinancialAnalyticsPage from './pages/admin/FinancialAnalyticsPage.jsx';
import ActivityLogPage from './pages/admin/ActivityLogPage.jsx';
import OrganisationsManagementPage from './pages/OrganisationsManagementPage.jsx';

import { api } from './api.js';
import { getAccountHomePage, getPageAfterContextChange, isAccountPage } from './navigation.js';

function MainApp() {
  const { user, isAuthenticated, isAdmin, loading, refreshUser, getCurrentUser, sessionExpired } = useAuth();
  const { showToast } = useToast();
  const [currentPage, setCurrentPage] = useState(() => window.location.hash.startsWith('#reset-password') ? 'reset-password' : 'landing');
  const [loginEmail, setLoginEmail] = useState('');
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [tiers, setTiers] = useState([]);
  const [walletData, setWalletData] = useState(null);
  const [walletError, setWalletError] = useState('');
  const [checkoutOrganisationId, setCheckoutOrganisationId] = useState(null);

  // Auto-route on auth change
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        setCurrentPage(page => ['landing', 'login', 'register'].includes(page) ? getAccountHomePage(user) : page);
      } else {
        setCurrentPage(page => ['login', 'register', 'google-signup', 'forgot-password', 'reset-password'].includes(page) ? page : 'landing');
      }
    }
  }, [isAuthenticated, isAdmin, loading, user?.activeOrganisationId]);

  useEffect(() => {
    if (user?.emailVerified && user?.onboardingCompleted) {
      setCurrentPage(page => getPageAfterContextChange(page, user));
    }
    setIsRenewModalOpen(false);
    setWalletData(null);
  }, [user?.activeOrganisationId, user?.emailVerified, user?.onboardingCompleted, isAdmin]);

  useEffect(() => {
    if (sessionExpired) { setCurrentPage(page => ['forgot-password', 'reset-password'].includes(page) ? page : 'login'); showToast('Your session has ended. Please sign in again.', 'info'); }
  }, [sessionExpired]);

  useEffect(() => {
    const handleResetLink = () => { if (window.location.hash.startsWith('#reset-password')) setCurrentPage('reset-password'); };
    window.addEventListener('hashchange', handleResetLink);
    return () => window.removeEventListener('hashchange', handleResetLink);
  }, []);

  // Load tiers for modal renewal usage
  useEffect(() => {
    let cancelled = false;
    setTiers([]);
    if (isAuthenticated && user?.emailVerified && user?.activeOrganisationId) {
      api.getTiers().then((res) => {
        if (!cancelled && res.success) setTiers(res.tiers || []);
      }).catch(console.error);
    }
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.emailVerified, user?.activeOrganisationId]);

  useEffect(() => {
    let cancelled = false;
    setWalletData(null);
    setWalletError('');
    if (currentPage === 'member-pass' && user?.activeOrganisationId) {
      api.getWalletPass().then(data => { if (!cancelled) setWalletData(data); }).catch(err => { if (!cancelled) setWalletError(err.message); });
    }
    return () => { cancelled = true; };
  }, [currentPage, user?.activeOrganisationId]);

  useEffect(() => {
    if (checkoutOrganisationId === user?.activeOrganisationId && tiers.length && tiers.every(tier => tier.organisationId === checkoutOrganisationId)) {
      setIsRenewModalOpen(true);
      setCheckoutOrganisationId(null);
    }
  }, [checkoutOrganisationId, user?.activeOrganisationId, tiers]);

  const handleJoinedOrganisation = async (response) => {
    await refreshUser();
    setCurrentPage('member-dashboard');
    if (response.requiresPayment) setCheckoutOrganisationId(String(response.organisation._id));
  };

  const handleNavigate = (page, options = {}) => {
    if (page === 'login' && getCurrentUser()) page = 'account-home';
    if (page === 'login') setLoginEmail(options.email || '');
    if (['forgot-password', 'reset-password', 'login'].includes(page)) {
      if (page !== 'reset-password') window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setCurrentPage(page);
      return;
    }
    const account = getCurrentUser();
    if (account && !account.emailVerified) {
      setCurrentPage('verify-email');
      return;
    }
    if (account && !account.onboardingCompleted && page !== 'organisation-setup') {
      setCurrentPage('account-onboarding');
      return;
    }
    if (page === 'account-home') page = getAccountHomePage(account);
    // RBAC client-side guard
    if (page.startsWith('admin-') && account?.organisationRole !== 'owner') {
      showToast('Access Denied: Administrative privileges required.', 'error');
      setCurrentPage(getAccountHomePage(account));
      return;
    }

    if (page === 'member-renew') {
      if (!user?.activeOrganisationId || isAdmin) {
        setCurrentPage('member-organisations');
        return;
      }
      setIsRenewModalOpen(true);
      return;
    }

    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-mono tracking-wider">
            INITIALIZING REMEMBER SYSTEM...
          </p>
        </div>
      </div>
    );
  }

  // Public unauthenticated pages
  if (currentPage === 'forgot-password') return <ForgotPasswordPage onNavigate={handleNavigate} />;
  if (currentPage === 'reset-password') return <ResetPasswordPage onNavigate={handleNavigate} />;
  if (!isAuthenticated) {
    if (currentPage === 'login') return <LoginPage key={loginEmail} initialEmail={loginEmail} onNavigate={handleNavigate} />;
    if (currentPage === 'register') return <RegisterPage key="email-register" onNavigate={handleNavigate} />;
    if (currentPage === 'google-signup') return <RegisterPage key="google-register" googleSignup onNavigate={handleNavigate} />;
    return <LandingPage onNavigate={handleNavigate} />;
  }

  if (!user.emailVerified) return <VerifyEmailPage onNavigate={handleNavigate} />;
  if (!user.onboardingCompleted && currentPage !== 'organisation-setup') return <AccountOnboardingPage onNavigate={handleNavigate} />;
  if (currentPage === 'organisation-setup') {
    return <OrganisationSetupPage onNavigate={handleNavigate} />;
  }

  // Authenticated layout
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {!isAccountPage(currentPage) && <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
        />}

        <main key={isAccountPage(currentPage) ? user._id : user.activeOrganisationId || 'account'} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentPage === 'account-organisations' && <OrganisationsManagementPage onNavigate={handleNavigate} />}
          {/* Member Routes */}
          {currentPage === 'member-dashboard' && <MemberDashboard onNavigate={handleNavigate} />}
          {currentPage === 'member-organisations' && <MemberOrganisationsPage onNavigate={handleNavigate} onJoined={handleJoinedOrganisation} />}
          {currentPage === 'member-profile' && <ProfilePage />}
          {currentPage === 'member-events' && <EventsCalendarPage />}
          {currentPage === 'member-invoices' && <InvoicesPage />}
          {currentPage === 'member-pass' && (
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Digital Membership Pass</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Official Google Wallet Generic Pass Object with real-time barcode & status verification.
                </p>
              </div>
              <div className="p-8 rounded-xl bg-white border border-slate-200 shadow-sm">
                {walletData?.success ? <GoogleWalletPass
                  user={{ ...user, status: user.membershipStatus || user.status }}
                  walletData={walletData}
                  onSync={async () => {
                    await api.syncWalletObject(user._id);
                  }}
                /> : <p className="text-sm text-slate-600">{walletError || 'Loading your membership pass…'}</p>}
              </div>
            </div>
          )}

          {/* Admin Routes */}
          {isAdmin && <>
            {currentPage === 'admin-dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
            {currentPage === 'admin-members' && <MembersListPage />}
            {currentPage === 'admin-tiers' && <TiersManagementPage />}
            {currentPage === 'admin-events' && <EventManagementPage />}
            {currentPage === 'admin-finances' && <FinancialAnalyticsPage />}
            {currentPage === 'admin-logs' && <ActivityLogPage />}
          </>}
        </main>
      </div>

      {/* Renewal Modal */}
      <PaymentModal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        user={user}
        tiers={tiers}
        onSuccess={() => {
          showToast('Membership renewed successfully!', 'success');
          refreshUser();
          setCurrentPage('member-dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">Loading…</div>}><MainApp /></Suspense>
      </ToastProvider>
    </AuthProvider>
  );
}
