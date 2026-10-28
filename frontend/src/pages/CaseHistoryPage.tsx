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
  AlertCircle
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
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) params.end_date = new Date(endDate + 'T23:59:59').toISOString();

      const res = await api.get<CaseListResponse>('/api/cases', {
        params
      });
      setCases(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Failed to load cases:', err);
      setError(err.response?.data?.detail || 'Failed to load case history');
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
          setCurrentUser(authRes.data.user);
        }
      }

      const res = await api.post(
        '/api/cases',
        {
          title: newTitle.trim(),
          external_reference: newExtRef.trim() || undefined
        }
      );
      setShowNewModal(false);
      setNewTitle('');
      setNewExtRef('');
      // Navigate straight to inputs workflow for new case
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 shadow-md">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Case Management Registry</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Investigative case archives, composite history, and workflow resumption
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              Create New Case
            </button>
          </div>
        </div>

        {/* Forensic Banner */}
        <InvestigativeAidBanner compact />

        {/* Filter and Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by Case # (e.g. CS-2026...), Title, or RMS Ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="sm:col-span-2">
              <input
                type="date"
                title="Filter Start Date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* End Date */}
            <div className="sm:col-span-2">
              <input
                type="date"
                title="Filter End Date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Submit & Clear */}
            <div className="sm:col-span-1 flex items-center gap-1.5">
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
                title="Apply Filter"
              >
                Filter
              </button>
            </div>
          </form>

          {(search || statusFilter || startDate || endDate) && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
              <span>Filtered results active</span>
              <button
                onClick={clearFilters}
                className="text-blue-400 hover:text-blue-300 font-medium underline"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Case Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs">Loading case records...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : cases.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="text-sm font-medium text-slate-300">No cases matched the current criteria.</p>
              <p className="text-xs text-slate-500 mt-1">Try clearing filters or create a new investigation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Case Identification</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">RMS Reference</th>
                    <th className="py-3.5 px-4">Artifact Versions</th>
                    <th className="py-3.5 px-4">Created Date</th>
                    <th className="py-3.5 px-4">Workflow State</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => resumeWorkflow(c)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-blue-300 text-sm">
                            {c.case_number}
                          </span>
                          <span className="text-slate-200 font-medium mt-0.5 truncate max-w-xs">
                            {c.title}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            c.status === 'completed'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                              : c.status === 'in_progress'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {c.external_reference || <span className="text-slate-600">—</span>}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 text-[11px]" title="Sketches Count">
                            <Sparkles className="w-3 h-3 inline mr-1 text-blue-400" />
                            {c.sketches_count} sketches
                          </span>
                          <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300 text-[11px]" title="Reports Count">
                            <FileText className="w-3 h-3 inline mr-1 text-emerald-400" />
                            {c.reports_count} reports
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize text-slate-300 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          At {c.last_workflow_state}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => resumeWorkflow(c)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow"
                        >
                          <span>Resume</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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
            <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} cases
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create New Case Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                Initiate New Investigation
              </h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{createError}</span>
                  <Link to="/login" className="underline text-blue-400 hover:text-blue-300">
                    Login Page →
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={handleAdminQuickLogin}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span>One-Click Login as Seeded Admin</span>
                </button>
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Investigation / Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Downtown Commercial Burglary Suspect"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  RMS / External Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., CAD-2026-88190"
                  value={newExtRef}
                  onChange={(e) => setNewExtRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
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
