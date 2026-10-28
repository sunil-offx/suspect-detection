import React from 'react';
import { Eye, CheckCircle2, HelpCircle, AlertTriangle } from 'lucide-react';

export type ConfidenceType = 'witness-stated' | 'image-observed' | 'unknown' | 'ambiguous' | 'witness' | 'image';

interface ChipProps {
  label: string;
  type?: ConfidenceType;
  level?: string;
  className?: string;
}

export const ConfidenceChip: React.FC<ChipProps> = ({ label, type, level, className = '' }) => {
  const effectiveType = type || (level === 'witness' ? 'witness-stated' : level === 'image' ? 'image-observed' : level || 'unknown');

  if (effectiveType === 'witness-stated' || effectiveType === 'witness') {
    return (
      <span
        className={`stamp-solved !text-[11px] !py-0.5 !px-2 flex items-center gap-1 shadow-sm ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-900 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (effectiveType === 'image-observed' || effectiveType === 'image') {
    return (
      <span
        className={`stamp-open !text-[11px] !py-0.5 !px-2 flex items-center gap-1 shadow-sm ${className}`}
      >
        <Eye className="w-3 h-3 text-blue-900 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (effectiveType === 'ambiguous') {
    return (
      <span
        className={`stamp-progress !text-[11px] !py-0.5 !px-2 flex items-center gap-1 shadow-sm ${className}`}
      >
        <AlertTriangle className="w-3 h-3 text-amber-900 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  // default: unknown
  return (
    <span
      className={`stamp-closed !text-[11px] !py-0.5 !px-2 flex items-center gap-1 ${className}`}
    >
      <HelpCircle className="w-3 h-3 text-slate-900 shrink-0" />
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
          <span className="text-[10px] font-mono font-bold text-ink-950 uppercase tracking-wider block mb-1">
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
          <span className="text-[10px] font-mono font-bold text-ink-950 uppercase tracking-wider block mb-1">
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
          <span className="text-[10px] font-mono font-bold text-ink-950 uppercase tracking-wider block mb-1">
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
          <span className="text-[10px] font-mono font-bold text-ink-950 uppercase tracking-wider block mb-1">
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
