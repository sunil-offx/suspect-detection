import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Sparkles,
  ArrowRight,
  FolderOpen,
  LayoutDashboard,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  ChevronRight
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [animationComplete, setAnimationComplete] = useState(false);
  const [isRepeatVisitor, setIsRepeatVisitor] = useState(false);

  useEffect(() => {
    const visited = localStorage.getItem('crimesketch_welcomed');
    if (visited === 'true') {
      setIsRepeatVisitor(true);
      setAnimationComplete(true);
    } else {
      // Reveal animation takes 1.4s (< 2s requirement)
      const timer = setTimeout(() => {
        setAnimationComplete(true);
        localStorage.setItem('crimesketch_welcomed', 'true');
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, []);

  const skipAnimation = () => {
    localStorage.setItem('crimesketch_welcomed', 'true');
    setAnimationComplete(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans select-none">
      {/* Background forensic grid lighting effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-6xl w-full mx-auto pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-950">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              CrimeSketch AI
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded font-semibold">
                v2.0
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!animationComplete && (
            <button
              onClick={skipAnimation}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
            >
              Skip Intro →
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-semibold px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg flex items-center gap-1.5 transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Hero Reveal Content */}
      <main className="relative z-10 max-w-4xl w-full mx-auto my-auto text-center py-8 sm:py-12 px-2">
        {/* Animated Badge & Icon */}
        <div
          className={`transition-all duration-700 transform ${
            animationComplete ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-800/80 text-blue-300 text-xs font-semibold mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Forensic Intelligence & Facial Composite Suite
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-4">
            AI-Assisted Police Facial Composite & Investigation Platform
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
            Synthesize witness testimony, audio recordings, and observable descriptors into standardized, version-controlled forensic facial composites without fabrication.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={() => navigate('/cases')}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xl shadow-blue-600/25 transition group cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>Enter Dashboard</span>
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left transition-all duration-700 delay-300 ${
            animationComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="w-8 h-8 rounded-lg bg-blue-950 flex items-center justify-center text-blue-400 mb-3 border border-blue-900">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1">Zero Fabrication</h2>
            <p className="text-xs text-slate-400 leading-normal">
              Strict forensic prompting maps unmentioned features to neutral defaults; requires manual confirmation for unsupported deltas.
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-400 mb-3 border border-indigo-900">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1">Immutable History</h2>
            <p className="text-xs text-slate-400 leading-normal">
              Prior sketch and report iterations are cryptographically preserved with version-controlled prompts and complete audit trails.
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-400 mb-3 border border-emerald-900">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1">Forensic Security</h2>
            <p className="text-xs text-slate-400 leading-normal">
              Private opaque storage tokens, EXIF GPS data stripping, role-based access control, and complete legal disclaimers.
            </p>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="mt-8 text-left">
          <InvestigativeAidBanner compact />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span>CrimeSketch AI Forensic Suite</span>
          <span>•</span>
          <span>Law Enforcement Investigative Aid</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/cases')} className="hover:text-slate-300 transition">
            Case Registry
          </button>
          <span>•</span>
          <button onClick={() => navigate('/dashboard')} className="hover:text-slate-300 transition">
            Analytics Dashboard
          </button>
        </div>
      </footer>
    </div>
  );
};
