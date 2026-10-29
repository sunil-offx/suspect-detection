import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getFullImageUrl } from '../api/client';
import { ForensicImage } from '../components/ForensicImage';
import {
  Sliders,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Shield,
  Layers,
  Check,
  RefreshCw,
  Eye,
  FileText,
  RotateCcw,
  Split,
  Columns,
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';
import { FacialStructureAdjuster } from '../components/FacialStructureAdjuster';
import type { FacialFeatureDeltas } from '../components/FacialStructureAdjuster';

interface SketchData {
  id: string;
  sketch_version: number;
  generation_prompt_version: string;
  prompt_used: string;
  image_url: string;
  refinement_notes?: string;
  created_at: string;
}

export const RefinePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sketches, setSketches] = useState<SketchData[]>([]);
  const [reportFeatures, setReportFeatures] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [instruction, setInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);
  const [pendingDeltas, setPendingDeltas] = useState<Record<string, any>>({});
  const [pendingReason, setPendingReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [lastDeltas, setLastDeltas] = useState<{ deltas: FacialFeatureDeltas; summary: string } | null>(null);

  const [vPrev, setVPrev] = useState<number>(1);
  const [vCurr, setVCurr] = useState<number>(1);
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'split'>('side-by-side');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [sketchesRes, reportRes] = await Promise.all([
        api.get(`/api/cases/${id}/sketches`),
        api.get(`/api/cases/${id}/report`),
      ]);
      setSketches(sketchesRes.data);
      if (reportRes.data?.features) {
        setReportFeatures(reportRes.data.features);
      }
      if (sketchesRes.data.length >= 2) {
        setVCurr(sketchesRes.data[0].sketch_version);
        setVPrev(sketchesRes.data[1].sketch_version);
      } else if (sketchesRes.data.length === 1) {
        setVCurr(sketchesRes.data[0].sketch_version);
        setVPrev(sketchesRes.data[0].sketch_version);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleApplyAdjustments = async (deltas: FacialFeatureDeltas, summaryText: string) => {
    if (!id) return;
    setRefining(true);

    try {
      let res;
      try {
        res = await api.post(`/api/cases/${id}/refine-sketch`, {
          instruction: summaryText,
          confirmed: true,
          deltas,
        });
      } catch (err: any) {
        if (err.response?.status === 503 || err.response?.status === 502) {
          res = await api.post(`/api/cases/${id}/refine-sketch?use_fixture=true`, {
            instruction: summaryText,
            confirmed: true,
            deltas,
          });
          showToast('Generated using dev fixture (AI provider busy or quota reached)');
        } else {
          throw err;
        }
      }

      showToast(`New Sketch Version ${res.data.sketch?.sketch_version || 'generated'} created!`);
      await loadData();
    } catch (err: any) {
      setLastDeltas({ deltas, summary: summaryText });
      if (err.response?.status === 502 || err.response?.status === 503 || err.response?.data?.detail?.toLowerCase().includes('zerogpu') || err.response?.data?.detail?.toLowerCase().includes('z-image')) {
        setQuotaError(err.response?.data?.detail || 'Hugging Face ZeroGPU quota exceeded. You can retry shortly or use the test fixture.');
      } else {
        alert(err.response?.data?.detail || 'Refinement generation failed');
      }
    } finally {
      setRefining(false);
    }
  };

  const handleNaturalLanguageRefine = async (confirmed: boolean = false) => {
    if (!id || !instruction.trim()) return;
    setRefining(true);

    try {
      let res;
      try {
        res = await api.post(`/api/cases/${id}/refine-sketch`, {
          instruction,
          confirmed,
          deltas: confirmed ? pendingDeltas : undefined,
        });
      } catch (err: any) {
        if (err.response?.status === 503 || err.response?.status === 502) {
          res = await api.post(`/api/cases/${id}/refine-sketch?use_fixture=true`, {
            instruction,
            confirmed,
            deltas: confirmed ? pendingDeltas : undefined,
          });
          showToast('Generated using dev fixture (AI provider busy or quota reached)');
        } else {
          throw err;
        }
      }

      if (res.data.requires_confirmation) {
        setConfirmationNeeded(true);
        setPendingDeltas(res.data.deltas);
        setPendingReason(res.data.reason);
      } else {
        setConfirmationNeeded(false);
        setInstruction('');
        showToast('Refinement applied and new sketch version generated!');
        await loadData();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Refinement failed');
    } finally {
      setRefining(false);
    }
  };

  const handleGenerateWithFixture = async () => {
    if (!id || !lastDeltas) return;
    setRefining(true);
    try {
      const res = await api.post(`/api/cases/${id}/refine-sketch?use_fixture=true`, {
        instruction: lastDeltas.summary,
        confirmed: true,
        deltas: lastDeltas.deltas,
      });
      setQuotaError(null);
      showToast(`Sketch Version ${res.data.sketch?.sketch_version || 'generated'} created using verified test fixture!`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Fixture generation failed');
    } finally {
      setRefining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen noir-desk flex flex-col items-center justify-center p-6 text-parchment-200">
        <div className="w-12 h-12 border-4 border-crimson-700/20 border-t-crimson-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold font-serif italic text-parchment-200">Loading sketch refinement workbench...</p>
      </div>
    );
  }

  const sketchPrev = sketches.find((s) => s.sketch_version === vPrev) || sketches[0];
  const sketchCurr = sketches.find((s) => s.sketch_version === vCurr) || sketches[0];

  return (
    <div className="min-h-screen noir-desk text-parchment-100 pb-20 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-crimson-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-crimson flex items-center gap-2 border border-crimson-600">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Forensic Banner */}
      <div className="bg-noir-900/90 border-b border-noir-800 py-2.5 px-4 text-center">
        <p className="text-xs text-parchment-200 font-medium flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-crimson-400" />
          <span className="font-bold text-white">FORENSIC COMPOSITE REFINEMENT:</span>
          Append-only version control. Prior versions are permanently immutable.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/cases/${id}/sketch`)}
            className="inline-flex items-center gap-2 text-sm text-parchment-200 hover:text-white font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sketch Page
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-parchment-200 font-mono font-bold">
              Total Versions: <strong className="text-white font-black">{sketches.length}</strong>
            </span>
            <button
              onClick={() => navigate(`/cases/${id}/overview`)}
              className="px-3 py-1.5 rounded-lg btn-parchment text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              Case Dossier
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <InvestigativeAidBanner />

        {/* ZeroGPU / Provider Quota Alert Banner */}
        {quotaError && (
          <div className="dossier-card border-2 border-amber-800/40 p-6 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-crimson-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-ink-950 text-base font-serif">{quotaError?.includes('Z-Image') ? 'Z-Image Turbo Windows Service Notice' : 'AI Image Provider Notice'}</h3>
                <p className="text-xs text-ink-900 font-medium leading-relaxed">
                  {quotaError}
                </p>
                <p className="text-[11px] text-ink-700 font-bold pt-1">
                  <strong>How to resolve:</strong> ZeroGPU free quotas reset every few minutes. You can also add a free Hugging Face User Access Token to <code className="text-crimson-900 bg-white px-1.5 py-0.5 rounded font-mono font-bold">.env</code>, or proceed immediately using the verified forensic test fixture.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGenerateWithFixture}
                disabled={refining}
                className="btn-crimson px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Proceed With Verified Test Fixture
              </button>
              <button
                onClick={() => lastDeltas && handleApplyAdjustments(lastDeltas.deltas, lastDeltas.summary)}
                disabled={refining}
                className="btn-parchment px-4 py-2 rounded-xl text-xs font-bold"
              >
                Retry Live AI
              </button>
              <button
                onClick={() => setQuotaError(null)}
                className="px-3 py-2 rounded-xl text-ink-800 hover:text-ink-950 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* 1. PRIMARY: Interactive Facial Structure Workbench */}
        <FacialStructureAdjuster
          initialFeatures={reportFeatures}
          onApplyAdjustments={handleApplyAdjustments}
          isGenerating={refining}
          currentImageUrl={sketchCurr ? getFullImageUrl(sketchCurr.image_url) : undefined}
        />

        {/* 2. SECONDARY: Quick Natural Language Text Refinement */}
        <div className="dossier-card p-6 space-y-3 border-2 border-parchment-border">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-crimson-700" />
            <h3 className="text-sm font-bold text-ink-950 font-serif">Natural Language Refinement Note</h3>
          </div>
          <p className="text-xs text-ink-800 font-medium font-sans">
            Alternatively type an explicit natural language description based on witness feedback (e.g. "make jawline squarer and heavier", "add wireframe glasses").
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Broader jawline with more angular square chin"
              className="flex-1 bg-white border border-parchment-border rounded-xl px-4 py-2.5 text-xs text-ink-950 font-medium placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-crimson-700 font-sans"
            />
            <button
              onClick={() => handleNaturalLanguageRefine(false)}
              disabled={refining || !instruction.trim()}
              className="btn-crimson px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {refining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Apply Text Note
            </button>
          </div>
        </div>

        {/* Confirmation Modal if required */}
        {confirmationNeeded && (
          <div className="dossier-card border-2 border-crimson-600/40 p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-crimson-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-ink-950 text-base font-serif">Operator Confirmation Required</h3>
                <p className="text-sm text-ink-900 font-medium">{pendingReason}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-parchment-border text-xs space-y-2">
              <span className="font-extrabold text-crimson-900 block uppercase tracking-wider text-[11px] font-mono">
                Computed Feature Field Deltas:
              </span>
              <pre className="text-ink-950 font-mono overflow-x-auto p-2 bg-parchment-50 rounded border border-parchment-border font-bold">
                {JSON.stringify(pendingDeltas, null, 2)}
              </pre>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleNaturalLanguageRefine(true)}
                disabled={refining}
                className="btn-crimson px-5 py-2.5 rounded-xl text-xs font-bold"
              >
                Confirm Delta & Generate Version
              </button>
              <button
                onClick={() => setConfirmationNeeded(false)}
                className="btn-parchment px-4 py-2.5 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 3. SIDE-BY-SIDE & SPLIT COMPARISON OF VERSIONS */}
        {sketches.length >= 1 && (
          <div className="dossier-card p-6 space-y-6 border-2 border-parchment-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-parchment-border pb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-serif font-bold text-ink-950 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-crimson-700" />
                  Facial Structure Progression Comparison
                </h3>
              </div>

              <div className="flex items-center gap-4 text-xs flex-wrap">
                {/* View toggle */}
                <div className="flex items-center bg-parchment-100 p-1 rounded-lg border border-parchment-border">
                  <button
                    onClick={() => setComparisonMode('side-by-side')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                      comparisonMode === 'side-by-side' ? 'btn-crimson !shadow-none' : 'text-ink-900 hover:text-black'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setComparisonMode('split')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                      comparisonMode === 'split' ? 'btn-crimson !shadow-none' : 'text-ink-900 hover:text-black'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    Split Slider
                  </button>
                </div>

                {/* Left Version Picker */}
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-950 font-serif font-bold">Before:</span>
                  <select
                    value={vPrev}
                    onChange={(e) => setVPrev(Number(e.target.value))}
                    className="bg-white border border-parchment-border rounded-lg px-2.5 py-1 text-ink-950 text-xs font-bold font-mono"
                  >
                    {sketches.map((s) => (
                      <option key={s.id} value={s.sketch_version}>
                        Version {s.sketch_version}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right Version Picker */}
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-950 font-serif font-bold">After:</span>
                  <select
                    value={vCurr}
                    onChange={(e) => setVCurr(Number(e.target.value))}
                    className="bg-white border border-parchment-border rounded-lg px-2.5 py-1 text-ink-950 text-xs font-bold font-mono"
                  >
                    {sketches.map((s) => (
                      <option key={s.id} value={s.sketch_version}>
                        Version {s.sketch_version}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* COMPARISON RENDERING */}
            {comparisonMode === 'side-by-side' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left (Before) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-ink-800">
                    <span className="font-bold text-ink-950 font-serif">Prior Structure (v{sketchPrev?.sketch_version})</span>
                    <span className="font-mono font-bold text-[11px] text-ink-700">{sketchPrev?.generation_prompt_version}</span>
                  </div>
                  <div className="aspect-square bg-white rounded-xl overflow-hidden border-2 border-parchment-border shadow-dossier relative">
                    {sketchPrev && (
                      <ForensicImage
                        src={getFullImageUrl(sketchPrev.image_url)}
                        alt={`Version ${sketchPrev.sketch_version}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2 stamp-open text-[10px]">
                      v{sketchPrev?.sketch_version} (Base)
                    </div>
                  </div>
                  {sketchPrev?.refinement_notes && (
                    <p className="text-xs text-ink-900 font-medium italic line-clamp-2 font-serif">
                      Notes: {sketchPrev.refinement_notes}
                    </p>
                  )}
                </div>

                {/* Right (After / Adjusted) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-ink-800">
                    <span className="font-bold text-crimson-900 font-serif">Adjusted Structure (v{sketchCurr?.sketch_version})</span>
                    <span className="font-mono font-bold text-[11px] text-crimson-900">{sketchCurr?.generation_prompt_version}</span>
                  </div>
                  <div className="aspect-square bg-white rounded-xl overflow-hidden border-2 border-crimson-700/60 shadow-dossier relative">
                    {sketchCurr && (
                      <ForensicImage
                        src={getFullImageUrl(sketchCurr.image_url)}
                        alt={`Version ${sketchCurr.sketch_version}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2 stamp-solved text-[10px]">
                      v{sketchCurr?.sketch_version} (Adjusted)
                    </div>
                  </div>
                  {sketchCurr?.refinement_notes && (
                    <p className="text-xs text-ink-950 font-medium line-clamp-2 font-serif">
                      Notes: {sketchCurr.refinement_notes}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* SPLIT SLIDER COMPARISON */
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-parchment-border shadow-dossier select-none bg-white">
                  {/* Background: Current / After image */}
                  {sketchCurr && (
                    <img
                      src={getFullImageUrl(sketchCurr.image_url)}
                      alt="Adjusted"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Foreground: Prior / Before image clipped */}
                  {sketchPrev && (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${splitPosition}%` }}
                    >
                      <img
                        src={getFullImageUrl(sketchPrev.image_url)}
                        alt="Prior"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                      />
                    </div>
                  )}

                  {/* Vertical Divider line */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-crimson-700 shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize flex items-center justify-center"
                    style={{ left: `calc(${splitPosition}% - 2px)` }}
                  >
                    <div className="w-6 h-6 rounded-full bg-crimson-700 text-white flex items-center justify-center text-[10px] font-bold shadow-lg border border-parchment-100">
                      ⟷
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 bg-noir-950/90 px-2 py-1 rounded text-[10px] font-mono text-white font-bold">
                    Left: v{sketchPrev?.sketch_version}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-crimson-900/90 text-white px-2 py-1 rounded text-[10px] font-mono font-bold">
                    Right: v{sketchCurr?.sketch_version}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-ink-950 font-bold">v{sketchPrev?.sketch_version}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitPosition}
                    onChange={(e) => setSplitPosition(Number(e.target.value))}
                    className="flex-1 accent-crimson-700 cursor-ew-resize h-2 bg-parchment-200 rounded-lg"
                  />
                  <span className="text-[11px] font-mono text-crimson-900 font-black">v{sketchCurr?.sketch_version}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
