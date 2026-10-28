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

  // Handle adjustments from the interactive facial structure workbench
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
        if (err.response?.status === 503) {
          res = await api.post(`/api/cases/${id}/refine-sketch?use_fixture=true`, {
            instruction: summaryText,
            confirmed: true,
            deltas,
          });
          showToast('Generated using dev fixture (AI provider not configured)');
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

  // Handle free-form natural language instruction
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
        if (err.response?.status === 503) {
          res = await api.post(`/api/cases/${id}/refine-sketch?use_fixture=true`, {
            instruction,
            confirmed,
            deltas: confirmed ? pendingDeltas : undefined,
          });
          showToast('Generated using dev fixture (AI provider not configured)');
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Loading sketch refinement workbench...</p>
      </div>
    );
  }

  const sketchPrev = sketches.find((s) => s.sketch_version === vPrev) || sketches[0];
  const sketchCurr = sketches.find((s) => s.sketch_version === vCurr) || sketches[0];

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
          <span className="font-semibold text-slate-300">FORENSIC COMPOSITE REFINEMENT:</span>
          Append-only version control. Prior versions are permanently immutable.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/cases/${id}/sketch`)}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sketch Page
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Total Versions: <strong className="text-white">{sketches.length}</strong>
            </span>
            <button
              onClick={() => navigate(`/cases/${id}/overview`)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              Case Dossier
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <InvestigativeAidBanner />

        {/* ZeroGPU / Provider Quota Alert Banner */}
        {quotaError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-amber-200 space-y-3 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">{quotaError?.includes('Z-Image') ? 'Z-Image Turbo Windows Service Notice' : 'AI Image Provider Notice'}</h3>
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  {quotaError}
                </p>
                <p className="text-[11px] text-slate-400 pt-1">
                  <strong>How to resolve:</strong> ZeroGPU free quotas reset every few minutes. You can also add a free Hugging Face User Access Token to <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">.env</code> (<code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">IMAGE_API_KEY=hf_...</code>), or proceed immediately using the verified forensic test fixture.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGenerateWithFixture}
                disabled={refining}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Proceed With Verified Test Fixture
              </button>
              <button
                onClick={() => lastDeltas && handleApplyAdjustments(lastDeltas.deltas, lastDeltas.summary)}
                disabled={refining}
                className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 text-amber-100 text-xs font-semibold border border-amber-500/40"
              >
                Retry Live AI
              </button>
              <button
                onClick={() => setQuotaError(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs hover:text-white"
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
        />

        {/* 2. SECONDARY: Quick Natural Language Text Refinement */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Natural Language Refinement Note</h3>
          </div>
          <p className="text-xs text-slate-400">
            Alternatively type an explicit natural language description based on witness feedback (e.g. "make jawline squarer and heavier", "add wireframe glasses").
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Broader jawline with more angular square chin"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            />
            <button
              onClick={() => handleNaturalLanguageRefine(false)}
              disabled={refining || !instruction.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {refining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Apply Text Note
            </button>
          </div>
        </div>

        {/* Confirmation Modal if required */}
        {confirmationNeeded && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-amber-200 space-y-4 shadow-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Operator Confirmation Required</h3>
                <p className="text-sm text-amber-300/90">{pendingReason}</p>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/20 text-xs space-y-2">
              <span className="font-semibold text-amber-400 block uppercase tracking-wider text-[11px]">
                Computed Feature Field Deltas:
              </span>
              <pre className="text-slate-200 font-mono overflow-x-auto p-2 bg-slate-900 rounded">
                {JSON.stringify(pendingDeltas, null, 2)}
              </pre>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleNaturalLanguageRefine(true)}
                disabled={refining}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-amber-600/20"
              >
                Confirm Delta & Generate Version
              </button>
              <button
                onClick={() => setConfirmationNeeded(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 3. SIDE-BY-SIDE & SPLIT COMPARISON OF VERSIONS */}
        {sketches.length >= 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Facial Structure Progression Comparison
                </h3>
              </div>

              <div className="flex items-center gap-4 text-xs flex-wrap">
                {/* View toggle */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setComparisonMode('side-by-side')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                      comparisonMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setComparisonMode('split')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                      comparisonMode === 'split' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    Split Slider
                  </button>
                </div>

                {/* Left Version Picker */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Before:</span>
                  <select
                    value={vPrev}
                    onChange={(e) => setVPrev(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-semibold"
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
                  <span className="text-slate-400">After:</span>
                  <select
                    value={vCurr}
                    onChange={(e) => setVCurr(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-semibold"
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
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Prior Structure (v{sketchPrev?.sketch_version})</span>
                    <span className="font-mono text-[11px]">{sketchPrev?.generation_prompt_version}</span>
                  </div>
                  <div className="aspect-square bg-white rounded-xl overflow-hidden border-2 border-slate-800 shadow-xl relative">
                    {sketchPrev && (
                      <ForensicImage
                        src={getFullImageUrl(sketchPrev.image_url)}
                        alt={`Version ${sketchPrev.sketch_version}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] text-slate-300 border border-slate-700">
                      v{sketchPrev?.sketch_version} (Base)
                    </div>
                  </div>
                  {sketchPrev?.refinement_notes && (
                    <p className="text-xs text-slate-400 italic line-clamp-2">
                      Notes: {sketchPrev.refinement_notes}
                    </p>
                  )}
                </div>

                {/* Right (After / Adjusted) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-blue-400">Adjusted Structure (v{sketchCurr?.sketch_version})</span>
                    <span className="font-mono text-[11px]">{sketchCurr?.generation_prompt_version}</span>
                  </div>
                  <div className="aspect-square bg-white rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-2xl relative">
                    {sketchCurr && (
                      <ForensicImage
                        src={getFullImageUrl(sketchCurr.image_url)}
                        alt={`Version ${sketchCurr.sketch_version}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2 bg-blue-600/90 text-white px-2 py-0.5 rounded text-[10px] font-semibold border border-blue-400 shadow">
                      v{sketchCurr?.sketch_version} (Adjusted)
                    </div>
                  </div>
                  {sketchCurr?.refinement_notes && (
                    <p className="text-xs text-slate-300 font-medium line-clamp-2">
                      Notes: {sketchCurr.refinement_notes}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* SPLIT SLIDER COMPARISON */
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl select-none">
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
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)] cursor-ew-resize flex items-center justify-center"
                    style={{ left: `calc(${splitPosition}% - 2px)` }}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-lg border border-white">
                      ⟷
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-1 rounded text-[10px] font-mono text-slate-300">
                    Left: v{sketchPrev?.sketch_version}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-slate-950/80 px-2 py-1 rounded text-[10px] font-mono text-blue-400">
                    Right: v{sketchCurr?.sketch_version}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400">v{sketchPrev?.sketch_version}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitPosition}
                    onChange={(e) => setSplitPosition(Number(e.target.value))}
                    className="flex-1 accent-blue-500 cursor-ew-resize h-2 bg-slate-800 rounded-lg"
                  />
                  <span className="text-[11px] font-mono text-blue-400">v{sketchCurr?.sketch_version}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
