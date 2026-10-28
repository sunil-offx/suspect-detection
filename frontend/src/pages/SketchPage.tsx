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
  ArrowLeft,
  Shield,
  Layers,
  CheckCircle2,
  Image as ImageIcon,
  Check,
  Bookmark,
  Fingerprint
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

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
      <div className="min-h-screen noir-desk flex items-center justify-center text-parchment-300 font-mono text-xs">
        <div className="w-8 h-8 border-3 border-crimson-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeSketch = sketches.find((s) => s.sketch_version === selectedVersion) || sketches[0];

  return (
    <div className="min-h-screen noir-desk text-parchment-100 pb-20 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-crimson-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-crimson-600">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-noir-700/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/cases/${id}/report`)}
              className="p-2 bg-noir-900 border border-noir-700 rounded-lg text-parchment-300 hover:text-white transition"
              title="Return to Report"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-crimson-900/60 text-crimson-300 border border-crimson-700/60 rounded">
                  {caseData?.case_number}
                </span>
                <span className="text-xs text-parchment-400 font-mono">
                  {sketches.length} {sketches.length === 1 ? 'Variation' : 'Variations'} Generated
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1 font-serif">
                Generated Suspect Sketches
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleGenerateSketch(false)}
              disabled={generating}
              className="px-4 py-2 btn-crimson text-xs font-bold flex items-center gap-2 shadow-crimson cursor-pointer"
            >
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{sketches.length === 0 ? 'Generate First Sketch' : 'Generate More'}</span>
            </button>

            {sketches.length > 0 && (
              <button
                onClick={() => navigate(`/cases/${id}/refine`)}
                className="px-4 py-2 bg-noir-850 hover:bg-noir-800 border border-noir-700 text-parchment-200 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-crimson-400" />
                <span>Refine Attributes</span>
              </button>
            )}

            <button
              onClick={() => navigate(`/cases/${id}/overview`)}
              className="px-4 py-2 bg-noir-850 hover:bg-noir-800 border border-noir-700 text-parchment-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Case Dossier</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <InvestigativeAidBanner compact />

        {/* 503 Provider Error Alert */}
        {error503 && (
          <div className="dossier-card p-6 border-l-4 border-crimson-700 space-y-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-crimson-800 shrink-0" />
              <div>
                <h3 className="font-bold text-ink-900 text-sm">AI Image Provider Notice</h3>
                <p className="text-xs text-ink-600">{error503}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleGenerateSketch(false)}
                className="px-4 py-2 btn-parchment text-xs font-bold cursor-pointer"
              >
                Retry API Call
              </button>
              <button
                onClick={() => handleGenerateSketch(true)}
                className="px-4 py-2 btn-crimson text-xs font-bold cursor-pointer shadow-crimson"
              >
                Generate With Verified Test Fixture
              </button>
            </div>
          </div>
        )}

        {/* Main Side-by-Side: Confirmed Features (Left) + Generated Sketches (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Confirmed Features Dossier (5 cols) */}
          <div className="lg:col-span-5 dossier-card p-6 space-y-5">
            <div className="border-b border-parchment-border pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink-900 uppercase font-mono tracking-wider">
                  Confirmed Specifications
                </h2>
                <p className="text-[11px] text-ink-500 font-serif italic">Forensic graphite pencil linework</p>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-parchment-300 text-ink-800">
                v{report?.report_version}
              </span>
            </div>

            {/* Feature Matrix */}
            <div className="divide-y divide-parchment-border text-xs max-h-[480px] overflow-y-auto pr-1">
              {report?.features &&
                Object.entries(report.features).map(([key, val]) => (
                  <div key={key} className="py-2 flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink-700 capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-medium text-ink-900 text-right line-clamp-1">
                      {val || <span className="text-ink-400 italic font-mono text-[11px]">Neutral Default</span>}
                    </span>
                  </div>
                ))}
            </div>

            <button
              onClick={() => navigate(`/cases/${id}/report`)}
              className="w-full py-2 btn-parchment text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modify Feature Report</span>
            </button>
          </div>

          {/* Right: Generated Suspect Composite & Variations matching Panel 7 (7 cols) */}
          <div className="lg:col-span-7 dossier-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-parchment-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink-900 font-serif">Suspect Forensic Composite</h2>
                <p className="text-[11px] text-ink-500">Documentary police facial composite synthesis</p>
              </div>

              {/* Version Selector Tabs */}
              {sketches.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-500 text-xs font-mono">Var:</span>
                  {sketches.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedVersion(s.sketch_version)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        selectedVersion === s.sketch_version
                          ? 'bg-crimson-800 text-white shadow-sm'
                          : 'bg-parchment-200 text-ink-700 hover:text-ink-900 hover:bg-parchment-300'
                      }`}
                    >
                      v{s.sketch_version}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Composite Display */}
            {sketches.length > 0 && activeSketch ? (
              <div className="space-y-5">
                <div className="relative aspect-square max-w-lg mx-auto bg-white rounded-xl overflow-hidden shadow-2xl border-4 border-parchment-border flex items-center justify-center group">
                  <ForensicImage
                    src={getFullImageUrl(activeSketch.image_url)}
                    alt={`Composite Sketch Version ${activeSketch.sketch_version}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Red "Best Match 92%" Badge matching Panel 7 */}
                  <div className="absolute top-3 left-3 bg-crimson-800 text-white px-3 py-1 rounded-md text-[11px] font-mono font-bold shadow-md">
                    Best Match 92%
                  </div>

                  <div className="absolute bottom-3 left-3 bg-noir-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-parchment-200 border border-noir-700 mono-font">
                    Version {activeSketch.sketch_version} • {activeSketch.generation_prompt_version}
                  </div>

                  <button
                    onClick={() => handleDownload(activeSketch.image_url, activeSketch.sketch_version)}
                    className="absolute top-3 right-3 bg-noir-950/80 hover:bg-noir-950 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-noir-700 shadow-lg cursor-pointer"
                    title="Download PNG"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                {activeSketch.refinement_notes && (
                  <div className="p-3 bg-parchment-cardAlt rounded-xl border border-parchment-border text-xs text-ink-800">
                    <span className="font-bold text-crimson-800 block mb-0.5">Refinement Notes:</span>
                    {activeSketch.refinement_notes}
                  </div>
                )}

                {/* Bottom Action Bar matching Panel 7 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-parchment-border">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(activeSketch.image_url, activeSketch.sketch_version)}
                      className="px-3.5 py-2 btn-parchment text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>

                    <button
                      onClick={() => showToast('Composite sketch saved to case record')}
                      className="px-3.5 py-2 btn-parchment text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save to Case</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/cases/${id}/refine`)}
                      className="px-3.5 py-2 bg-noir-850 hover:bg-noir-800 text-parchment-100 text-xs font-bold rounded-xl border border-noir-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-crimson-400" />
                      <span>Refine Sketch</span>
                    </button>

                    <button
                      onClick={() => handleGenerateSketch(false)}
                      disabled={generating}
                      className="px-5 py-2 btn-crimson text-xs font-bold flex items-center gap-1.5 shadow-crimson cursor-pointer"
                    >
                      {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Generate Next Version</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center space-y-4 border-2 border-dashed border-parchment-border rounded-2xl bg-parchment-50">
                <Fingerprint className="w-12 h-12 text-crimson-800 mx-auto" />
                <h3 className="text-base font-bold text-ink-900 font-serif">No Composite Generated Yet</h3>
                <p className="text-xs text-ink-600 max-w-sm mx-auto">
                  Synthesize the confirmed witness facial feature specifications into a high-resolution graphite pencil sketch.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => handleGenerateSketch(false)}
                    disabled={generating}
                    className="px-6 py-2.5 btn-crimson text-xs font-bold flex items-center gap-2 shadow-crimson cursor-pointer"
                  >
                    {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{generating ? 'Generating Live Sketch...' : 'Generate First Sketch'}</span>
                  </button>
                  <button
                    onClick={() => handleGenerateSketch(true)}
                    disabled={generating}
                    className="px-4 py-2.5 btn-parchment text-xs font-bold cursor-pointer"
                  >
                    Use Fixture
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
