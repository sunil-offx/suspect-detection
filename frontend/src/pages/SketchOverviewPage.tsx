import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { jsPDF } from 'jspdf';
import {
  Shield,
  Download,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sliders,
  History,
  Copy,
  Check,
  AlertCircle,
  Eye,
  FileCheck,
  Calendar,
  Tag,
  ArrowLeft
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';
import { ConfidenceMatrix } from '../components/ConfidenceChips';

interface CaseData {
  id: string;
  case_number: string;
  title: string;
  status: string;
  external_reference?: string;
  created_at: string;
  updated_at: string;
}

interface WitnessInputItem {
  id: string;
  input_type: string;
  original_text?: string;
  transcription?: string;
  created_at: string;
}

interface ReportItem {
  id: string;
  report_version: number;
  summary: string;
  features: Record<string, any>;
  stated_by_witness: string[];
  observed_from_image: string[];
  unknown: string[];
  ambiguous: string[];
  created_at: string;
}

interface SketchItem {
  id: string;
  sketch_version: number;
  image_reference: string;
  generation_prompt_version: string;
  refinement_notes?: string;
  created_at: string;
}

interface CaseOverviewResponse {
  case: CaseData;
  inputs: WitnessInputItem[];
  reports: ReportItem[];
  sketches: SketchItem[];
  latest_report?: ReportItem;
  latest_sketch?: SketchItem;
  last_workflow_state: string;
}

export const SketchOverviewPage: React.FC = () => {
  const { caseId: paramCaseId, id: paramId } = useParams<{ caseId?: string; id?: string }>();
  const caseId = paramCaseId || paramId;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<CaseOverviewResponse | null>(null);

  const [selectedSketchIndex, setSelectedSketchIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, [caseId]);

  const fetchOverview = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CaseOverviewResponse>(`/api/cases/${caseId}/overview`);
      setOverview(res.data);
      if (res.data.sketches && res.data.sketches.length > 0) {
        setSelectedSketchIndex(res.data.sketches.length - 1);
      }
    } catch (err: any) {
      console.error('Failed to load case overview:', err);
      setError(err.response?.data?.detail || 'Failed to load case overview');
    } finally {
      setLoading(false);
    }
  };

  const currentSketch = overview?.sketches?.[selectedSketchIndex];
  const activeReport = overview?.latest_report;

  // Load sketch image when selectedSketch changes
  useEffect(() => {
    let active = true;
    if (currentSketch?.image_reference) {
      api
        .get(`/api/files/${currentSketch.image_reference}`, {
          responseType: 'blob'
        })
        .then((res) => {
          if (active) {
            const url = URL.createObjectURL(res.data);
            setImageUrl(url);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch sketch image:', err);
          if (active) setImageUrl(null);
        });
    } else {
      setImageUrl(null);
    }
    return () => {
      active = false;
    };
  }, [currentSketch]);

  const copyRefToken = () => {
    if (currentSketch?.image_reference) {
      navigator.clipboard.writeText(currentSketch.image_reference);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const downloadPNG = () => {
    if (!imageUrl || !overview) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${overview.case.case_number}_sketch_v${currentSketch?.sketch_version || 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDFDossier = () => {
    if (!overview) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 15;

    // Header Title
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.text('CRIMESKETCH AI — FORENSIC INVESTIGATIVE DOSSIER', margin, y);
    y += 8;

    // Mandatory Disclaimer Banner at Top
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(254, 243, 199); // amber-100
    doc.rect(margin, y, pageWidth - 2 * margin, 12, 'F');
    doc.text('*** AI-GENERATED INVESTIGATIVE AID — NOT A VERIFIED IDENTIFICATION ***', margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Generated for lead generation only. Inadmissible as sole identification evidence.', margin + 3, y + 9.5);
    y += 18;

    // Case Details Table
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('CASE IDENTIFICATION', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Case Number: ${overview.case.case_number}`, margin, y);
    doc.text(`Status: ${overview.case.status.toUpperCase()}`, margin + 80, y);
    y += 5;
    doc.text(`Case Title: ${overview.case.title}`, margin, y);
    doc.text(`RMS Reference: ${overview.case.external_reference || 'N/A'}`, margin + 80, y);
    y += 5;
    doc.text(`Date Created: ${new Date(overview.case.created_at).toLocaleString()}`, margin, y);
    doc.text(`Active Version: v${currentSketch?.sketch_version || 1} of ${overview.sketches.length}`, margin + 80, y);
    y += 10;

    // Facial Feature Summary
    if (activeReport) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('FACIAL FEATURE PROFILE SUMMARY', margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const splitSummary = doc.splitTextToSize(activeReport.summary || 'No summary available.', pageWidth - 2 * margin);
      doc.text(splitSummary, margin, y);
      y += splitSummary.length * 4.5 + 4;

      // Key Features
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Observed & Stated Descriptors:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const features = activeReport.features || {};
      const featureKeys = Object.keys(features);
      let count = 0;
      for (const k of featureKeys) {
        const val = features[k];
        if (val) {
          const formattedKey = k.replace(/_/g, ' ').toUpperCase();
          doc.text(`• ${formattedKey}: ${val}`, margin + (count % 2 === 0 ? 0 : 85), y);
          if (count % 2 === 1) y += 4.5;
          count++;
          if (y > 270) {
            doc.addPage();
            y = 15;
          }
        }
      }
      if (count % 2 !== 0) y += 4.5;
      y += 6;
    }

    // Refinement Notes
    if (currentSketch?.refinement_notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Refinement History:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(currentSketch.refinement_notes, pageWidth - 2 * margin);
      doc.text(splitNotes, margin, y);
      y += splitNotes.length * 4 + 6;
    }

    // Mandatory Footer Banner on every page
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
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`${overview.case.case_number}_Forensic_Dossier_v${currentSketch?.sketch_version || 1}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading Case Overview & Forensic Records...</p>
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="max-w-md bg-slate-900 border border-red-500/30 p-6 rounded-xl text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Case Overview</h2>
          <p className="text-sm text-slate-400 mb-6">{error || 'Case records could not be retrieved.'}</p>
          <button
            onClick={() => navigate('/cases')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition"
          >
            Back to Case History
          </button>
        </div>
      </div>
    );
  }

  const sketches = overview.sketches || [];
  const hasSketches = sketches.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cases')}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Return to Case History"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2.5 py-1 bg-blue-950 text-blue-300 border border-blue-800 rounded-md font-bold">
                  {overview.case.case_number}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    overview.case.status === 'completed'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                      : overview.case.status === 'in_progress'
                      ? 'bg-blue-950/80 text-blue-400 border border-blue-800'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {overview.case.status.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1">{overview.case.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/cases/${caseId}/refine`}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg transition"
            >
              <Sliders className="w-4 h-4" />
              Refine Sketch
            </Link>
            <Link
              to={`/cases/${caseId}/report`}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium flex items-center gap-2 transition"
            >
              <FileCheck className="w-4 h-4" />
              Edit Report
            </Link>
          </div>
        </div>

        {/* Mandatory Forensic Disclaimer Banner */}
        <InvestigativeAidBanner />

        {/* 2-Column Split: Left Panel (Sketch Visual & Versions), Right Panel (Metadata & Features) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Spec §10 Visual Canvas, Version Nav, Downloads */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Forensic Composite Canvas
                  </h3>
                </div>
                {hasSketches && (
                  <span className="text-xs px-2.5 py-0.5 bg-blue-950/80 text-blue-300 border border-blue-800/80 rounded-full font-mono font-bold">
                    Version {currentSketch?.sketch_version || 1} of {sketches.length}
                  </span>
                )}
              </div>

              {/* Canvas Container */}
              <div className="w-full aspect-square bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden relative shadow-inner group">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt={`Suspect Sketch v${currentSketch?.sketch_version}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-slate-950/80 backdrop-blur border border-slate-800 rounded text-[10px] font-mono text-slate-400">
                      v{currentSketch?.sketch_version} • {currentSketch?.generation_prompt_version}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-slate-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-medium">No sketch visual currently generated</p>
                    <Link
                      to={`/cases/${caseId}/sketch`}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Initial Sketch
                    </Link>
                  </div>
                )}
              </div>

              {/* Version Navigation */}
              {hasSketches && sketches.length > 1 && (
                <div className="mt-4 flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <button
                    disabled={selectedSketchIndex === 0}
                    onClick={() => setSelectedSketchIndex((prev) => Math.max(0, prev - 1))}
                    className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
                    title="Previous Version"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] py-1">
                    {sketches.map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSketchIndex(idx)}
                        className={`px-2.5 py-1 text-xs rounded font-mono font-medium transition ${
                          selectedSketchIndex === idx
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        v{s.sketch_version}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={selectedSketchIndex === sketches.length - 1}
                    onClick={() => setSelectedSketchIndex((prev) => Math.min(sketches.length - 1, prev + 1))}
                    className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
                    title="Next Version"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Storage Reference Display */}
              {currentSketch?.image_reference && (
                <div className="mt-4 p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <div className="truncate mr-2">
                    <span className="text-slate-500 mr-1.5 font-medium">Ref Token:</span>
                    <span className="font-mono text-slate-300">{currentSketch.image_reference}</span>
                  </div>
                  <button
                    onClick={copyRefToken}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                    title="Copy Token"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {/* Download Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  disabled={!imageUrl}
                  onClick={downloadPNG}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  Download PNG
                </button>
                <button
                  disabled={!overview}
                  onClick={downloadPDFDossier}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <FileText className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Spec §10 Case Metadata, Features, Refinement History */}
          <div className="lg:col-span-7 space-y-6">
            {/* Case Metadata Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                Case Metadata & Registry Details
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Case Number</span>
                  <span className="font-mono font-bold text-blue-300">{overview.case.case_number}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">RMS Reference</span>
                  <span className="font-mono text-slate-300">{overview.case.external_reference || 'None Assigned'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Status</span>
                  <span className="font-semibold capitalize text-emerald-400">{overview.case.status}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Created At</span>
                  <span className="text-slate-300">{new Date(overview.case.created_at).toLocaleDateString()}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Last Updated</span>
                  <span className="text-slate-300">{new Date(overview.case.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Total Sketch Iterations</span>
                  <span className="font-bold text-slate-200">{sketches.length} recorded</span>
                </div>
              </div>
            </div>

            {/* Confirmed Facial Features Card */}
            {activeReport && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    Confirmed Facial Feature Matrix (v{activeReport.report_version})
                  </h3>
                  <Link
                    to={`/cases/${caseId}/report`}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    Modify Matrix →
                  </Link>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider block mb-1">
                    Forensic Summary
                  </span>
                  {activeReport.summary}
                </div>

                {/* Categorized Confidence Chips */}
                <ConfidenceMatrix
                  statedByWitness={activeReport.stated_by_witness || []}
                  observedFromImage={activeReport.observed_from_image || []}
                  unknown={activeReport.unknown || []}
                  ambiguous={activeReport.ambiguous || []}
                />

                {/* Feature Key-Value Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                  {Object.entries(activeReport.features || {}).map(([key, val]) => (
                    <div key={key} className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                      <span className="text-slate-500 block capitalize text-[11px] mb-0.5">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium text-slate-200">
                        {val ? String(val) : <span className="text-slate-600 italic">Unspecified</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Iterative Refinement Timeline */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                Refinement Timeline & Revision Log
              </h3>

              {sketches.length > 0 ? (
                <div className="space-y-3">
                  {sketches.map((sk) => (
                    <div
                      key={sk.id}
                      className={`p-3 rounded-lg border text-xs transition ${
                        sk.sketch_version === currentSketch?.sketch_version
                          ? 'bg-blue-950/30 border-blue-600/60 ring-1 ring-blue-600/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-blue-300">
                          Version {sk.sketch_version}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {new Date(sk.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1">
                        {sk.refinement_notes || 'Initial composite generated from confirmed witness report.'}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">
                        Prompt Version: {sk.generation_prompt_version}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No refinement versions created yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
