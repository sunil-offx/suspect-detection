import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fingerprint,
  ArrowRight,
  LayoutDashboard,
  Shield,
  FileText,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    const visited = localStorage.getItem('sketchtrace_welcomed');
    if (visited === 'true') {
      setAnimationComplete(true);
    } else {
      const timer = setTimeout(() => {
        setAnimationComplete(true);
        localStorage.setItem('sketchtrace_welcomed', 'true');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen noir-desk text-parchment-100 flex flex-col justify-between p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans select-none">
      {/* Evidence Board Vignette & Warm Desk Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-crimson-950/20 via-noir-950/80 to-noir-950 pointer-events-none"></div>

      {/* Decorative Evidence Board Elements */}
      <div className="absolute top-10 left-10 opacity-20 pointer-events-none hidden lg:block">
        <div className="w-32 h-40 border-2 border-dashed border-parchment-300 rounded rotate-[-6deg] p-2 bg-noir-900/40">
          <div className="w-full h-24 bg-noir-800 rounded mb-2"></div>
          <div className="h-2 bg-parchment-300/40 rounded w-3/4 mb-1"></div>
          <div className="h-2 bg-parchment-300/30 rounded w-1/2"></div>
        </div>
      </div>

      <div className="absolute bottom-16 left-12 opacity-30 pointer-events-none hidden md:block">
        <div className="px-3 py-1 bg-amber-500 text-noir-950 font-mono text-xs font-black rotate-[-12deg] shadow-lg">
          EVIDENCE #3
        </div>
      </div>

      <div className="absolute top-16 right-16 opacity-15 pointer-events-none hidden lg:block">
        <Fingerprint className="w-64 h-64 text-parchment-300 rotate-[15deg]" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-10 flex items-center justify-between max-w-6xl w-full mx-auto pb-4 border-b border-noir-700/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-crimson-900/60 border border-crimson-700/60 flex items-center justify-center text-crimson-200 shadow-md">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Sketch<span className="text-crimson-500">Trace</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-noir-850 text-parchment-300 border border-parchment-400/30 rounded font-semibold">
                v2.0
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-semibold px-4 py-2 bg-noir-850 hover:bg-noir-800 border border-noir-700 text-parchment-100 rounded-lg flex items-center gap-2 transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-crimson-400" />
            Investigator Portal
          </button>
        </div>
      </header>

      {/* Main Hero Board */}
      <main className="relative z-10 max-w-4xl w-full mx-auto my-auto text-center py-10 px-4">
        {/* Forensic Badge & Logo Reveal */}
        <div
          className={`transition-all duration-700 transform ${
            animationComplete ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'
          }`}
        >
          {/* Fingerprint Main Hero Icon */}
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-noir-900/90 border-2 border-crimson-800/80 flex items-center justify-center text-crimson-500 shadow-2xl shadow-crimson-950">
            <Fingerprint className="w-12 h-12" />
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-2">
            Sketch<span className="text-crimson-500">Trace</span>
          </h1>
          <p className="text-sm sm:text-base font-semibold text-crimson-400 tracking-wider uppercase mb-3">
            AI Crime Scene Sketch Generator
          </p>

          <p className="serif-font italic text-2xl sm:text-3xl text-parchment-200 max-w-xl mx-auto mb-8 font-serif leading-snug">
            "From Witness Words to Visual Justice"
          </p>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={() => navigate('/cases')}
              className="w-full sm:w-auto px-8 py-3.5 btn-crimson text-sm font-bold flex items-center justify-center gap-2 shadow-crimson transition group cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-6 py-3.5 bg-noir-850 hover:bg-noir-800 text-parchment-200 border border-noir-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Sign In</span>
            </button>
          </div>

          {/* Subtext */}
          <p className="text-xs text-parchment-400/80 mt-8 font-mono tracking-wide">
            Real people. Real descriptions. Real impact.
          </p>
        </div>

        {/* Forensic Highlights Ribbon on Manila Paper Cards */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left transition-all duration-700 delay-300 ${
            animationComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="dossier-card p-4 hover:shadow-dossier transition">
            <div className="w-8 h-8 rounded-lg bg-crimson-800 text-white flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-ink-900 mb-1">Witness AI Extraction</h2>
            <p className="text-xs text-ink-600 leading-normal">
              Converts free narrative statements into certified facial feature specifications via Groq LLM without hallucination.
            </p>
          </div>

          <div className="dossier-card p-4 hover:shadow-dossier transition">
            <div className="w-8 h-8 rounded-lg bg-noir-900 text-parchment-200 flex items-center justify-center mb-3 border border-parchment-border">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-ink-900 mb-1">Pencil Sketch Synthesis</h2>
            <p className="text-xs text-ink-600 leading-normal">
              Renders authentic monochrome graphite forensic composite sketches matching police standard documentary styles.
            </p>
          </div>

          <div className="dossier-card p-4 hover:shadow-dossier transition">
            <div className="w-8 h-8 rounded-lg bg-crimson-800 text-white flex items-center justify-center mb-3">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-ink-900 mb-1">Morphological Workbench</h2>
            <p className="text-xs text-ink-600 leading-normal">
              Fine-tune jawlines, chin width, eye shapes, hair, and aging with real-time SVG wireframes and before/after split sliders.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto pt-4 border-t border-noir-700/60 flex flex-col sm:flex-row items-center justify-between text-xs text-parchment-400 gap-2">
        <div className="flex items-center gap-2">
          <span>SketchTrace Forensic Platform</span>
          <span>•</span>
          <span>Law Enforcement Investigative Aid</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="hover:text-parchment-200 transition">
            Dashboard
          </button>
          <span>•</span>
          <button onClick={() => navigate('/cases')} className="hover:text-parchment-200 transition">
            Case Archive
          </button>
        </div>
      </footer>
    </div>
  );
};
