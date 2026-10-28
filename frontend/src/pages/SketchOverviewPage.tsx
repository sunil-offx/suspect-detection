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
  ArrowLeft,
  Fingerprint
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
      setError(err.response?.data?.detail || 'Failed to retrieve case records.');
    } finally {
      setLoading(false);
    }
  };

  const currentSketch = overview?.sketches?.[selectedSketchIndex];
  const activeReport = overview?.latest_report || (overview?.reports && overview.reports[0]);

  // Load authenticated image blob for the selected sketch
  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    if (!currentSketch?.image_reference) {
      setImageUrl(null);
      return;
    }

    const fetchImg = async () => {
      try {
        const res = await api.get(`/api/sketches/${currentSketch.image_reference}/view`, {
          responseType: 'blob'
        });
        if (active) {
          const blobUrl = URL.createObjectURL(res.data);
          objectUrlToRevoke = blobUrl;
          setImageUrl(blobUrl);
        }
      } catch (err) {
        console.error('Failed to fetch authenticated sketch image blob:', err);
        if (active) setImageUrl(null);
      }
    };

    fetchImg();

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [currentSketch?.image_reference]);

  const copyRefToken = () => {
    if (currentSketch?.image_reference) {
      navigator.clipboard.writeText(currentSketch.image_reference);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const downloadPNG = () => {
    if (!imageUrl || !overview || !currentSketch) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${overview.case.case_number}_composite_v${currentSketch.sketch_version}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadPDFDossier = async () => {
    if (!overview) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 18;

    // Header Band
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FORENSIC DOSSIER & COMPOSITE RECORD', margin, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toUTCString()} | System: SketchTrace AI Forensics`, margin, y + 6);
    y = 36;

    // Case Identification Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 24, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('Case Number:', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(overview.case.case_number, margin + 30, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('RMS / CAD Ref:', margin + 70, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(overview.case.external_reference || 'None', margin + 98, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Title:', margin + 4, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(overview.case.title, margin + 15, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.text('Status:', margin + 4, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(overview.case.status.toUpperCase(), margin + 18, y + 20);

    y += 30;

    // Sketch Image if present
    if (imageUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const imgWidth = 70;
        const imgHeight = 70;
        doc.addImage(img, 'PNG', margin, y, imgWidth, imgHeight);

        // Beside Sketch: Sketch Specs
        const specX = margin + imgWidth + 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('COMPOSITE SPECIFICATIONS', specX, y + 5);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Version: v${currentSketch?.sketch_version || 1}`, specX, y + 13);
        doc.text(`Prompt Version: ${currentSketch?.generation_prompt_version || 'N/A'}`, specX, y + 19);
        doc.text(`Storage Token: ${currentSketch?.image_reference || 'N/A'}`, specX, y + 25);
        doc.text(`Created: ${currentSketch?.created_at ? new Date(currentSketch.created_at).toLocaleDateString() : 'N/A'}`, specX, y + 31);

        y += imgHeight + 8;
      } catch (err) {
        console.warn('Could not render image onto PDF:', err);
      }
    }

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

  if (loading) {
    return (
      <div className="min-h-screen noir-desk text-parchment-300 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-crimson-700/20 border-t-crimson-600 rounded-full animate-spin"></div>
          <p className="text-sm font-serif italic text-parchment-300">Loading Case Overview & Forensic Records...</p>
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="min-h-screen noir-desk text-parchment-100 p-8 flex items-center justify-center font-sans">
        <div className="max-w-md dossier-card p-6 text-center shadow-xl border-crimson-700/40">
          <AlertCircle className="w-12 h-12 text-crimson-700 mx-auto mb-4" />
          <h2 className="text-xl font-serif font-bold text-ink-950 mb-2">Error Loading Case Overview</h2>
          <p className="text-sm text-ink-700 mb-6">{error || 'Case records could not be retrieved.'}</p>
          <button
            onClick={() => navigate('/cases')}
            className="btn-crimson px-4 py-2 rounded-xl text-xs font-semibold"
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
    <div className="min-h-screen noir-desk text-parchment-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-noir-800 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cases')}
              className="p-2 btn-parchment rounded-xl"
              title="Return to Case History"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2.5 py-0.5 bg-parchment-100 text-crimson-900 border border-parchment-border rounded-md font-bold">
                  {overview.case.case_number}
                </span>
                {getStatusStamp(overview.case.status)}
              </div>
              <h1 className="text-2xl font-serif font-bold text-white tracking-tight mt-1">{overview.case.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/cases/${caseId}/refine`}
              className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              Refine Sketch
            </Link>
            <Link
              to={`/cases/${caseId}/report`}
              className="btn-parchment px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
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
          {/* Left Panel: Visual Canvas, Version Nav, Downloads */}
          <div className="lg:col-span-5 space-y-4">
            <div className="dossier-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-crimson-800" />
                  <h3 className="text-sm font-serif font-bold text-ink-950 uppercase tracking-wider">
                    Forensic Composite Canvas
                  </h3>
                </div>
                {hasSketches && (
                  <span className="stamp-open text-[10px]">
                    Version {currentSketch?.sketch_version || 1} of {sketches.length}
                  </span>
                )}
              </div>

              {/* Canvas Container */}
              <div className="w-full aspect-square bg-white rounded-xl border-2 border-parchment-border flex items-center justify-center overflow-hidden relative shadow-dossier group">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt={`Suspect Sketch v${currentSketch?.sketch_version}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-noir-950/80 backdrop-blur border border-noir-700 rounded text-[10px] font-mono text-parchment-200">
                      v{currentSketch?.sketch_version} • {currentSketch?.generation_prompt_version}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-ink-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-2 text-ink-400" />
                    <p className="text-sm font-medium font-serif">No sketch visual currently generated</p>
                    <Link
                      to={`/cases/${caseId}/sketch`}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 btn-crimson rounded text-xs font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Initial Sketch
                    </Link>
                  </div>
                )}
              </div>

              {/* Version Navigation */}
              {hasSketches && sketches.length > 1 && (
                <div className="mt-4 flex items-center justify-between bg-parchment-100 p-2 rounded-xl border border-parchment-border">
                  <button
                    disabled={selectedSketchIndex === 0}
                    onClick={() => setSelectedSketchIndex((prev) => Math.max(0, prev - 1))}
                    className="p-1.5 rounded hover:bg-parchment-200 disabled:opacity-30 disabled:cursor-not-allowed text-ink-700"
                    title="Previous Version"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] py-1">
                    {sketches.map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSketchIndex(idx)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-mono font-medium transition ${
                          selectedSketchIndex === idx
                            ? 'btn-crimson !shadow-none font-bold'
                            : 'bg-parchment-50 text-ink-700 hover:bg-parchment-200'
                        }`}
                      >
                        v{s.sketch_version}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={selectedSketchIndex === sketches.length - 1}
                    onClick={() => setSelectedSketchIndex((prev) => Math.min(sketches.length - 1, prev + 1))}
                    className="p-1.5 rounded hover:bg-parchment-200 disabled:opacity-30 disabled:cursor-not-allowed text-ink-700"
                    title="Next Version"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Storage Reference Display */}
              {currentSketch?.image_reference && (
                <div className="mt-4 p-2.5 bg-parchment-100 rounded-xl border border-parchment-border flex items-center justify-between text-xs">
                  <div className="truncate mr-2">
                    <span className="text-ink-500 mr-1.5 font-medium font-serif">Ref Token:</span>
                    <span className="font-mono text-ink-900">{currentSketch.image_reference}</span>
                  </div>
                  <button
                    onClick={copyRefToken}
                    className="p-1 hover:bg-parchment-200 rounded text-ink-600 hover:text-ink-900 transition"
                    title="Copy Token"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {/* Download Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  disabled={!imageUrl}
                  onClick={downloadPNG}
                  className="w-full py-2 px-3 btn-parchment rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Download className="w-4 h-4 text-crimson-800" />
                  Download PNG
                </button>
                <button
                  disabled={!overview}
                  onClick={downloadPDFDossier}
                  className="w-full py-2 px-3 btn-crimson rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Case Metadata, Features, Refinement History */}
          <div className="lg:col-span-7 space-y-6">
            {/* Case Metadata Card */}
            <div className="dossier-card p-5 space-y-4">
              <h3 className="text-sm font-serif font-bold text-ink-950 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-crimson-800" />
                Case Metadata & Registry Details
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-parchment-50 p-3 rounded-xl border border-parchment-border">
                  <span className="text-ink-500 block mb-1 font-serif">Case Number</span>
                  <span className="font-mono font-bold text-crimson-900">{overview.case.case_number}</span>
                </div>
                <div className="bg-parchment-50 p-3 rounded-xl border border-parchment-border">
                  <span className="text-ink-500 block mb-1 font-serif">RMS Reference</span>
                  <span className="font-mono text-ink-900">{overview.case.external_reference || 'None Assigned'}</span>
                </div>
                <div className="bg-parchment-50 p-3 rounded-xl border border-parchment-border">
                  <span className="text-ink-500 block mb-1 font-serif">Status</span>
                  <span className="font-serif font-bold capitalize text-ink-950">{overview.case.status}</span>
                </div>
                <div className="bg-parchment-50 p-3 rounded-xl border border-parchment-border">
                  <span className="text-ink-500 block mb-1 font-serif">Created At</span>
                  <span className="text-ink-900 font-mono">{new Date(overview.case.created_at).toLocaleDateString()}</span>
                </div>
                <div className="bg-parchment-50 p-3 rounded-xl border border-parchment-border">
                  <span className="text-ink-500 block mb-1 font-serif">Last Updated</span>
                  <span className="text-ink-900 font-mono">{new Date(overview.case.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="bg-parchment-50 p-3 rounded-xl border border-parchment-border">
                  <span className="text-ink-500 block mb-1 font-serif">Total Iterations</span>
                  <span className="font-serif font-bold text-ink-950">{sketches.length} recorded</span>
                </div>
              </div>
            </div>

            {/* Confirmed Facial Features Card */}
            {activeReport && (
              <div className="dossier-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-serif font-bold text-ink-950 uppercase tracking-wider flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-crimson-800" />
                    Confirmed Facial Feature Matrix (v{activeReport.report_version})
                  </h3>
                  <Link
                    to={`/cases/${caseId}/report`}
                    className="text-xs text-crimson-800 hover:text-crimson-950 flex items-center gap-1 font-semibold"
                  >
                    Modify Matrix →
                  </Link>
                </div>

                <div className="p-3 bg-parchment-50 rounded-xl border border-parchment-border text-xs text-ink-800 leading-relaxed font-serif italic">
                  <span className="text-ink-500 not-italic font-bold uppercase tracking-wider block mb-1 text-[11px] font-sans">
                    Forensic Summary
                  </span>
                  "{activeReport.summary}"
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
                    <div key={key} className="bg-parchment-50 p-2.5 rounded-xl border border-parchment-border text-xs">
                      <span className="text-ink-500 block capitalize text-[11px] mb-0.5 font-serif">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-semibold text-ink-950">
                        {val ? String(val) : <span className="text-ink-400 italic">Unspecified</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Iterative Refinement Timeline */}
            <div className="dossier-card p-5 space-y-4">
              <h3 className="text-sm font-serif font-bold text-ink-950 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-crimson-800" />
                Refinement Timeline & Revision Log
              </h3>

              {sketches.length > 0 ? (
                <div className="space-y-3">
                  {sketches.map((sk) => (
                    <div
                      key={sk.id}
                      className={`p-3 rounded-xl border text-xs transition ${
                        sk.sketch_version === currentSketch?.sketch_version
                          ? 'bg-parchment-100 border-crimson-700/60 shadow-sm'
                          : 'bg-parchment-50 border-parchment-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-crimson-900">
                          Version {sk.sketch_version}
                        </span>
                        <span className="text-ink-500 text-[11px] font-mono">
                          {new Date(sk.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-ink-800 mt-1 font-serif">
                        {sk.refinement_notes || 'Initial composite generated from confirmed witness report.'}
                      </p>
                      <div className="mt-2 text-[10px] text-ink-400 font-mono">
                        Prompt Version: {sk.generation_prompt_version}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-500 italic font-serif">No refinement versions created yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
