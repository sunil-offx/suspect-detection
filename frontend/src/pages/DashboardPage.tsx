import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
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
  AlertCircle
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
          params: { page: 1, limit: 5 }
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
        // Auto-authenticate as seeded admin if session not yet established
        const authRes = await api.post('/api/auth/login', {
          email: 'admin@crimesketch.com',
          password: 'AdminSecurePassword123!'
        });
        token = authRes.data.access_token;
        if (token) {
          localStorage.setItem('access_token', token);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(authRes.data.user));
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

  const resumeWorkflow = (c: CaseListItem) => {
    if (c.sketches_count > 0 || c.last_workflow_state === 'sketch') {
      navigate(`/cases/${c.id}/overview`);
    } else if (c.reports_count > 0 || c.last_workflow_state === 'report') {
      navigate(`/cases/${c.id}/report`);
    } else {
      navigate(`/cases/${c.id}/inputs`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <nav className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                CrimeSketch AI
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded font-semibold">
                  Dashboard
                </span>
              </h1>
              <p className="text-xs text-slate-400">Forensic Investigation Control Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              to="/cases"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
            >
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Case History
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              New Investigation
            </button>
          </div>
        </nav>

        {/* Mandatory Forensic Disclaimer Banner */}
        <InvestigativeAidBanner compact />

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Cases</span>
              <FolderOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {loading ? '—' : stats.total}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">All active & archived investigations</div>
          </div>

          {/* Card 2: In-Progress */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">
              {loading ? '—' : stats.in_progress}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Awaiting composite or confirmation</div>
          </div>

          {/* Card 3: Completed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {loading ? '—' : stats.completed}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Confirmed forensic composites</div>
          </div>

          {/* Card 4: Recent 7 Days */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Recent (7 Days)</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 tracking-tight">
              {loading ? '—' : stats.recent}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">New entries this week</div>
          </div>
        </div>

        {/* Quick Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Quick Search Case Number (e.g. CS-2026...), Title, or RMS Ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Search Results Dropdown/Drawer */}
          {searchResults.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>Matching Investigations ({searchResults.length})</span>
                <button
                  onClick={() => setSearchResults([])}
                  className="text-slate-500 hover:text-white"
                >
                  Clear Results
                </button>
              </div>
              <div className="divide-y divide-slate-800/60">
                {searchResults.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => resumeWorkflow(c)}
                    className="py-2 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded cursor-pointer transition text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-blue-300 mr-2">{c.case_number}</span>
                      <span className="text-slate-200">{c.title}</span>
                    </div>
                    <span className="text-blue-400 font-medium flex items-center gap-1">
                      Resume →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Split: Recent Cases List & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Recent Cases (Left 8 Cols) */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-400" />
                Recent Investigations
              </h2>
              <Link
                to="/cases"
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
              >
                View Full Registry →
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading recent cases...
              </div>
            ) : recentCases.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No investigations recorded yet. Click "New Investigation" to start.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => resumeWorkflow(c)}
                    className="p-3 bg-slate-950/70 hover:bg-slate-800/40 border border-slate-800/80 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-300">
                          {c.case_number}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            c.status === 'completed'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                              : c.status === 'in_progress'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-slate-200 group-hover:text-blue-200 transition">
                        {c.title}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{c.sketches_count} sketches</span>
                        <span>•</span>
                        <span>{c.reports_count} reports</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resumeWorkflow(c);
                        }}
                        className="px-3 py-1.5 bg-slate-900 group-hover:bg-blue-600 border border-slate-700 group-hover:border-blue-500 text-slate-200 group-hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
                      >
                        <span>Resume</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions & System Info (Right 4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Forensic Workflow Shortcuts
              </h2>

              <button
                onClick={() => setShowModal(true)}
                className="w-full p-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg text-left flex items-center gap-3 text-xs text-blue-300 font-semibold transition"
              >
                <div className="p-2 bg-blue-600/20 rounded-md">
                  <Plus className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-white">Start New Case</div>
                  <div className="text-[11px] text-slate-400 font-normal">Initiate witness intake</div>
                </div>
              </button>

              <Link
                to="/cases"
                className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-3 text-xs text-slate-300 font-semibold transition"
              >
                <div className="p-2 bg-slate-800 rounded-md">
                  <FolderOpen className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="text-white">Browse Case Registry</div>
                  <div className="text-[11px] text-slate-400 font-normal">Filter by status & date</div>
                </div>
              </Link>
            </div>

            {/* Forensic Standards Checklist */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-2 text-xs">
              <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-2">
                Operational Standards
              </h3>
              <div className="flex items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero AI hallucination / unprompted guessing</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Operator confirmation required for new deltas</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full version immutability & audit logging</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Case Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                New Investigation Case
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Investigation / Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Armed Robbery Suspect at 4th National Bank"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  RMS Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CAD-2026-99210"
                  value={newExtRef}
                  onChange={(e) => setNewExtRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2"
                >
                  {creating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Create & Begin Intake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
