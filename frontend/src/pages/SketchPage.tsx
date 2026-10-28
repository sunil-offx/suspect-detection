import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getFullImageUrl } from '../api/client';
import { ForensicImage } from '../components/ForensicImage';
import {
  Sparkles,
  Download,
  RefreshCw,
  Edit3,
  Sliders,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  CheckCircle2,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

interface CaseData {
  id: string;
  case_number: string;
  title: string;
  status: string;
}

interface ReportData {
  id: string;
  report_version: number;
  summary: string;
  features: Record<string, string | null>;
  stated_by_witness: string[];
}

interface SketchData {
  id: string;
  case_id: string;
  sketch_version: number;
  generation_prompt_version: string;
  prompt_used: string;
  image_reference: string;
  image_url: string;
  refinement_notes?: string;
  created_at: string;
}

export const SketchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [sketches, setSketches] = useState<SketchData[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error503, setError503] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError503(null);
    try {
      const [caseRes, reportRes, sketchesRes] = await Promise.all([
        api.get(`/api/cases/${id}`),
        api.get(`/api/cases/${id}/report`),
        api.get(`/api/cases/${id}/sketches`),
      ]);

      setCaseData(caseRes.data);
      setReport(reportRes.data);
      setSketches(sketchesRes.data);

      if (sketchesRes.data.length > 0) {
        setSelectedVersion(sketchesRes.data[0].sketch_version);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleGenerateSketch = async (fallbackToFixture: boolean = false) => {
    if (!id) return;
    setGenerating(true);
    setError503(null);

    const endpoint = fallbackToFixture
      ? `/api/cases/${id}/generate-sketch?use_fixture=true`
      : `/api/cases/${id}/generate-sketch`;

    try {
      const res = await api.post(endpoint);
      const newSketch = res.data;
      setSketches((prev) => [newSketch, ...prev]);
      setSelectedVersion(newSketch.sketch_version);
      showToast(`Sketch Version ${newSketch.sketch_version} generated successfully!`);
    } catch (err: any) {
      if (err.response?.status === 503) {
        setError503(err.response.data?.detail || 'IMAGE_PROVIDER is none or IMAGE_API_KEY is not set');
      } else {
        alert(err.response?.data?.detail || 'Generation failed');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (imageUrl: string, version: number) => {
    try {
      const res = await api.get(imageUrl, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `CrimeSketch_${caseData?.case_number || 'case'}_v${version}.png`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      showToast(`Downloaded Sketch Version ${version}`);
    } catch {
      const link = document.createElement('a');
      link.href = getFullImageUrl(imageUrl);
      link.download = `CrimeSketch_${caseData?.case_number || 'case'}_v${version}.png`;
      link.click();
      showToast(`Downloaded Sketch Version ${version}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Loading forensic sketch workstation...</p>
      </div>
    );
  }

  const activeSketch = sketches.find((s) => s.sketch_version === selectedVersion) || sketches[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-blue-400/40">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Forensic Banner */}
      <div className="bg-slate-900/90 border-b border-slate-800 py-2.5 px-4 text-center">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-slate-300">CONFIDENTIAL FORENSIC COMPOSITE AID:</span>
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
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-medium">
                {sketches.length} {sketches.length === 1 ? 'Version' : 'Versions'} Generated
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{caseData?.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleGenerateSketch(false)}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {sketches.length === 0 ? 'Generate First Sketch' : 'Generate Again'}
            </button>

            {sketches.length > 0 && (
              <button
                onClick={() => navigate(`/cases/${id}/refine`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30"
              >
                <Sliders className="w-4 h-4" />
                Adjust Facial Structure
              </button>
            )}

            <button
              onClick={() => navigate(`/cases/${id}/report`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            >
              <Edit3 className="w-4 h-4" />
              Edit Features
            </button>

            {activeSketch && (
              <button
                onClick={() => handleDownload(activeSketch.image_url, activeSketch.sketch_version)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors border border-slate-700"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
            )}

            <button
              onClick={() => navigate(`/cases/${id}/overview`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-colors border border-slate-700 ml-1"
            >
              Overview & Finalize
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 503 Provider Error Alert */}
        {error503 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-amber-200 space-y-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-base">AI Image Provider Not Configured (HTTP 503)</h3>
                <p className="text-sm text-amber-300/80">{error503}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleGenerateSketch(false)}
                className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 text-amber-100 text-xs font-semibold border border-amber-500/40"
              >
                Retry API Call
              </button>
              <button
                onClick={() => handleGenerateSketch(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Generate With Verified Test Fixture
              </button>
            </div>
          </div>
        )}

        {/* Side-by-Side: Confirmed Report & Sketch Composite */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Confirmed Facial Feature Matrix (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-slate-800/80 pb-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Confirmed Feature Specifications
                </h2>
                <p className="text-xs text-slate-400">Fixed forensic pencil prompt v1</p>
              </div>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-blue-600/10 text-blue-400 border border-blue-500/20">
                v{report?.report_version}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {report &&
                Object.entries(report.features).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs gap-3"
                  >
                    <span className="uppercase text-slate-400 font-mono font-medium text-[10px] shrink-0 pt-0.5">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-right font-medium ${val ? 'text-slate-100' : 'text-slate-500 italic'}`}>
                      {val || 'Neutral standard'}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Right: Pure 2D Sketch Image Display (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            {/* Header: Title & Versions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">Forensic Sketch Composite</h2>
              </div>

              {sketches.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 px-2">Versions:</span>
                  {sketches.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedVersion(s.sketch_version)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        selectedVersion === s.sketch_version
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      v{s.sketch_version}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Visual Display */}
            {sketches.length > 0 && activeSketch ? (
              <div className="space-y-5">
                <div className="relative aspect-square max-w-lg mx-auto bg-white rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800 flex items-center justify-center group">
                  <ForensicImage
                    src={getFullImageUrl(activeSketch.image_url)}
                    alt={`Composite Sketch Version ${activeSketch.sketch_version}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-slate-300 border border-slate-800 mono-font">
                    Version {activeSketch.sketch_version} • {activeSketch.generation_prompt_version}
                  </div>
                  <button
                    onClick={() => handleDownload(activeSketch.image_url, activeSketch.sketch_version)}
                    className="absolute top-3 right-3 bg-slate-950/80 hover:bg-slate-950 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700 shadow-lg"
                    title="Download PNG"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                {activeSketch.refinement_notes && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                    <span className="font-semibold text-blue-400 block mb-1">Refinement Notes:</span>
                    {activeSketch.refinement_notes}
                  </div>
                )}

                {/* Synthesis & Generation Controls */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white">Generate Next Version</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Synthesize a new variation from confirmed facial descriptors.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto flex-wrap">
                    <button
                      onClick={() => navigate(`/cases/${id}/refine`)}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Adjust Structure
                    </button>

                    <button
                      onClick={() => handleGenerateSketch(false)}
                      disabled={generating}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generate Next Version
                    </button>

                    <button
                      onClick={() => handleGenerateSketch(true)}
                      disabled={generating}
                      className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Test Fixture
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Clean 2D Image Placeholder Canvas */}
                <div className="relative aspect-square max-w-lg mx-auto bg-slate-950/90 rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-center shadow-inner">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">No Sketch Generated Yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                    Synthesize the confirmed witness facial feature specifications into a high-resolution graphite pencil composite sketch.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
                    <button
                      onClick={() => handleGenerateSketch(false)}
                      disabled={generating}
                      className="w-full px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generating ? 'Generating Live Sketch...' : 'Generate First Sketch (Live AI)'}
                    </button>
                    <button
                      onClick={() => handleGenerateSketch(true)}
                      disabled={generating}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Fixture
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
