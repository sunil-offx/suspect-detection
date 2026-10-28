import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { Shield, Lock, Mail, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('admin@crimesketch.com');
  const [password, setPassword] = useState('AdminSecurePassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    try {
      const res = await api.post('/api/auth/login', {
        email: loginEmail.trim(),
        password: loginPass
      });

      const token = res.data.access_token;
      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setEmail('admin@crimesketch.com');
    setPassword('AdminSecurePassword123!');
    handleLogin(undefined, 'admin@crimesketch.com', 'AdminSecurePassword123!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none"></div>
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-xl shadow-blue-950 mb-2">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            CrimeSketch AI
          </h1>
          <p className="text-xs text-slate-400">
            Forensic Intelligence & Facial Composite Suite
          </p>
        </div>

        {/* Disclaimer */}
        <InvestigativeAidBanner compact />

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              Officer Authentication Gateway
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded">
              Secure RBAC
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Authorized Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@crimesketch.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition text-xs cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Authenticate & Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo 1-Click Button */}
          <div className="pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={loading}
              className="w-full py-2.5 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-blue-300 hover:text-blue-200 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>One-Click Login as Seeded Admin</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-2">
              Default seeded credentials: <span className="font-mono text-slate-400">admin@crimesketch.com</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
