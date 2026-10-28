import React from 'react';
import { Eye, CheckCircle2, HelpCircle, AlertTriangle } from 'lucide-react';

export type ConfidenceType = 'witness-stated' | 'image-observed' | 'unknown' | 'ambiguous';

interface ChipProps {
  label: string;
  type: ConfidenceType;
  className?: string;
}

export const ConfidenceChip: React.FC<ChipProps> = ({ label, type, className = '' }) => {
  if (type === 'witness-stated') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (type === 'image-observed') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm ${className}`}
      >
        <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (type === 'ambiguous') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  // default: unknown
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/60 ${className}`}
    >
      <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

interface ConfidenceMatrixProps {
  statedByWitness?: string[];
  observedFromImage?: string[];
  unknown?: string[];
  ambiguous?: string[];
  className?: string;
}

export const ConfidenceMatrix: React.FC<ConfidenceMatrixProps> = ({
  statedByWitness = [],
  observedFromImage = [],
  unknown = [],
  ambiguous = [],
  className = ''
}) => {
  const hasItems =
    statedByWitness.length > 0 ||
    observedFromImage.length > 0 ||
    unknown.length > 0 ||
    ambiguous.length > 0;

  if (!hasItems) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {statedByWitness.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block mb-1.5">
            Witness Stated Features
          </span>
          <div className="flex flex-wrap gap-1.5">
            {statedByWitness.map((f, i) => (
              <ConfidenceChip key={i} label={f.replace(/_/g, ' ')} type="witness-stated" />
            ))}
          </div>
        </div>
      )}

      {observedFromImage.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1.5">
            Image Observed Features
          </span>
          <div className="flex flex-wrap gap-1.5">
            {observedFromImage.map((f, i) => (
              <ConfidenceChip key={i} label={f.replace(/_/g, ' ')} type="image-observed" />
            ))}
          </div>
        </div>
      )}

      {ambiguous.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1.5">
            Ambiguous / Conflicting
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ambiguous.map((f, i) => (
              <ConfidenceChip key={i} label={f.replace(/_/g, ' ')} type="ambiguous" />
            ))}
          </div>
        </div>
      )}

      {unknown.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
            Unknown / Neutral Defaults
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unknown.map((f, i) => (
              <ConfidenceChip key={i} label={f.replace(/_/g, ' ')} type="unknown" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
