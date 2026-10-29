import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Lock, Mail, ArrowRight, RefreshCw, Eye, EyeOff } from 'lucide-react';
import GoogleSignIn from '../components/GoogleSignIn.jsx';

export default function LoginPage({ onNavigate, initialEmail = '' }) {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await login(email, password, rememberMe);
      showToast(`Welcome back, ${data.user.name}!`, 'success');
      onNavigate('account-home');
    } catch (err) {
      showToast(err.message || 'Login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div
            onClick={() => onNavigate('landing')}
            className="group login-home-link"
          >
            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="login-logo"
            />
          </div>
          <h2 className="login-title">Sign In to Your Portal</h2>
          <p className="page-description">
            Access your membership pass, upcoming events, and dashboard
          </p>
        </div>


        <form onSubmit={handleSubmit} className="form-stack">
          <fieldset disabled={loading || googleBusy} className="login-fields">
          <div>
            <label className="field-label">Email Address</label>
            <div className="login-field">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@domain.com"
                className="login-email-input"
              />
              <Mail className="login-field-icon" />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="field-label">Password</label>
            <div className="login-field">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="login-password-input"
              />
              <Lock className="login-field-icon" />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="login-password"
                aria-pressed={showPassword}
                className="login-password-toggle"
              >
                {showPassword ? <EyeOff className="icon-default" aria-hidden="true" /> : <Eye className="icon-default" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="login-remember-label"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} className="login-remember-checkbox" />Remember Me (30 days)</label>
            <button type="button" onClick={() => onNavigate('forgot-password')} className="login-forgot-password">Forgot password?</button>
          </div>
          <p className="text-caption">{rememberMe ? 'Stay signed in for 30 days.' : 'Your session lasts 24 hours.'} Applies to email and Google sign-in.</p>
          <button
            type="submit"
            disabled={loading}
            className="login-submit"
          >
            {loading ? (
              <>
                <RefreshCw className="icon-spinner" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In Securely</span>
                <ArrowRight className="icon-default" />
              </>
            )}
          </button>
          </fieldset>
        </form>

        <div className="login-google-section"><p className="login-google-label">Or continue with Google</p><GoogleSignIn intent="login" rememberMe={rememberMe} disabled={loading} onBusyChange={setGoogleBusy} onNavigate={onNavigate} /></div>

        <div className="login-signup-prompt">
          Don't have a membership account yet?{' '}
          <button
            onClick={() => onNavigate('register')}
            className="login-signup-link"
          >
            Register Here
          </button>
        </div>
      </div>
    </div>
  );
}
