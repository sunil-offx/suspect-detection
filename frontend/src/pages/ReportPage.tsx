import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { jsPDF } from 'jspdf';
import {
  FileText,
  Sparkles,
  Download,
  ArrowRight,
  ArrowLeft,
  Check,
  Edit3,
  RefreshCw,
  AlertCircle,
  Eye,
  Shield,
  Fingerprint,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';
import { ConfidenceChip } from '../components/ConfidenceChips';

interface ReportData {
  id: string;
  report_version: number;
  summary: string;
  features: Record<string, string | null>;
  stated_by_witness: string[];
  observed_from_image: string[];
  ambiguous: string[];
  unknown: string[];
  original_witness_statements?: string[];
  created_at: string;
}

export const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<ReportData | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFeatures, setEditFeatures] = useState<Record<string, string>>({});
  const [editSummary, setEditSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchReport = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [reportRes, caseRes] = await Promise.all([
        api.get(`/api/cases/${id}/report`),
        api.get(`/api/cases/${id}`)
      ]);
      setReport(reportRes.data);
      setCaseData(caseRes.data);
      if (reportRes.data) {
        setEditSummary(reportRes.data.summary || '');
        const currentFeats: Record<string, string> = {};
        Object.entries(reportRes.data.features || {}).forEach(([k, v]) => {
          currentFeats[k] = (v as string) || '';
        });
        setEditFeatures(currentFeats);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setReport(null);
      } else {
        setError(err.response?.data?.detail || 'Failed to load report data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!id) return;
    setRegenerating(true);
    setError(null);
    try {
      let res;
      try {
        res = await api.post(`/api/cases/${id}/analyze`);
      } catch (err: any) {
        if (err.response?.status === 503) {
          res = await api.post(`/api/cases/${id}/analyze?use_fixture=true`);
          showToast('Analyzed using test fixture (Groq AI not configured)');
        } else {
          throw err;
        }
      }
      setReport(res.data);
      showToast('New report version generated successfully');
      await fetchReport();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Re-analysis failed');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.put(`/api/cases/${id}/report`, {
        features: editFeatures,
        summary: editSummary
      });
      setReport(res.data);
      setIsEditing(false);
      showToast(`Saved as Report Version ${res.data.report_version}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update report');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report || !caseData) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 18;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SKETCHTRACE FORENSIC FEATURE REPORT', margin, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toUTCString()} | System: SketchTrace AI Forensics`, margin, y + 6);

    y = 36;

    // Case Details
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 24, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('Case Number:', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(caseData.case_number, margin + 30, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Title:', margin + 4, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(caseData.title, margin + 15, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.text('Report Version:', margin + 4, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(`v${report.report_version}`, margin + 32, y + 20);

    y += 32;

    // Summary
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('CASE SUMMARY NARRATIVE', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const splitSummary = doc.splitTextToSize(report.summary || 'No summary available.', pageWidth - 2 * margin);
    doc.text(splitSummary, margin, y);
    y += splitSummary.length * 4.5 + 8;

    // Morphological Features Table
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFIRMED MORPHOLOGICAL SPECIFICATIONS', margin, y);
    y += 6;

    doc.setFontSize(8.5);
    Object.entries(report.features).forEach(([key, value]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const formattedKey = key.replace(/_/g, ' ').toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(formattedKey, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(value ? String(value) : 'Unspecified', margin + 65, y);
      y += 5.5;
    });

    // Legal disclaimer
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(
        'LEGAL ADVISORY: AI-GENERATED INVESTIGATIVE AID — NOT A VERIFIED IDENTIFICATION',
        margin,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(`${caseData.case_number}_Feature_Report_v${report.report_version}.pdf`);
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
      <div className="min-h-screen noir-desk flex items-center justify-center text-parchment-200 font-mono text-xs">
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
              className="p-2 bg-noir-900 border border-noir-700 rounded-lg text-parchment-200 hover:text-white transition"
              title="Return to Witness Intake"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-crimson-900/60 text-crimson-200 border border-crimson-700/60 rounded">
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
              className="px-4 py-2 bg-noir-850 hover:bg-noir-800 border border-noir-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <span>Proceed to Sketch</span>
              <ArrowRight className="w-3.5 h-3.5 text-crimson-400" />
            </button>
          </div>
        </div>

        <InvestigativeAidBanner compact />

        {error && (
          <div className="p-3 bg-crimson-950/80 border border-crimson-700 rounded-lg text-xs text-crimson-200 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-crimson-400" />
            <span>{error}</span>
          </div>
        )}

        {report ? (
          <div className="dossier-card p-6 sm:p-8 space-y-6 border-2 border-parchment-border">
            {/* Meta dossier grid matching Panel 9 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-parchment-cardAlt rounded-xl border border-parchment-border text-xs">
              <div>
                <span className="text-ink-800 font-mono font-bold block text-[10px] uppercase">Case ID</span>
                <span className="font-mono font-bold text-crimson-900 text-sm">
                  #{caseData?.case_number}
                </span>
              </div>
              <div>
                <span className="text-ink-800 font-mono font-bold block text-[10px] uppercase">Incident Date</span>
                <span className="font-bold text-ink-950">
                  {new Date(caseData?.created_at || '').toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div>
                <span className="text-ink-800 font-mono font-bold block text-[10px] uppercase">Investigation Title</span>
                <span className="font-bold text-ink-950 line-clamp-1">{caseData?.title}</span>
              </div>
              <div>
                <span className="text-ink-800 font-mono font-bold block text-[10px] uppercase">Report Version</span>
                <span className="font-mono font-bold text-ink-950">v{report.report_version}</span>
              </div>
            </div>

            {/* Narrative Summary */}
            <div className="space-y-2 border-b border-parchment-border pb-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-950 uppercase font-mono tracking-wider">
                  Case Narrative Summary
                </h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-crimson-800 hover:text-crimson-950 flex items-center gap-1"
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
                    className="w-full bg-white border border-parchment-border rounded-lg p-2.5 text-xs text-ink-950 font-medium focus:outline-none focus:border-crimson-700"
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
                <p className="text-xs sm:text-sm text-ink-950 leading-relaxed font-serif italic bg-white p-4 rounded-xl border border-parchment-border">
                  "{report.summary}"
                </p>
              )}
            </div>

            {/* Details Table Matching Panel 9 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink-950 uppercase font-mono tracking-wider">
                Confirmed Morphological Specifications
              </h3>

              <div className="overflow-x-auto rounded-xl border border-parchment-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-parchment-cardAlt border-b border-parchment-border text-ink-950 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Physical Attribute</th>
                      <th className="py-2.5 px-4 font-bold">Observed Specification</th>
                      <th className="py-2.5 px-4 font-bold">Source Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment-border bg-white">
                    {Object.entries(report.features).map(([key, value]) => {
                      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <tr key={key} className="hover:bg-parchment-100/60 transition">
                          <td className="py-2.5 px-4 font-bold text-ink-950">{formattedKey}</td>
                          <td className="py-2.5 px-4 text-ink-950 font-medium">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editFeatures[key] || ''}
                                onChange={(e) =>
                                  setEditFeatures((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="w-full bg-white border border-parchment-border rounded px-2 py-1 text-xs text-ink-950 focus:outline-none focus:border-crimson-700"
                              />
                            ) : (
                              value || <span className="text-ink-600 italic font-medium">Unspecified (Neutral Default)</span>
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
              <span className="text-[11px] font-bold text-ink-950 uppercase font-mono block">Notes</span>
              <p className="text-xs text-ink-900 font-medium leading-relaxed">
                Witness corroborated descriptors. Facial structure parameters synchronized for forensic composite synthesis.
              </p>
            </div>

            {/* Collapsible Original Statements */}
            <div className="pt-2 border-t border-parchment-border">
              <button
                type="button"
                onClick={() => setShowOriginal(!showOriginal)}
                className="text-xs font-bold text-ink-900 hover:text-black flex items-center gap-1.5"
              >
                {showOriginal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showOriginal ? 'Hide' : 'View'} Raw Witness Statements</span>
              </button>

              {showOriginal && (
                <div className="mt-3 p-4 bg-white rounded-xl border border-parchment-border space-y-2 text-xs">
                  {report.original_witness_statements && report.original_witness_statements.length > 0 ? (
                    report.original_witness_statements.map((stmt, idx) => (
                      <p key={idx} className="text-ink-950 italic font-serif font-medium">
                        Witness #{idx + 1}: "{stmt}"
                      </p>
                    ))
                  ) : (
                    <p className="text-ink-700 italic font-medium">No historical raw statements archived.</p>
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
          <div className="dossier-card p-12 text-center space-y-4 border-2 border-parchment-border">
            <Fingerprint className="w-12 h-12 text-crimson-800 mx-auto" />
            <h2 className="text-lg font-bold text-ink-950 font-serif">No Report Generated Yet</h2>
            <p className="text-xs text-ink-800 font-medium max-w-sm mx-auto">
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
