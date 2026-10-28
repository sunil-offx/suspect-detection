import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, FolderOpen, LogOut, User as UserIcon } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">CrimeSketch</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">AI</span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Forensic Intelligence System</p>
          </div>
        </Link>

        {user && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/dashboard'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Link
              to="/cases"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/cases'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Cases</span>
            </Link>

            <div className="h-5 w-px bg-slate-800 mx-1" />

            <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300">
              <UserIcon className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[120px] truncate hidden md:inline">{user.email}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-bold text-slate-400">
                {user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
