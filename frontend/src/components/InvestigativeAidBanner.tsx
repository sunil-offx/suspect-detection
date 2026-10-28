import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface Props {
  className?: string;
  compact?: boolean;
}

export const InvestigativeAidBanner: React.FC<Props> = ({ className = '', compact = false }) => {
  return (
    <div
      data-testid="investigative-aid-banner"
      className={`bg-parchment-100 border-2 border-parchment-border rounded-xl p-3.5 text-ink-950 flex items-center gap-3.5 shadow-dossier-sm ${className}`}
    >
      <div className="p-2 bg-crimson-100 border border-crimson-300 rounded-lg shrink-0 text-crimson-800">
        <ShieldAlert className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider bg-crimson-800 text-white px-2 py-0.5 rounded shadow-sm">
            Investigative Lead Only
          </span>
          <p className="text-xs sm:text-sm font-bold text-ink-950">
            AI-generated forensic composite aid — not a verified biometric identification.
          </p>
        </div>
        {!compact && (
          <p className="text-xs text-ink-800 font-medium mt-1 leading-relaxed">
            This visual composite is generated strictly for investigative leads and witness elimination. It must not be cited as standalone proof for judicial indictment, arrest, or detention.
          </p>
        )}
      </div>
    </div>
  );
};
