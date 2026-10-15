import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('remember_token'));
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);
  const sessionUserRef = useRef(null);
  const sessionRevision = useRef(0);

  const applySession = (data) => {
    if (data.token) {
      localStorage.setItem('remember_token', data.token);
      setToken(data.token);
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

  const login = async (email, password) => {
    const data = await api.login({ email, password });
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
    sessionRevision.current += 1;
    setVerification(null);
  };

  const refreshUser = async () => {
    const data = await api.getMe();
    if (!data.success || !data.user) throw new Error('Could not refresh your account.');
    applySession(data);
    return data.user;
  };
  const verifyEmail = async (code) => applySession(await api.verifyEmail(code));
  const resendVerification = async () => applySession(await api.resendVerification());
  const completeOnboarding = async () => applySession(await api.completeOnboarding());
  const selectOrganisation = async (organisationId) => {
    const data = applySession(await api.selectOrganisation(organisationId));
    return data.user;
  };
  const value = {
    user,
    token,
    loading,
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
