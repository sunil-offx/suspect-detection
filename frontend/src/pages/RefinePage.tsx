import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  Sliders,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Layers,
  Check,
  RefreshCw,
  Eye,
  FileText,
  RotateCcw,
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

export const RefinePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sketches, setSketches] = useState<SketchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [instruction, setInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);
  const [pendingDeltas, setPendingDeltas] = useState<Record<string, any>>({});
  const [pendingReason, setPendingReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [vPrev, setVPrev] = useState<number>(1);
  const [vCurr, setVCurr] = useState<number>(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSketches = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/cases/${id}/sketches`);
      setSketches(res.data);
      if (res.data.length >= 2) {
        setVCurr(res.data[0].sketch_version);
        setVPrev(res.data[1].sketch_version);
      } else if (res.data.length === 1) {
        setVCurr(res.data[0].sketch_version);
        setVPrev(res.data[0].sketch_version);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSketches();
  }, [id]);

  const handleRefine = async (confirmed: boolean = false) => {
    if (!id || !instruction.trim()) return;
    setRefining(true);

    try {
      const res = await api.post(`/api/cases/${id}/refine-sketch?use_fixture=true`, {
        instruction,
        confirmed,
        deltas: confirmed ? pendingDeltas : undefined,
      });

      if (res.data.requires_confirmation) {
        setConfirmationNeeded(true);
        setPendingDeltas(res.data.deltas);
        setPendingReason(res.data.reason);
      } else {
        setConfirmationNeeded(false);
        setInstruction('');
        showToast('Refinement applied and new sketch version generated!');
        await loadSketches();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Refinement failed');
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Total Versions: <strong className="text-white">{sketches.length}</strong>
            </span>
          </div>
        </div>

        <InvestigativeAidBanner />

        {/* Refinement Instruction Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Natural Language Feature Refinement</h2>
          </div>
          <p className="text-xs text-slate-400">
            Describe anatomical adjustments based on witness feedback (e.g. "make jawline broader and squarer", "make nose bridge narrower", "thicker eyebrows").
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Broader jawline with more angular square chin"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            />
            <button
              onClick={() => handleRefine(false)}
              disabled={refining || !instruction.trim()}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {refining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Apply Refinement
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
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
                onClick={() => handleRefine(true)}
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

        {/* Side-by-Side Version Comparison */}
        {sketches.length >= 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Side-by-Side Version Progression
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Left:</span>
                  <select
                    value={vPrev}
                    onChange={(e) => setVPrev(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs"
                  >
                    {sketches.map((s) => (
                      <option key={s.id} value={s.sketch_version}>
                        Version {s.sketch_version}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Right:</span>
                  <select
                    value={vCurr}
                    onChange={(e) => setVCurr(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Sketch */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Composite Version {sketchPrev?.sketch_version}</span>
                  <span className="font-mono text-[11px]">{sketchPrev?.generation_prompt_version}</span>
                </div>
                <div className="aspect-square bg-white rounded-xl overflow-hidden border-2 border-slate-800 shadow-xl">
                  {sketchPrev && (
                    <img
                      src={sketchPrev.image_url}
                      alt={`Version ${sketchPrev.sketch_version}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {sketchPrev?.refinement_notes && (
                  <p className="text-xs text-slate-400 italic">
                    Notes: {sketchPrev.refinement_notes}
                  </p>
                )}
              </div>

              {/* Right Sketch */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-blue-400">Composite Version {sketchCurr?.sketch_version}</span>
                  <span className="font-mono text-[11px]">{sketchCurr?.generation_prompt_version}</span>
                </div>
                <div className="aspect-square bg-white rounded-xl overflow-hidden border-2 border-blue-500/40 shadow-xl">
                  {sketchCurr && (
                    <img
                      src={sketchCurr.image_url}
                      alt={`Version ${sketchCurr.sketch_version}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {sketchCurr?.refinement_notes && (
                  <p className="text-xs text-slate-300 font-medium">
                    Notes: {sketchCurr.refinement_notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
