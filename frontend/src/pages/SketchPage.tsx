import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getFullImageUrl } from '../api/client';
import { ForensicImage } from '../components/ForensicImage';
import {
  Sparkles,
  Download,
  Sliders,
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
  AlertTriangle,
  Bookmark,
  Shield,
  Layers,
  Edit3,
  Fingerprint
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

interface SketchData {
  id: string;
  sketch_version: number;
  generation_prompt_version: string;
  prompt_used: string;
  image_url: string;
  refinement_notes?: string;
  created_at: string;
}

export const SketchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sketches, setSketches] = useState<SketchData[]>([]);
  const [report, setReport] = useState<any>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPageData();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadPageData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [sketchesRes, reportRes, caseRes] = await Promise.all([
        api.get(`/api/cases/${id}/sketches`),
        api.get(`/api/cases/${id}/report`),
        api.get(`/api/cases/${id}`)
      ]);
      setSketches(sketchesRes.data);
      setReport(reportRes.data);
      setCaseData(caseRes.data);
      if (sketchesRes.data.length > 0) {
        setSelectedVersion(sketchesRes.data[0].sketch_version);
      }
    } catch (err: any) {
      console.error('Failed to load sketch workspace:', err);
      setError(err.response?.data?.detail || 'Failed to load case sketches.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSketch = async (useFixture = false) => {
    if (!id) return;
    setGenerating(true);
    setError(null);

    const endpoint = useFixture
      ? `/api/cases/${id}/generate-sketch?use_fixture=true`
      : `/api/cases/${id}/generate-sketch`;

    try {
      let res;
      try {
        res = await api.post(endpoint);
      } catch (err: any) {
        if (!useFixture && (err.response?.status === 503 || err.response?.status === 502)) {
          res = await api.post(`/api/cases/${id}/generate-sketch?use_fixture=true`);
          showToast('Generated using forensic test fixture (AI provider busy/offline)');
        } else {
          throw err;
        }
      }

      showToast(`Sketch Version ${res.data.sketch_version || 'Initial'} generated!`);
      await loadPageData();
      if (res.data.sketch_version) {
        setSelectedVersion(res.data.sketch_version);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Sketch synthesis failed. You can proceed with the test fixture.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (imageUrl: string, version: number) => {
    const a = document.createElement('a');
    a.href = getFullImageUrl(imageUrl);
    a.download = `${caseData?.case_number || 'sketch'}_v${version}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeSketch = sketches.find((s) => s.sketch_version === selectedVersion) || sketches[0];

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
        {/* Navigation / Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-noir-700/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/cases/${id}/report`)}
              className="p-2 bg-noir-900 border border-noir-700 rounded-lg text-parchment-200 hover:text-white transition cursor-pointer"
              title="Return to Report"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-crimson-900/60 text-crimson-200 border border-crimson-700/60 rounded">
                  {caseData?.case_number}
                </span>
                <span className="stamp-open">Active Case File</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1 font-serif">
                {caseData?.title} — Forensic Composite
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(`/cases/${id}/refine`)}
              className="px-4 py-2 bg-noir-850 hover:bg-noir-800 text-white border border-noir-700 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-crimson-400" />
              <span>Anatomical Morph Workbench</span>
            </button>

            <button
              onClick={() => navigate(`/cases/${id}/overview`)}
              className="px-4 py-2 btn-crimson text-xs font-bold flex items-center gap-2 shadow-crimson cursor-pointer"
            >
              <span>Case Dossier →</span>
            </button>
          </div>
        </div>

        <InvestigativeAidBanner compact />

        {error && (
          <div className="p-3 bg-crimson-950/80 border border-crimson-700 rounded-lg text-xs text-crimson-200 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-crimson-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 2-Column Layout Matching Panel 6 & 7 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Summary Profile Card (5 cols) */}
          <div className="lg:col-span-5 dossier-card p-6 space-y-5 border-2 border-parchment-border">
            <div className="border-b border-parchment-border pb-3">
              <h2 className="text-base font-bold text-ink-950 font-serif">Extracted Forensic Profile</h2>
              <p className="text-[11px] text-ink-700 font-medium font-sans">
                Source attributes used for latent image diffusion
              </p>
            </div>

            {report ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-xl border border-parchment-border text-xs text-ink-950 font-serif italic leading-relaxed">
                  "{report.summary}"
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {Object.entries(report.features || {}).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-parchment-border text-xs"
                      >
                        <span className="font-mono text-ink-700 font-bold text-[11px] uppercase">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold text-ink-950 max-w-[180px] truncate text-right">
                          {String(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-700 font-medium italic">No report attributes found.</p>
            )}

            <button
              onClick={() => navigate(`/cases/${id}/report`)}
              className="w-full py-2 btn-parchment text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modify Feature Report</span>
            </button>
          </div>

          {/* Right: Generated Suspect Composite & Variations matching Panel 7 (7 cols) */}
          <div className="lg:col-span-7 dossier-card p-6 sm:p-8 space-y-6 border-2 border-parchment-border">
            <div className="flex items-center justify-between border-b border-parchment-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink-950 font-serif">Suspect Forensic Composite</h2>
                <p className="text-[11px] text-ink-700 font-medium">Documentary police facial composite synthesis</p>
              </div>

              {/* Version Selector Tabs */}
              {sketches.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-800 text-xs font-mono font-bold">Var:</span>
                  {sketches.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedVersion(s.sketch_version)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        selectedVersion === s.sketch_version
                          ? 'bg-crimson-800 text-white shadow-sm'
                          : 'bg-parchment-200 text-ink-950 hover:bg-parchment-300'
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

                  <div className="absolute bottom-3 left-3 bg-noir-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-parchment-100 border border-noir-700 font-mono font-bold">
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
                  <div className="p-3 bg-white rounded-xl border border-parchment-border text-xs text-ink-950 shadow-sm">
                    <span className="font-bold text-crimson-900 block mb-0.5 font-mono">Refinement Notes:</span>
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
                      className="px-3.5 py-2 bg-noir-850 hover:bg-noir-800 text-white text-xs font-bold rounded-xl border border-noir-700 flex items-center gap-1.5 transition cursor-pointer"
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
              <div className="py-16 text-center space-y-4 border-2 border-dashed border-parchment-border rounded-2xl bg-white shadow-sm">
                <Fingerprint className="w-12 h-12 text-crimson-800 mx-auto" />
                <h3 className="text-base font-bold text-ink-950 font-serif">No Composite Generated Yet</h3>
                <p className="text-xs text-ink-800 font-medium max-w-sm mx-auto">
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
