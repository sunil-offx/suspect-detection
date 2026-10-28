import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, FolderOpen, LogOut, User as UserIcon, Fingerprint } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-noir-950/90 backdrop-blur-md border-b border-noir-800 px-4 lg:px-8 py-3.5 font-sans">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-crimson-950 border border-crimson-700/60 flex items-center justify-center text-crimson-500 group-hover:scale-105 transition-transform shadow-md">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-serif font-bold tracking-tight text-white">SketchTrace</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-crimson-800 text-white">AI</span>
            </div>
            <p className="text-[10px] text-parchment-400 uppercase tracking-widest font-mono">Crime Scene Sketch Generator</p>
          </div>
        </Link>

        {user && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                location.pathname === '/dashboard'
                  ? 'btn-crimson !shadow-none'
                  : 'text-parchment-300 hover:text-white hover:bg-noir-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Link
              to="/cases"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                location.pathname === '/cases'
                  ? 'btn-crimson !shadow-none'
                  : 'text-parchment-300 hover:text-white hover:bg-noir-900'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Cases</span>
            </Link>

            <div className="h-5 w-px bg-noir-800 mx-1" />

            <div className="flex items-center gap-2 px-3 py-1 bg-noir-900 border border-noir-800 rounded-lg text-xs text-parchment-300">
              <UserIcon className="w-3.5 h-3.5 text-crimson-500" />
              <span className="max-w-[120px] truncate hidden md:inline font-mono">{user.email}</span>
              <span className="px-1.5 py-0.5 rounded bg-noir-800 text-[10px] uppercase font-mono font-bold text-parchment-400">
                {user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-parchment-400 hover:text-crimson-400 hover:bg-crimson-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
