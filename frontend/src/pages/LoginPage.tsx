import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { Fingerprint, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'password' | 'quick'>('password');
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

  const handleQuickAdminLogin = () => {
    setEmail('admin@crimesketch.com');
    setPassword('AdminSecurePassword123!');
    handleLogin(undefined, 'admin@crimesketch.com', 'AdminSecurePassword123!');
  };

  return (
    <div className="min-h-screen noir-desk flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      {/* Background Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-crimson-950/20 via-noir-950/80 to-noir-950 pointer-events-none"></div>

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-noir-900 border-2 border-crimson-800 text-crimson-500 shadow-2xl mb-2">
            <Fingerprint className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sketch<span className="text-crimson-500">Trace</span>
          </h1>
          <p className="text-xs text-parchment-400 font-mono">
            Investigator Authentication Gateway
          </p>
        </div>

        {/* Disclaimer Ribbon */}
        <InvestigativeAidBanner compact />

        {/* Manila Dossier Card */}
        <div className="dossier-card p-6 sm:p-8 space-y-5">
          <div className="text-center border-b border-parchment-border pb-4">
            <h2 className="text-xl font-bold text-ink-900 font-serif">Welcome Back</h2>
            <p className="text-xs text-ink-600 mt-0.5">Continue to SketchTrace Forensic Portal</p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex rounded-lg bg-parchment-200/80 p-1 border border-parchment-border">
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'password'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              Sign In with Password
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'quick'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              One-Click Admin
            </button>
          </div>

          {error && (
            <div className="p-3 bg-crimson-50 border border-crimson-200 rounded-lg text-xs text-crimson-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-crimson-600" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'password' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Official Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-ink-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="investigator@agency.gov"
                    className="w-full bg-parchment-50 border border-parchment-border rounded-lg pl-9 pr-3 py-2 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-ink-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-parchment-50 border border-parchment-border rounded-lg pl-9 pr-3 py-2 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 btn-crimson text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-crimson"
              >
                {loading ? 'Authenticating...' : 'Sign In to Investigation Portal'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-parchment-100 rounded-lg border border-parchment-border text-xs text-ink-700 space-y-1">
                <p className="font-bold text-ink-900">Pre-seeded Forensic Administrator</p>
                <p className="font-mono text-[11px] text-ink-600">admin@crimesketch.com</p>
                <p className="text-[10px] text-ink-500">Full investigative access: case creation, AI report synthesis, and sketch generation.</p>
              </div>

              <button
                type="button"
                onClick={handleQuickAdminLogin}
                disabled={loading}
                className="w-full py-2.5 btn-crimson text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-crimson"
              >
                {loading ? 'Authenticating...' : 'Instant Admin Sign In'}
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="pt-2 text-center text-xs text-ink-500 border-t border-parchment-border">
            <span>Restricted Authorized Law Enforcement Personnel Only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
