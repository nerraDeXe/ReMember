import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Sparkles, Lock, Mail, ArrowRight, RefreshCw } from 'lucide-react';

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await login(email, password);
      showToast(`Welcome back, ${data.user.name}!`, 'success');
      onNavigate('account-home');
    } catch (err) {
      showToast(err.message || 'Login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <div
            onClick={() => onNavigate('landing')}
            className="inline-flex items-center gap-2 mb-3 cursor-pointer group"
          >
            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="h-15 w-auto object-contain"
            />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Sign In to Your Portal</h2>
          <p className="text-xs text-slate-500 mt-1">
            Access your membership pass, upcoming events, and dashboard
          </p>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@domain.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-brand-primary hover:bg-brand-secondary text-brand-ink flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In Securely</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Don't have a membership account yet?{' '}
          <button
            onClick={() => onNavigate('register')}
            className="text-brand-ink hover:underline font-semibold"
          >
            Register Here
          </button>
        </div>
      </div>
    </div>
  );
}
