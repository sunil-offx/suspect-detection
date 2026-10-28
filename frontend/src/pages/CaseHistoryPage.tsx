import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  FolderOpen,
  Search,
  Filter,
  Plus,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  Clock,
  CheckCircle,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Fingerprint
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

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

interface CaseListResponse {
  items: CaseListItem[];
  total: number;
  page: number;
  limit: number;
}

export const CaseHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Create Case Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newExtRef, setNewExtRef] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        // ignore
      }
    }
    fetchCases();
  }, [page, statusFilter, startDate, endDate]);

  const handleAdminQuickLogin = async () => {
    try {
      const res = await api.post('/api/auth/login', {
        email: 'admin@crimesketch.com',
        password: 'AdminSecurePassword123!'
      });
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setCurrentUser(res.data.user);
      setCreateError(null);
      fetchCases();
    } catch (err: any) {
      console.error('Quick login failed:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    navigate('/login');
  };

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get<CaseListResponse>('/api/cases', { params });
      setCases(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Failed to fetch cases:', err);
      setError(err.response?.data?.detail || 'Failed to load cases registry.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCases();
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post('/api/cases', {
        title: newTitle.trim(),
        external_reference: newExtRef.trim() || undefined
      });
      setShowNewModal(false);
      setNewTitle('');
      setNewExtRef('');
      navigate(`/cases/${res.data.id}/inputs`);
    } catch (err: any) {
      console.error('Failed to create case:', err);
      setCreateError(err.response?.data?.detail || 'Failed to create case. Please authenticate.');
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

  const totalPages = Math.ceil(total / limit) || 1;

  const getStatusStamp = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'solved':
        return <span className="stamp-solved">Solved</span>;
      case 'in_progress':
        return <span className="stamp-progress">In Progress</span>;
      case 'closed':
        return <span className="stamp-closed">Closed</span>;
      default:
        return <span className="stamp-open">Open</span>;
    }
  };

  return (
    <div className="min-h-screen noir-desk text-parchment-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-noir-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-crimson-950/80 border border-crimson-800/60 rounded-xl text-crimson-400 shadow-md">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Case Management Registry</h1>
              <p className="text-xs text-parchment-200 mt-0.5 font-medium">
                Investigative case archives, composite history, and workflow resumption
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-parchment px-4 py-2 rounded-xl text-xs font-bold"
            >
              Dashboard
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-crimson px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Case
            </button>
          </div>
        </div>

        {/* Forensic Banner */}
        <InvestigativeAidBanner compact />

        {/* Panel 8: Case History Dossier Card */}
        <div className="dossier-card p-6 sm:p-8 space-y-6 relative overflow-hidden border-2 border-parchment-border">
          {/* Faint background fingerprint watermark */}
          <Fingerprint className="absolute -right-10 -top-10 w-48 h-48 text-ink-950/[0.04] pointer-events-none select-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-parchment-border pb-4">
            <div>
              <h2 className="text-xl font-serif font-bold text-ink-950 tracking-tight">Case History</h2>
              <p className="text-xs text-ink-800 font-medium font-sans">
                View and manage all generated sketches and case details.
              </p>
            </div>
            <div className="text-xs font-mono text-ink-700 font-bold">
              Total Records: <strong className="text-ink-950">{total}</strong>
            </div>
          </div>

          {/* Search and Filters */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-ink-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by case ID, date, keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-parchment-border rounded-xl pl-9 pr-4 py-2 text-xs text-ink-950 font-medium placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-crimson-700 transition"
              />
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white border border-parchment-border rounded-xl px-3 py-2 text-xs text-ink-950 font-bold focus:outline-none focus:ring-2 focus:ring-crimson-700 transition"
              >
                <option value="">All Statuses</option>
                <option value="draft">Open / Draft</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Solved / Completed</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Filter / Submit Button */}
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 btn-crimson py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                title="Apply Filter"
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>
              {(search || statusFilter || startDate || endDate) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-parchment px-3 py-2 rounded-xl text-xs font-bold"
                  title="Reset filters"
                >
                  Reset
                </button>
              )}
            </div>
          </form>

          {/* Case Table matching Panel 8 */}
          <div className="bg-white border border-parchment-border rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-ink-800 font-bold">
                <div className="w-8 h-8 border-3 border-crimson-700 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-serif italic">Loading case records...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-crimson-800 font-bold">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <p className="text-sm">{error}</p>
              </div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center text-ink-700">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-60 text-ink-600" />
                <p className="text-sm font-bold text-ink-950 font-serif">No cases matched the current criteria.</p>
                <p className="text-xs text-ink-700 font-medium mt-1">Try clearing filters or create a new investigation.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-parchment-cardAlt text-ink-950 uppercase tracking-wider font-bold border-b border-parchment-border text-[11px] font-mono">
                    <tr>
                      <th className="py-3 px-4">Case ID</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Sketch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment-border text-ink-950">
                    {cases.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-parchment-100/80 transition group cursor-pointer"
                        onClick={() => resumeWorkflow(c)}
                      >
                        {/* Case ID */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-crimson-900 text-xs bg-parchment-200/80 px-2 py-0.5 rounded border border-parchment-border">
                            {c.case_number}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-ink-800 font-bold font-serif">
                          {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-serif font-bold text-ink-950 text-xs truncate max-w-xs">
                              {c.title}
                            </span>
                            {c.external_reference && (
                              <span className="text-[10px] text-ink-600 font-mono font-bold">
                                Ref: {c.external_reference}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Sketch Thumbnail / Count */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-parchment-200 border border-parchment-border flex items-center justify-center text-ink-950 shadow-inner">
                              <Fingerprint className="w-4 h-4 text-crimson-800" />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-ink-800">
                              v{c.sketches_count > 0 ? c.sketches_count : 1}
                            </span>
                          </div>
                        </td>

                        {/* Status Stamp */}
                        <td className="py-3 px-4">
                          {getStatusStamp(c.status)}
                        </td>

                        {/* Action Arrow */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => resumeWorkflow(c)}
                            className="p-1.5 rounded-lg hover:bg-parchment-200 text-ink-700 hover:text-crimson-800 transition"
                            title="Open Dossier"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Bar */}
            {total > limit && (
              <div className="p-3.5 bg-parchment-100 border-t border-parchment-border flex items-center justify-between text-xs text-ink-800 font-bold">
                <div>
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} cases
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded bg-white border border-parchment-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-parchment-200 text-ink-950 font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded bg-white border border-parchment-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-parchment-200 text-ink-950 font-bold"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create New Case Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-noir-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dossier-card p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in border-2 border-parchment-border">
            <div className="flex items-center justify-between border-b border-parchment-border pb-3">
              <h2 className="text-lg font-serif font-bold text-ink-950 flex items-center gap-2">
                <Plus className="w-5 h-5 text-crimson-700" />
                Initiate New Investigation
              </h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-ink-500 hover:text-ink-950 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-crimson-50 border border-crimson-300 rounded-lg text-xs text-crimson-900 font-bold space-y-2">
                <div className="flex items-center justify-between">
                  <span>{createError}</span>
                  <Link to="/login" className="underline text-crimson-800 hover:text-crimson-950 font-bold">
                    Login Page →
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={handleAdminQuickLogin}
                  className="w-full py-2 px-3 btn-crimson rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>One-Click Login as Seeded Admin</span>
                </button>
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-serif font-bold text-ink-950 mb-1">
                  Investigation / Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Downtown Commercial Burglary Suspect"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-parchment-border rounded-xl px-3 py-2 text-xs text-ink-950 font-medium placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-crimson-700 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-serif font-bold text-ink-950 mb-1">
                  RMS / External Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., CAD-2026-88190"
                  value={newExtRef}
                  onChange={(e) => setNewExtRef(e.target.value)}
                  className="w-full bg-white border border-parchment-border rounded-xl px-3 py-2 text-xs text-ink-950 font-medium placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-crimson-700 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-parchment-border">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn-parchment px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="btn-crimson px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {creating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Create & Begin Input
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
