import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ConfidenceChip } from '../components/ConfidenceChips';
import {
  FileText,
  Download,
  RefreshCw,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  AlertCircle,
  FileDown,
  Shield,
  Layers,
  History,
  Lock,
} from 'lucide-react';
import jsPDF from 'jspdf';

interface CaseData {
  id: string;
  case_number: string;
  title: string;
  status: string;
  external_reference?: string;
  created_at: string;
  updated_at: string;
}

interface ReportData {
  id: string;
  case_id: string;
  report_version: number;
  summary: string;
  features: Record<string, string | null>;
  stated_by_witness: string[];
  observed_from_image: string[];
  unknown: string[];
  ambiguous: string[];
  created_at: string;
  updated_at: string;
  original_witness_statements?: string[];
}

export const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [editFeatures, setEditFeatures] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [caseRes, reportRes] = await Promise.all([
        api.get(`/api/cases/${id}`),
        api.get(`/api/cases/${id}/report`).catch((err) => {
          if (err.response?.status === 404) return { data: null };
          throw err;
        }),
      ]);

      setCaseData(caseRes.data);
      if (reportRes.data) {
        setReport(reportRes.data);
        setEditSummary(reportRes.data.summary);
        const mapped: Record<string, string> = {};
        Object.entries(reportRes.data.features || {}).forEach(([k, v]) => {
          mapped[k] = (v as string) || '';
        });
        setEditFeatures(mapped);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!id || !report) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/cases/${id}/report`, {
        summary: editSummary,
        features: editFeatures,
      });
      setReport(res.data);
      setIsEditing(false);
      showToast(`Report updated successfully (Bumped to Version ${res.data.report_version})`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update report');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      // First attempt regular analyze; if 503, fallback to dev fixture if enabled
      let res;
      try {
        res = await api.post(`/api/cases/${id}/analyze`);
      } catch (err: any) {
        if (err.response?.status === 503) {
          res = await api.post(`/api/cases/${id}/analyze?use_fixture=true`);
          showToast('Analyzed using verified test fixture (AI provider key not configured)');
        } else {
          throw err;
        }
      }
      setReport(res.data);
      setEditSummary(res.data.summary);
      const mapped: Record<string, string> = {};
      Object.entries(res.data.features || {}).forEach(([k, v]) => {
        mapped[k] = (v as string) || '';
      });
      setEditFeatures(mapped);
      showToast('Report regenerated successfully from witness statements');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!report || !caseData) return;

    let md = `# CrimeSketch AI — Forensic Facial Feature Report\n`;
    md += `**Case Number:** ${caseData.case_number}\n`;
    md += `**Case Title:** ${caseData.title}\n`;
    md += `**Report Version:** ${report.report_version}\n`;
    md += `**Date:** ${new Date(report.updated_at).toLocaleString()}\n\n`;
    md += `## 1. Case Summary\n${report.summary}\n\n`;
    md += `## 2. Facial Feature Report\n`;
    md += `| Attribute | Witness Observation |\n|---|---|\n`;
    Object.entries(report.features).forEach(([k, v]) => {
      const formattedKey = k.replace(/_/g, ' ').toUpperCase();
      md += `| ${formattedKey} | ${v || 'Unspecified / Neutral'} |\n`;
    });
    md += `\n## 3. Confidence & Uncertainty Breakdown\n`;
    md += `### Stated By Witness\n`;
    report.stated_by_witness.forEach((s) => (md += `- [STATED] ${s}\n`));
    md += `\n### Image Observed\n`;
    (report.observed_from_image || []).forEach((s) => (md += `- [OBSERVED] ${s}\n`));
    md += `\n### Ambiguous / Conflicting\n`;
    (report.ambiguous || []).forEach((s) => (md += `- [AMBIGUOUS] ${s}\n`));
    md += `\n### Unknown / Neutral\n`;
    (report.unknown || []).forEach((s) => (md += `- [UNKNOWN] ${s}\n`));

    if (report.original_witness_statements?.length) {
      md += `\n## 4. Original Witness Statements\n`;
      report.original_witness_statements.forEach((stmt, idx) => {
        md += `> Witness ${idx + 1}: "${stmt}"\n\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Report_${caseData.case_number}_v${report.report_version}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Markdown report downloaded');
  };

  const handleDownloadPDF = () => {
    if (!report || !caseData) return;

    const doc = new jsPDF();
    doc.setFont('helvetica');

    // Header banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('CRIMESKETCH AI — FORENSIC FACIAL REPORT', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('AI-Generated Investigative Aid — Not a Verified Identification', 14, 23);

    // Metadata
    let y = 42;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`Case Number: ${caseData.case_number}`, 14, y);
    doc.text(`Title: ${caseData.title}`, 120, y);
    y += 7;
    doc.text(`Report Version: v${report.report_version}`, 14, y);
    doc.text(`Date: ${new Date(report.updated_at).toLocaleDateString()}`, 120, y);
    y += 12;

    // Summary Section
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138); // blue-900
    doc.text('1. Case Appearance Summary', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const splitSummary = doc.splitTextToSize(report.summary, 182);
    doc.text(splitSummary, 14, y);
    y += splitSummary.length * 5 + 8;

    // Feature Table
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138);
    doc.text('2. Confirmed Facial Feature Matrix', 14, y);
    y += 6;

    doc.setFontSize(8);
    Object.entries(report.features).forEach(([k, v]) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const label = k.replace(/_/g, ' ').toUpperCase();
      const val = v || 'Unspecified / Neutral';
      doc.setTextColor(71, 85, 105);
      doc.text(`${label}:`, 16, y);
      doc.setTextColor(15, 23, 42);
      doc.text(`${val}`, 75, y);
      y += 5.5;
    });

    y += 6;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Confidence Section
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138);
    doc.text('3. Confidence & Evidentiary Breakdown', 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Witness Stated Features (${report.stated_by_witness.length}):`, 14, y);
    y += 4.5;
    report.stated_by_witness.forEach((s) => {
      doc.text(`• ${s}`, 18, y);
      y += 4;
    });

    if (report.ambiguous?.length) {
      y += 3;
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(`Ambiguous / Conflicting Elements (${report.ambiguous.length}):`, 14, y);
      y += 4.5;
      report.ambiguous.forEach((s) => {
        doc.text(`• ${s}`, 18, y);
        y += 4;
      });
    }

    doc.save(`CrimeSketch_Report_${caseData.case_number}_v${report.report_version}.pdf`);
    showToast('PDF report downloaded');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Loading forensic facial report...</p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Report Not Found</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(`/cases/${id}/inputs`)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors text-sm"
            >
              Go to Case Inputs
            </button>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors text-sm"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">No Report Generated Yet</h2>
          <p className="text-sm text-slate-400">
            Witness statements have been recorded. Click below to synthesize and analyze facial features.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            {regenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate Facial Feature Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-blue-400/40 animate-fade-in">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Forensic Banner */}
      <div className="bg-slate-900/90 border-b border-slate-800 py-2.5 px-4 text-center">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-slate-300">CONFIDENTIAL LAW ENFORCEMENT RECORD:</span>
          AI-generated investigative aid — not a verified identification.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Header Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
                {caseData?.case_number}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Version {report.report_version}
              </span>
              {caseData?.external_reference && (
                <span className="text-xs text-slate-400 font-mono">RMS: {caseData.external_reference}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{caseData?.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
              >
                <Edit3 className="w-4 h-4" />
                Edit Report
              </button>
            )}

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors border border-slate-700"
              title="Download Markdown"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">.MD</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors border border-slate-700"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={() => navigate(`/cases/${id}/sketch`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 ml-1"
            >
              <Sparkles className="w-4 h-4" />
              Convert to Sketch
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section 1: Case Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-blue-400" />
              1. Case Narrative Summary
            </h2>
            <span className="text-xs text-slate-400">
              Last updated: {new Date(report.updated_at).toLocaleString()}
            </span>
          </div>

          {isEditing ? (
            <textarea
              rows={4}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            />
          ) : (
            <p className="text-slate-300 leading-relaxed text-sm sm:text-base font-normal">
              {report.summary}
            </p>
          )}
        </div>

        {/* Section 2: Facial Feature Report Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-blue-400" />
              2. Confirmed Facial Feature Matrix
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {Object.keys(report.features).length} attributes evaluated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(report.features).map(([key, value]) => {
              const label = key.replace(/_/g, ' ');
              const isValStated = report.stated_by_witness.some((s) =>
                s.toLowerCase().includes(key.toLowerCase())
              );

              return (
                <div
                  key={key}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-1.5 transition-colors hover:border-slate-700"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-slate-400 font-medium font-mono text-[11px]">
                      {label}
                    </span>
                    {value ? (
                      <span className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 rounded-full bg-blue-500/10">
                        {isValStated ? 'Stated' : 'Derived'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Unspecified</span>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="text"
                      value={editFeatures[key] || ''}
                      onChange={(e) =>
                        setEditFeatures({ ...editFeatures, [key]: e.target.value })
                      }
                      placeholder="Unspecified / neutral"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <p className={`text-sm font-medium ${value ? 'text-slate-100' : 'text-slate-500 italic'}`}>
                      {value || 'Neutral / Unspecified'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Confidence & Uncertainty Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800/80 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-blue-400" />
              3. Confidence & Evidentiary Breakdown
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Strict audit trail distinguishing witness statements, reference observations, and neutral placeholders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Witness Stated */}
            <div className="bg-slate-950/60 border border-blue-900/30 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                Witness-Stated Attributes
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px]">
                  {report.stated_by_witness.length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.stated_by_witness.length > 0 ? (
                  report.stated_by_witness.map((item, idx) => (
                    <ConfidenceChip key={idx} label={item} type="witness-stated" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No direct witness features logged</span>
                )}
              </div>
            </div>

            {/* Image Observed */}
            <div className="bg-slate-950/60 border border-emerald-900/30 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                Image-Observed Observations
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px]">
                  {report.observed_from_image.length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.observed_from_image.length > 0 ? (
                  report.observed_from_image.map((item, idx) => (
                    <ConfidenceChip key={idx} label={item} type="image-observed" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No reference photo observations</span>
                )}
              </div>
            </div>

            {/* Ambiguous / Conflicting */}
            <div className="bg-slate-950/60 border border-amber-900/30 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                Ambiguous & Conflicting Details
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px]">
                  {report.ambiguous.length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.ambiguous.length > 0 ? (
                  report.ambiguous.map((item, idx) => (
                    <ConfidenceChip key={idx} label={item} type="ambiguous" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No conflicting statements reported</span>
                )}
              </div>
            </div>

            {/* Unknown / Neutral Placeholders */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                Unknown / Unstated Placeholders
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px]">
                  {report.unknown.length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.unknown.length > 0 ? (
                  report.unknown.map((item, idx) => (
                    <ConfidenceChip key={idx} label={item} type="unknown" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">None logged</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Collapsible Original Witness Statement */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-850 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">4. Original Witness Statements</h3>
                <p className="text-xs text-slate-400">
                  Read-only evidentiary archive — immutable record preserved across all revisions
                </p>
              </div>
            </div>
            {showOriginal ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showOriginal && (
            <div className="px-6 pb-6 pt-2 border-t border-slate-800/80 space-y-3">
              {report.original_witness_statements && report.original_witness_statements.length > 0 ? (
                report.original_witness_statements.map((stmt, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 text-sm text-slate-300 font-mono leading-relaxed"
                  >
                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                      Statement #{idx + 1}:
                    </span>
                    "{stmt}"
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No original text statements found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
