import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';

import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import CommunicationLayout from './components/CommunicationLayout.jsx';

// Pages
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage.jsx'));
const AccountOnboardingPage = lazy(() => import('./pages/AccountOnboardingPage.jsx'));
const OrganisationSetupPage = lazy(() => import('./pages/OrganisationSetupPage.jsx'));
const PasswordRecoveryPage = lazy(() => import('./pages/PasswordRecoveryPage.jsx'));

// Member Pages
const MemberDashboard = lazy(() => import('./pages/member/MemberDashboard.jsx'));
const ProfilePage = lazy(() => import('./pages/member/ProfilePage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const EventsCalendarPage = lazy(() => import('./pages/member/EventsCalendarPage.jsx'));
const InvoicesPage = lazy(() => import('./pages/member/InvoicesPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/member/MembershipPage.jsx').then(module => ({ default: module.CheckoutPage })));
const MembershipPage = lazy(() => import('./pages/member/MembershipPage.jsx'));
const PaymentGatewayPage = lazy(() => import('./pages/admin/PaymentGatewayPage.jsx'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const MembersListPage = lazy(() => import('./pages/admin/MembersListPage.jsx'));
const TiersManagementPage = lazy(() => import('./pages/admin/TiersManagementPage.jsx'));
const EventManagementPage = lazy(() => import('./pages/admin/EventManagementPage.jsx'));
const FinancialAnalyticsPage = lazy(() => import('./pages/admin/FinancialAnalyticsPage.jsx'));
const ActivityLogPage = lazy(() => import('./pages/admin/ActivityLogPage.jsx'));
const AccountHomePage = lazy(() => import('./pages/AccountHomePage.jsx'));
const EmailSettingsPage = lazy(() => import('./pages/admin/EmailSettingsPage.jsx'));
const PostsPage = lazy(() => import('./pages/PostsPage.jsx'));

import { getAccountHomePage, getPageUrl, isAccountPage, isPortalPage, parseRoute, resolvePageAccess } from './navigation.js';
import { NavigationProvider, useNavigation } from './routing.jsx';

function MainApp() {
  const { user, isAuthenticated, isAdmin, loading, refreshUser, getCurrentUser, selectOrganisation, sessionExpired } = useAuth();
  const { showToast } = useToast();
  const { route, navigate, getSnapshot } = useNavigation();
  const currentPage = route.page;
  const [loginEmail, setLoginEmail] = useState('');
  const [contextRequest, setContextRequest] = useState(null);
  const contextRequestRef = useRef(null);

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
      <div className="icon-center page-background">
        <div className="row-inline-wide flex-col">
          <div className="app-loading-spinner" />
          <p className="text-caption font-mono tracking-wider">
            INITIALIZING REMEMBER SYSTEM...
          </p>
        </div>
      </div>
    );
  }

  if (currentPage === 'not-found') return <div className="icon-center app-missing-page"><h1 className="text-2xl font-bold">Page not found</h1><p className="text-description">This address does not match a ReMember page.</p><a href={getPageUrl(user ? getAccountHomePage(user) : 'landing', { organisationId: user?.activeOrganisationId })} onClick={event => { event.preventDefault(); handleNavigate(user ? 'account-home' : 'landing'); }} className="link-underlined">Go to home</a></div>;

  // Public unauthenticated pages
  if (['forgot-password', 'reset-password'].includes(currentPage)) return <PasswordRecoveryPage key={currentPage} reset={currentPage === 'reset-password'} onNavigate={handleNavigate} />;
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
    <div className="app-shell">
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />

      <div className="app-layout">
        {!isAccountPage(currentPage) && user.membershipStatus !== 'pending' && <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
        />}

        <main key={isAccountPage(currentPage) ? user._id : user.activeOrganisationId || 'account'} className="app-content">
          <Suspense fallback={<p role="status" className="text-description">Loading page…</p>}>
            {['account-organisations', 'account-memberships', 'member-organisations'].includes(currentPage) && <AccountHomePage activeTab={currentPage === 'account-organisations' ? 'organisations' : 'memberships'} onNavigate={handleNavigate} onJoined={handleJoinedOrganisation} />}
            {/* Member Routes */}
            {currentPage === 'member-dashboard' && <MemberDashboard onNavigate={handleNavigate} />}
            {currentPage === 'member-checkout' && <CheckoutPage onNavigate={handleNavigate} />}
            {currentPage === 'member-membership' && <MembershipPage onNavigate={handleNavigate} />}
            {currentPage === 'member-profile' && <ProfilePage />}
            {currentPage === 'account-notifications' && <NotificationsPage onNavigate={handleNavigate} />}
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
          </Suspense>
        </main>
      </div>


    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider><AuthProvider>
      <ToastProvider>
        <NotificationsProvider><Suspense fallback={<div className="icon-center text-description min-h-screen bg-slate-50">Loading…</div>}><MainApp /></Suspense></NotificationsProvider>
      </ToastProvider>
    </AuthProvider></NavigationProvider>
  );
}
