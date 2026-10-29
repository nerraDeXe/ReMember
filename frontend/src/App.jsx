import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider, useToast } from './context/ToastContext.jsx';

import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import CommunicationLayout from './components/CommunicationLayout.jsx';

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
import CheckoutPage from './pages/member/CheckoutPage.jsx';
import MembershipPage from './pages/member/MembershipPage.jsx';
import PaymentGatewayPage from './pages/admin/PaymentGatewayPage.jsx';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import MembersListPage from './pages/admin/MembersListPage.jsx';
import TiersManagementPage from './pages/admin/TiersManagementPage.jsx';
import EventManagementPage from './pages/admin/EventManagementPage.jsx';
import FinancialAnalyticsPage from './pages/admin/FinancialAnalyticsPage.jsx';
import ActivityLogPage from './pages/admin/ActivityLogPage.jsx';
import AccountHomePage from './pages/AccountHomePage.jsx';
const EmailSettingsPage = lazy(() => import('./pages/admin/EmailSettingsPage.jsx'));
const PostsPage = lazy(() => import('./pages/PostsPage.jsx'));

import { api } from './api.js';
import { getAccountHomePage, getPageUrl, isAccountPage, isPortalPage, parseRoute, resolvePageAccess } from './navigation.js';
import { NavigationProvider, useNavigation } from './routing.jsx';

function MainApp() {
  const { user, isAuthenticated, isAdmin, loading, refreshUser, getCurrentUser, selectOrganisation, sessionExpired } = useAuth();
  const { showToast } = useToast();
  const { route, navigate, getSnapshot } = useNavigation();
  const currentPage = route.page;
  const displayPage = currentPage;
  const [loginEmail, setLoginEmail] = useState('');
  const [contextRequest, setContextRequest] = useState(null);
  const contextRequestRef = useRef(null);
  const [tiers, setTiers] = useState([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tiersError, setTiersError] = useState('');

  const requestedOrganisationId = route.query.get('organisation');
  const needsOrganisation = !!(user?.emailVerified && user?.onboardingCompleted && isPortalPage(currentPage)
    && requestedOrganisationId && requestedOrganisationId !== user.activeOrganisationId);
  const allowedPage = resolvePageAccess(currentPage, user);

  // Restore the organisation from a deep link or a previous history entry before
  // mounting any portal page or evaluating its organisation role.
  useEffect(() => {
    if (loading || !needsOrganisation || contextRequestRef.current) return;
    const target = requestedOrganisationId;
    contextRequestRef.current = target;
    setContextRequest(target);
    selectOrganisation(target).catch(error => {
      if (!getCurrentUser() || getSnapshot().query.get('organisation') !== target) return;
      showToast(error.message || 'This organisation is no longer available.', 'error');
      navigate(getPageUrl(getAccountHomePage(getCurrentUser()), { organisationId: getCurrentUser()?.activeOrganisationId }), { replace: true });
    }).finally(() => { contextRequestRef.current = null; setContextRequest(null); });
  }, [loading, needsOrganisation, requestedOrganisationId, contextRequest, getSnapshot, navigate, getCurrentUser, selectOrganisation, showToast]);

  const returnDestination = useCallback(() => {
    const next = route.query.get('next');
    if (!next?.startsWith('/') || next.startsWith('//')) return null;
    const destination = parseRoute(new URL(next, window.location.origin));
    if (!isPortalPage(destination.page) && !isAccountPage(destination.page)) return null;
    return getPageUrl(destination.page, { query: destination.query, organisationId: destination.query.get('organisation') });
  }, [route.query]);

  useEffect(() => {
    if (loading || needsOrganisation || contextRequest) return;
    if (allowedPage !== currentPage) {
      const next = !user && allowedPage === 'login' ? route.url : route.query.get('next');
      const destination = ['landing', 'login', 'register', 'google-signup', 'verify-email', 'account-onboarding'].includes(currentPage) && user?.emailVerified && user?.onboardingCompleted ? returnDestination() : null;
      navigate(destination || getPageUrl(allowedPage, {
        query: next ? { next } : undefined, organisationId: user?.activeOrganisationId,
      }), { replace: true });
    } else if (isPortalPage(currentPage) && route.query.get('renew') === '1' && user?.organisationRole !== 'owner') {
      const query = new URLSearchParams(route.query);
      query.delete('renew');
      navigate(getPageUrl(user?.membershipStatus === 'pending' ? 'member-checkout' : 'member-membership', { query, organisationId: user?.activeOrganisationId }), { replace: true });
    } else if (isPortalPage(currentPage) && user?.activeOrganisationId && !requestedOrganisationId) {
      navigate(getPageUrl(currentPage, { query: route.query, organisationId: user.activeOrganisationId }), { replace: true });
    }
  }, [loading, currentPage, allowedPage, route.url, route.query, needsOrganisation, contextRequest, user, requestedOrganisationId, returnDestination, navigate]);

  useEffect(() => {
    if (sessionExpired) showToast('Your session has ended. Please sign in again.', 'info');
  }, [sessionExpired, showToast]);

  useEffect(() => {
    document.title = `${currentPage === 'landing' ? 'ReMember' : currentPage.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')} | Membership Management`;
  }, [currentPage]);

  // Membership management and checkout share the organisation's current tiers.
  useEffect(() => {
    let cancelled = false;
    setTiers([]);
    setTiersError('');
    setTiersLoading(false);
    if (isAuthenticated && user?.emailVerified && user?.activeOrganisationId) {
      setTiersLoading(true);
      api.getTiers().then((res) => {
        if (!cancelled && res.success) setTiers(res.tiers || []);
      }).catch(error => { if (!cancelled) setTiersError(error.message || 'Could not load membership tiers.'); })
        .finally(() => { if (!cancelled) setTiersLoading(false); });
    }
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.emailVerified, user?.activeOrganisationId]);

  const handleJoinedOrganisation = async (response, { shouldNavigate = () => getSnapshot() === route } = {}) => {
    await refreshUser();
    if (!shouldNavigate()) return;
    handleNavigate(response.requiresPayment ? 'member-checkout' : 'member-dashboard');
  };

  const handleNavigate = (page, options = {}) => {
    if (page === 'member-organisations') page = 'account-memberships';
    if (['member-pass', 'member-renew'].includes(page)) page = 'member-membership';
    if (page === 'login' && getCurrentUser()) page = 'account-home';
    if (page === 'login') setLoginEmail(options.email || '');
    const account = getCurrentUser();
    if (page === 'account-home' && account?.emailVerified && account?.onboardingCompleted && returnDestination()) {
      navigate(returnDestination(), { replace: true });
      return;
    }
    if (page === 'account-home') page = getAccountHomePage(account);
    const requestedPage = page;
    page = resolvePageAccess(page, account);
    if (requestedPage.startsWith('admin-') && account?.organisationRole !== 'owner') {
      showToast('Access Denied: Administrative privileges required.', 'error');
    }
    const next = route.query.get('next');
    const authStep = ['login', 'register', 'google-signup', 'forgot-password', 'verify-email', 'account-onboarding', 'organisation-setup'].includes(page);
    const { query, ...navigationOptions } = options;
    navigate(getPageUrl(page, { query: next && authStep ? { ...query, next } : query, organisationId: account?.activeOrganisationId }), navigationOptions);
  };

  if (loading || needsOrganisation || contextRequest || allowedPage !== currentPage) {
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

  if (currentPage === 'not-found') return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50"><h1 className="text-2xl font-bold">Page not found</h1><p className="text-sm text-slate-600">This address does not match a ReMember page.</p><a href={getPageUrl(user ? getAccountHomePage(user) : 'landing', { organisationId: user?.activeOrganisationId })} onClick={event => { event.preventDefault(); handleNavigate(user ? 'account-home' : 'landing'); }} className="font-semibold underline">Go to home</a></div>;

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
      <Navbar onNavigate={handleNavigate} currentPage={displayPage} />

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        {!isAccountPage(currentPage) && user.membershipStatus !== 'pending' && <Sidebar
          currentPage={displayPage}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
        />}

        <main key={isAccountPage(currentPage) ? user._id : user.activeOrganisationId || 'account'} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {['account-organisations', 'account-memberships', 'member-organisations'].includes(currentPage) && <AccountHomePage activeTab={currentPage === 'account-organisations' ? 'organisations' : 'memberships'} onNavigate={handleNavigate} onJoined={handleJoinedOrganisation} />}
          {/* Member Routes */}
          {displayPage === 'member-dashboard' && <MemberDashboard onNavigate={handleNavigate} />}
          {currentPage === 'member-checkout' && <CheckoutPage onNavigate={handleNavigate} tiers={tiers} tiersLoading={tiersLoading} tiersError={tiersError} />}
          {currentPage === 'member-membership' && <MembershipPage onNavigate={handleNavigate} tiers={tiers} tiersLoading={tiersLoading} tiersError={tiersError} />}
          {currentPage === 'member-profile' && <ProfilePage />}
          {currentPage === 'member-events' && <EventsCalendarPage />}
          {currentPage === 'member-invoices' && <InvoicesPage />}
          {currentPage === 'member-communication' && <CommunicationLayout onNavigate={handleNavigate}><PostsPage /></CommunicationLayout>}
          {/* Admin Routes */}
          {isAdmin && <>
            {currentPage === 'admin-dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
            {currentPage === 'admin-members' && <MembersListPage />}
            {currentPage === 'admin-tiers' && <TiersManagementPage />}
            {currentPage === 'admin-events' && <EventManagementPage />}
            {currentPage === 'admin-posts' && <CommunicationLayout onNavigate={handleNavigate}><PostsPage canManage /></CommunicationLayout>}
            {currentPage === 'admin-email-settings' && <CommunicationLayout activeTab="email-settings" onNavigate={handleNavigate}><EmailSettingsPage embedded /></CommunicationLayout>}
            {currentPage === 'admin-finances' && <FinancialAnalyticsPage />}
            {currentPage === 'admin-payments' && <PaymentGatewayPage />}
            {currentPage === 'admin-logs' && <ActivityLogPage />}
          </>}
        </main>
      </div>


    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider><AuthProvider>
      <ToastProvider>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">Loading…</div>}><MainApp /></Suspense>
      </ToastProvider>
    </AuthProvider></NavigationProvider>
  );
}
