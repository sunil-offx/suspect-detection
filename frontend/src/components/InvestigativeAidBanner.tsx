import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface Props {
  className?: string;
  compact?: boolean;
}

export const InvestigativeAidBanner: React.FC<Props> = ({ className = '', compact = false }) => {
  return (
    <div
      data-testid="investigative-aid-banner"
      className={`bg-amber-950/40 border border-amber-500/50 rounded-lg p-3 text-amber-200 flex items-center gap-3 shadow-md ${className}`}
    >
      <div className="p-2 bg-amber-500/20 rounded-md shrink-0 text-amber-400">
        <ShieldAlert className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded border border-amber-600/40">
            Official Disclaimer
          </span>
          <p className="text-sm font-semibold text-amber-100">
            AI-generated investigative aid — not a verified identification
          </p>
        </div>
        {!compact && (
          <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
            This visual composite is generated for investigative leads and witness elimination only. It must not be used as standalone evidence for arrest, indictment, or judicial identification.
          </p>
        )}
      </div>
    </div>
  );
};
