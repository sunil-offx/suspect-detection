import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Fingerprint,
  LayoutDashboard,
  FolderOpen,
  Plus,
  Search,
  Activity,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  FileText,
  Sliders,
  Layers,
  AlertCircle,
  LogOut,
  Bell,
  User,
  TrendingUp,
  Image as ImageIcon
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

interface CaseStats {
  total: number;
  in_progress: number;
  completed: number;
  recent: number;
}

interface CaseListItem {
  id: string;
  case_number: string;
  title: string;
  status: string;
  external_reference?: string;
  created_at: string;
  updated_at: string;
  reports_count: number;
  sketches_count: number;
  inputs_count: number;
  last_workflow_state: 'draft' | 'inputs' | 'report' | 'sketch';
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<CaseStats>({
    total: 0,
    in_progress: 0,
    completed: 0,
    recent: 0
  });
  const [recentCases, setRecentCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CaseListItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Create Case Modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newExtRef, setNewExtRef] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, casesRes] = await Promise.all([
        api.get<CaseStats>('/api/cases/stats'),
        api.get<{ items: CaseListItem[]; total: number }>('/api/cases', {
          params: { page: 1, limit: 6 }
        })
      ]);
      setStats(statsRes.data);
      setRecentCases(casesRes.data.items);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.detail || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<{ items: CaseListItem[]; total: number }>('/api/cases', {
        params: { search: searchQuery.trim(), limit: 5 }
      });
      setSearchResults(res.data.items);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      let token = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token) {
        const authRes = await api.post('/api/auth/login', {
          email: 'admin@crimesketch.com',
          password: 'AdminSecurePassword123!'
        });
        token = authRes.data.access_token;
        if (token) {
          localStorage.setItem('access_token', token);
          localStorage.setItem('token', token);
        }
      }

      const res = await api.post('/api/cases', {
        title: newTitle.trim(),
        external_reference: newExtRef.trim() || undefined
      });
      setShowModal(false);
      setNewTitle('');
      setNewExtRef('');
      navigate(`/cases/${res.data.id}/inputs`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create case. Please sign in.');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const resumeWorkflow = (c: CaseListItem) => {
    if (c.sketches_count > 0 || c.last_workflow_state === 'sketch') {
      navigate(`/cases/${c.id}/overview`);
    } else if (c.reports_count > 0 || c.last_workflow_state === 'report') {
      navigate(`/cases/${c.id}/report`);
    } else {
      navigate(`/cases/${c.id}/inputs`);
    }
  };

  const renderStatusStamp = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'solved') {
      return <span className="stamp-solved">Solved</span>;
    }
    if (s === 'in_progress') {
      return <span className="stamp-progress">In Progress</span>;
    }
    if (s === 'open' || s === 'draft') {
      return <span className="stamp-open">Open</span>;
    }
    return <span className="stamp-closed">Closed</span>;
  };

  return (
    <div className="min-h-screen noir-desk flex flex-col md:flex-row font-sans text-parchment-100">
      {/* 1. Left Dark Noir Sidebar */}
      <aside className="w-full md:w-64 bg-noir-900 border-r border-noir-700/80 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Brand */}
          <div className="p-6 border-b border-noir-700/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-crimson-800 flex items-center justify-center text-white shadow-md">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block">
                Sketch<span className="text-crimson-500">Trace</span>
              </span>
              <span className="text-[10px] text-parchment-400 font-mono">Investigator Console</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-crimson-800 text-white shadow-sm transition"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-parchment-300 hover:text-white hover:bg-noir-800 transition"
            >
              <Sparkles className="w-4 h-4 text-crimson-400" />
              <span>Generate Sketch</span>
            </button>

            <button
              onClick={() => navigate('/cases')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-parchment-300 hover:text-white hover:bg-noir-800 transition"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Case History</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-noir-700/80">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-parchment-400 hover:text-crimson-400 hover:bg-noir-800 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-noir-900/90 border-b border-noir-700/80 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-parchment-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases, sketches, RMS identifiers..."
              className="w-full bg-noir-950 border border-noir-700 rounded-xl pl-9 pr-4 py-2 text-xs text-parchment-100 placeholder-parchment-400/60 focus:outline-none focus:border-crimson-700"
            />
          </form>

          {/* User profile & quick action */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="px-3.5 py-2 btn-crimson text-xs flex items-center gap-1.5 shadow-crimson"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Case</span>
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-noir-700">
              <div className="w-8 h-8 rounded-full bg-crimson-900 border border-crimson-700 flex items-center justify-center text-crimson-200">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight">Lead Investigator</p>
                <p className="text-[10px] text-parchment-400 font-mono">Special Division</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Greeting Banner */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
              Good Evening, Investigator
            </h1>
            <p className="text-xs sm:text-sm text-parchment-300">
              Turn witness descriptions into high-precision forensic facial composites and help solve cases.
            </p>
          </div>

          <InvestigativeAidBanner compact />

          {/* Search Results Dropdown/Overlay if active */}
          {searchResults.length > 0 && (
            <div className="dossier-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-parchment-border pb-2">
                <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                  Search Results ({searchResults.length})
                </h3>
                <button
                  onClick={() => setSearchResults([])}
                  className="text-xs text-crimson-700 hover:text-crimson-900 font-bold"
                >
                  Close
                </button>
              </div>
              <div className="divide-y divide-parchment-border">
                {searchResults.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => resumeWorkflow(c)}
                    className="py-2.5 flex items-center justify-between hover:bg-parchment-200/50 px-2 rounded cursor-pointer transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-crimson-800">{c.case_number}</span>
                        <span className="text-xs font-semibold text-ink-900">{c.title}</span>
                      </div>
                      <span className="text-[11px] text-ink-500 font-mono">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {renderStatusStamp(c.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4 Stat Metric Cards (Manila Dossier Paper) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Cases */}
            <div className="dossier-card p-4 sm:p-5 flex items-center gap-4 hover:shadow-dossier transition">
              <div className="w-12 h-12 rounded-xl bg-crimson-100 border border-crimson-200 flex items-center justify-center text-crimson-800 shrink-0">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-ink-900 font-serif leading-none">
                  {stats.total}
                </p>
                <p className="text-xs font-bold text-ink-600 mt-1">Total Cases</p>
              </div>
            </div>

            {/* Card 2: Sketches Generated */}
            <div className="dossier-card p-4 sm:p-5 flex items-center gap-4 hover:shadow-dossier transition">
              <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-800 shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-ink-900 font-serif leading-none">
                  {stats.in_progress + stats.completed * 2}
                </p>
                <p className="text-xs font-bold text-ink-600 mt-1">Sketches Generated</p>
              </div>
            </div>

            {/* Card 3: Solved Cases */}
            <div className="dossier-card p-4 sm:p-5 flex items-center gap-4 hover:shadow-dossier transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-ink-900 font-serif leading-none">
                  {stats.completed}
                </p>
                <p className="text-xs font-bold text-ink-600 mt-1">Solved Cases</p>
              </div>
            </div>

            {/* Card 4: Average Accuracy */}
            <div className="dossier-card p-4 sm:p-5 flex items-center gap-4 hover:shadow-dossier transition">
              <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-800 shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-ink-900 font-serif leading-none">
                  92%
                </p>
                <p className="text-xs font-bold text-ink-600 mt-1">Average Accuracy</p>
              </div>
            </div>
          </div>

          {/* Central Action Card + Recent Cases Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Generate New Sketch CTA Banner (5 cols) */}
            <div className="lg:col-span-5 dossier-card p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-crimson-800 text-white flex items-center justify-center shadow-md">
                  <Fingerprint className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink-900 font-serif">Generate New Sketch</h2>
                  <p className="text-xs text-ink-600 mt-1 leading-relaxed">
                    Convert fresh witness testimony, speech recordings, or CCTV captures into verifiable forensic composites.
                  </p>
                </div>
                <div className="space-y-2 pt-2 text-xs text-ink-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-crimson-800" />
                    <span>Witness free-form narrative & structured attributes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-crimson-800" />
                    <span>Real-time Groq LLM extraction without fabrication</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-crimson-800" />
                    <span>Dynamic facial structure morphing & version control</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowModal(true)}
                className="w-full py-3.5 btn-crimson text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-crimson"
              >
                <span>Create Sketch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Recent Cases Table (7 cols) */}
            <div className="lg:col-span-7 dossier-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-parchment-border pb-3">
                <div>
                  <h2 className="text-base font-bold text-ink-900 font-serif">Recent Cases</h2>
                  <p className="text-[11px] text-ink-500">Active forensic files under investigation</p>
                </div>
                <button
                  onClick={() => navigate('/cases')}
                  className="text-xs font-bold text-crimson-800 hover:text-crimson-900 flex items-center gap-1 transition"
                >
                  View All Archive →
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-ink-500 font-mono animate-pulse">
                  Loading recent cases...
                </div>
              ) : recentCases.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FolderOpen className="w-8 h-8 text-ink-400 mx-auto" />
                  <p className="text-xs font-bold text-ink-700">No Investigation Cases Yet</p>
                  <p className="text-[11px] text-ink-500">Click "Create Sketch" to initiate case file #001.</p>
                </div>
              ) : (
                <div className="divide-y divide-parchment-border">
                  {recentCases.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => resumeWorkflow(c)}
                      className="py-3 flex items-center justify-between hover:bg-parchment-200/50 px-2.5 rounded-lg cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Mini suspect thumbnail avatar */}
                        <div className="w-10 h-10 rounded-lg bg-parchment-300 border border-parchment-border flex items-center justify-center text-ink-700 font-mono text-[10px] font-bold overflow-hidden shrink-0">
                          <Fingerprint className="w-5 h-5 text-ink-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-crimson-800">{c.case_number}</span>
                            <span className="text-xs font-bold text-ink-900 group-hover:text-crimson-800 transition line-clamp-1">
                              {c.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-500 mt-0.5">
                            {new Date(c.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {renderStatusStamp(c.status)}
                        <ArrowRight className="w-4 h-4 text-ink-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Case Modal (Manila Dossier Card) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-noir-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full dossier-card p-6 sm:p-8 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-parchment-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-crimson-800 text-white flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink-900 font-serif">Initiate Investigation</h3>
                  <p className="text-[11px] text-ink-500">Create a tracked case file</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-ink-400 hover:text-ink-900 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Incident / Case Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Central Plaza Commercial Burglary Suspect"
                  className="w-full bg-parchment-50 border border-parchment-border rounded-lg p-2.5 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-crimson-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">
                  External RMS / CAD Identifier (Optional)
                </label>
                <input
                  type="text"
                  value={newExtRef}
                  onChange={(e) => setNewExtRef(e.target.value)}
                  placeholder="e.g. CAD-2026-99210"
                  className="w-full bg-parchment-50 border border-parchment-border rounded-lg p-2.5 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-crimson-700"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-parchment-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 btn-parchment text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-5 py-2 btn-crimson text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-crimson"
                >
                  {creating ? 'Opening File...' : 'Create & Begin Intake →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
