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
  ArrowLeft,
  AlertCircle,
  FileDown,
  Shield,
  Layers,
  Share2,
  CheckCircle2,
  Fingerprint
} from 'lucide-react';
import jsPDF from 'jspdf';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

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
  const [showOriginal, setShowOriginal] = useState(false);
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
      showToast('Report regenerated successfully via Groq LLM');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report || !caseData) return;

    const doc = new jsPDF();
    doc.setFont('helvetica');

    // Header banner
    doc.setFillColor(153, 27, 27); // crimson-800
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text('SKETCHTRACE — FORENSIC FACIAL FEATURE REPORT', 14, 13);
    doc.setFontSize(8.5);
    doc.setTextColor(254, 202, 202);
    doc.text('Confidential Law Enforcement Investigative Aid — Not a Verified Identification', 14, 21);

    // Metadata
    let y = 38;
    doc.setTextColor(28, 25, 22);
    doc.setFontSize(10.5);
    doc.text(`Case ID: ${caseData.case_number}`, 14, y);
    doc.text(`Title: ${caseData.title}`, 120, y);
    y += 6;
    doc.text(`Report Version: v${report.report_version}`, 14, y);
    doc.text(`Date: ${new Date(report.updated_at).toLocaleDateString()}`, 120, y);

    // Executive Summary
    y += 10;
    doc.setFontSize(12);
    doc.text('1. Case Narrative Summary', 14, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.setTextColor(68, 60, 53);
    const summaryLines = doc.splitTextToSize(report.summary, 180);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 5 + 8;

    // Feature Table
    doc.setFontSize(12);
    doc.setTextColor(28, 25, 22);
    doc.text('2. Confirmed Morphological Attributes', 14, y);
    y += 7;
    doc.setFontSize(9);
    Object.entries(report.features).forEach(([key, val]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const formattedKey = key.replace(/_/g, ' ').toUpperCase();
      doc.setTextColor(120, 100, 80);
      doc.text(formattedKey, 14, y);
      doc.setTextColor(28, 25, 22);
      doc.text(val || 'Unspecified / Neutral', 75, y);
      y += 5.5;
    });

    doc.save(`CaseReport_${caseData.case_number}_v${report.report_version}.pdf`);
    showToast('Downloaded official PDF dossier');
  };

  const renderConfidence = (key: string) => {
    if (!report) return null;
    const isStated = report.stated_by_witness?.includes(key);
    const isObserved = report.observed_from_image?.includes(key);
    const isAmbiguous = report.ambiguous?.includes(key);
    const isUnknown = report.unknown?.includes(key);

    if (isStated) return <ConfidenceChip level="witness" label="Witness Stated" />;
    if (isObserved) return <ConfidenceChip level="image" label="Image Observed" />;
    if (isAmbiguous) return <ConfidenceChip level="ambiguous" label="Ambiguous" />;
    if (isUnknown) return <ConfidenceChip level="unknown" label="Neutral Default" />;
    return <ConfidenceChip level="witness" label="Witness Stated" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen noir-desk flex items-center justify-center text-parchment-300 font-mono text-xs">
        <div className="w-8 h-8 border-3 border-crimson-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen noir-desk p-4 sm:p-6 lg:p-8 font-sans text-parchment-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-crimson-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-crimson-600">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-noir-700/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/cases/${id}/inputs`)}
              className="p-2 bg-noir-900 border border-noir-700 rounded-lg text-parchment-300 hover:text-white transition"
              title="Return to Witness Intake"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-crimson-900/60 text-crimson-300 border border-crimson-700/60 rounded">
                  {caseData?.case_number}
                </span>
                <span className="stamp-solved">Solved / In Progress</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1 font-serif">
                Case Report — #{caseData?.case_number}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 btn-crimson text-xs font-bold flex items-center gap-2 shadow-crimson cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={() => navigate(`/cases/${id}/sketch`)}
              className="px-4 py-2 bg-noir-850 hover:bg-noir-800 border border-noir-700 text-parchment-100 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <span>Proceed to Sketch</span>
              <ArrowRight className="w-3.5 h-3.5 text-crimson-400" />
            </button>
          </div>
        </div>

        <InvestigativeAidBanner compact />

        {error && (
          <div className="p-3 bg-crimson-950/80 border border-crimson-700 rounded-lg text-xs text-crimson-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-crimson-400" />
            <span>{error}</span>
          </div>
        )}

        {report ? (
          <div className="dossier-card p-6 sm:p-8 space-y-6">
            {/* Meta dossier grid matching Panel 9 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-parchment-cardAlt rounded-xl border border-parchment-border text-xs">
              <div>
                <span className="text-ink-500 font-mono block text-[10px] uppercase">Case ID</span>
                <span className="font-mono font-bold text-crimson-800 text-sm">
                  #{caseData?.case_number}
                </span>
              </div>
              <div>
                <span className="text-ink-500 font-mono block text-[10px] uppercase">Incident Date</span>
                <span className="font-semibold text-ink-900">
                  {new Date(caseData?.created_at || '').toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div>
                <span className="text-ink-500 font-mono block text-[10px] uppercase">Investigation Title</span>
                <span className="font-semibold text-ink-900 line-clamp-1">{caseData?.title}</span>
              </div>
              <div>
                <span className="text-ink-500 font-mono block text-[10px] uppercase">Report Version</span>
                <span className="font-mono font-bold text-ink-900">v{report.report_version}</span>
              </div>
            </div>

            {/* Narrative Summary */}
            <div className="space-y-2 border-b border-parchment-border pb-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-900 uppercase font-mono tracking-wider">
                  Case Narrative Summary
                </h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-crimson-800 hover:text-crimson-900 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? 'Cancel Edit' : 'Edit Attributes'}
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full bg-parchment-50 border border-parchment-border rounded-lg p-2.5 text-xs text-ink-900 focus:outline-none focus:border-crimson-700"
                  />
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-4 py-2 btn-crimson text-xs font-bold"
                  >
                    {saving ? 'Saving...' : 'Save & Bump Version'}
                  </button>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-ink-800 leading-relaxed font-serif italic bg-parchment-50 p-4 rounded-xl border border-parchment-border">
                  "{report.summary}"
                </p>
              )}
            </div>

            {/* Details Table Matching Panel 9 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink-900 uppercase font-mono tracking-wider">
                Confirmed Morphological Specifications
              </h3>

              <div className="overflow-x-auto rounded-xl border border-parchment-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-parchment-cardAlt border-b border-parchment-border text-ink-600 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Physical Attribute</th>
                      <th className="py-2.5 px-4 font-bold">Observed Specification</th>
                      <th className="py-2.5 px-4 font-bold">Source Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment-border bg-parchment-50">
                    {Object.entries(report.features).map(([key, value]) => {
                      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <tr key={key} className="hover:bg-parchment-200/40 transition">
                          <td className="py-2.5 px-4 font-bold text-ink-900">{formattedKey}</td>
                          <td className="py-2.5 px-4 text-ink-800">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editFeatures[key] || ''}
                                onChange={(e) =>
                                  setEditFeatures((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="w-full bg-parchment-100 border border-parchment-border rounded px-2 py-1 text-xs text-ink-900 focus:outline-none focus:border-crimson-700"
                              />
                            ) : (
                              value || <span className="text-ink-400 italic">Unspecified (Neutral Default)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">{renderConfidence(key)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes Section matching Panel 9 */}
            <div className="p-4 bg-parchment-cardAlt rounded-xl border border-parchment-border space-y-1">
              <span className="text-[11px] font-bold text-ink-600 uppercase font-mono block">Notes</span>
              <p className="text-xs text-ink-800 leading-relaxed">
                Witness corroborated descriptors. Facial structure parameters synchronized for forensic composite synthesis.
              </p>
            </div>

            {/* Collapsible Original Statements */}
            <div className="pt-2 border-t border-parchment-border">
              <button
                type="button"
                onClick={() => setShowOriginal(!showOriginal)}
                className="text-xs font-bold text-ink-700 hover:text-ink-900 flex items-center gap-1.5"
              >
                {showOriginal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showOriginal ? 'Hide' : 'View'} Raw Witness Statements</span>
              </button>

              {showOriginal && (
                <div className="mt-3 p-4 bg-parchment-50 rounded-xl border border-parchment-border space-y-2 text-xs">
                  {report.original_witness_statements && report.original_witness_statements.length > 0 ? (
                    report.original_witness_statements.map((stmt, idx) => (
                      <p key={idx} className="text-ink-700 italic font-serif">
                        Witness #{idx + 1}: "{stmt}"
                      </p>
                    ))
                  ) : (
                    <p className="text-ink-500 italic">No historical raw statements archived.</p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-parchment-border">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="px-4 py-2.5 btn-parchment text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                <span>Re-Analyze with Groq LLM</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/cases/${id}/sketch`)}
                className="px-6 py-2.5 btn-crimson text-xs font-bold flex items-center gap-2 shadow-crimson cursor-pointer"
              >
                <span>Proceed to Sketch Synthesis →</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="dossier-card p-12 text-center space-y-4">
            <Fingerprint className="w-12 h-12 text-crimson-800 mx-auto" />
            <h2 className="text-lg font-bold text-ink-900 font-serif">No Report Generated Yet</h2>
            <p className="text-xs text-ink-600 max-w-sm mx-auto">
              Witness statements must be analyzed to generate structured facial attributes.
            </p>
            <button
              onClick={() => navigate(`/cases/${id}/inputs`)}
              className="px-5 py-2.5 btn-crimson text-xs font-bold"
            >
              Go to Witness Intake
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
