import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { sessionExpiry } from '../session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('remember_token'));
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);
  const [pendingGoogleSignup, setPendingGoogleSignup] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const currentTokenRef = useRef(token);
  const sessionUserRef = useRef(null);
  const sessionRevision = useRef(0);

  const applySession = (data) => {
    if (data.token) {
      currentTokenRef.current = data.token;
      localStorage.setItem('remember_token', data.token);
      setToken(data.token);
      setSessionExpired(false);
    }
    if (data.user) {
      sessionRevision.current += 1;
      sessionUserRef.current = data.user;
      setUser(data.user);
    }
    if (data.verification) setVerification(data.verification);
    if (data.user?.emailVerified) setVerification(null);
    return data;
  };

  // Load user on token mount
  useEffect(() => {
    let cancelled = false;
    const revision = sessionRevision.current;
    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const data = await api.getMe();
        if (cancelled || revision !== sessionRevision.current) return;
        if (data.success && data.user) {
          applySession(data);
        } else {
          logout();
        }
      } catch (err) {
        if (cancelled || revision !== sessionRevision.current) return;
        console.error('Session validation error:', err);
        logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadUser();
    return () => { cancelled = true; };
  }, [token]);

  const login = async (email, password, rememberMe = false) => {
    const data = await api.login({ email, password, rememberMe });
    if (data.success && data.token) {
      return applySession(data);
    }
    throw new Error(data.message || 'Login failed');
  };

  const register = async (formData) => {
    const data = await api.register(formData);
    if (data.success && data.token) {
      return applySession(data);
    }
    throw new Error(data.message || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('remember_token');
    setToken(null);
    setUser(null);
    sessionUserRef.current = null;
    currentTokenRef.current = null;
    sessionRevision.current += 1;
    setVerification(null);
    setPendingGoogleSignup(null);
    window.google?.accounts?.id?.disableAutoSelect();
  };

  useEffect(() => {
    if (!token) return;
    let timeout;
    const expire = () => {
      if (currentTokenRef.current !== token) return;
      logout();
      setSessionExpired(true);
    };
    const check = () => {
      clearTimeout(timeout);
      const remaining = sessionExpiry(token) - Date.now();
      if (remaining <= 0) expire();
      else timeout = setTimeout(check, Math.min(remaining + 20, 2_147_000_000));
    };
    const invalidSession = event => { if (event.detail?.token === token) expire(); };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('remember:session-expired', invalidSession);
    return () => { clearTimeout(timeout); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); window.removeEventListener('remember:session-expired', invalidSession); };
  }, [token]);

  useEffect(() => {
    const sync = event => {
      if (event.key !== 'remember_token') return;
      currentTokenRef.current = event.newValue;
      if (!event.newValue) logout();
      else { setLoading(true); setToken(event.newValue); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const refreshUser = async () => {
    const expectedToken = currentTokenRef.current;
    const data = await api.getMe();
    if (!expectedToken || expectedToken !== currentTokenRef.current) throw new Error('Your session has ended. Sign in again.');
    if (!data.success || !data.user) throw new Error('Could not refresh your account.');
    applySession(data);
    return data.user;
  };
  const applyAuthenticatedRequest = async (request) => {
    const expectedToken = currentTokenRef.current;
    const data = await request();
    if (!expectedToken || expectedToken !== currentTokenRef.current) throw new Error('Your session has ended. Sign in again.');
    return applySession(data);
  };
  const verifyEmail = async (code) => applyAuthenticatedRequest(() => api.verifyEmail(code));
  const resendVerification = async () => applyAuthenticatedRequest(() => api.resendVerification());
  const completeOnboarding = async () => applyAuthenticatedRequest(() => api.completeOnboarding());
  const selectOrganisation = async (organisationId) => {
    const expectedToken = currentTokenRef.current;
    const response = await api.selectOrganisation(organisationId);
    if (!expectedToken || expectedToken !== currentTokenRef.current) throw new Error('Your session has ended. Sign in again.');
    const data = applySession(response);
    return data.user;
  };
  const googleSignIn = async (details) => {
    const data = await api.googleSignIn(details);
    if (data.signupRequired) setPendingGoogleSignup(data);
    else applySession(data);
    return data;
  };
  const completeGoogleSignup = async (details) => {
    if (!pendingGoogleSignup) throw new Error('Choose Google sign-up again to continue.');
    const data = await api.googleRegister({ ...details, signupToken: pendingGoogleSignup.signupToken });
    setPendingGoogleSignup(null);
    return applySession(data);
  };
  const value = {
    user,
    token,
    loading,
    sessionExpired,
    pendingGoogleSignup,
    googleSignIn,
    completeGoogleSignup,
    isAuthenticated: !!user,
    isAdmin: user?.emailVerified === true && user?.organisationRole === 'owner',
    verificationDeliveryError: verification && verification.delivery !== 'sent' ? verification.message : '',
    verificationResendAt: verification?.canResendAt,
    login,
    register,
    logout,
    refreshUser,
    verifyEmail,
    resendVerification,
    completeOnboarding,
    selectOrganisation,
    getCurrentUser: () => sessionUserRef.current,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
