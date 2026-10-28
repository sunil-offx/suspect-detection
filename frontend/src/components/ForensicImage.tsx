import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';

interface ForensicImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ForensicImage: React.FC<ForensicImageProps> = ({
  src,
  alt,
  className = '',
  style,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);

    // Fetch image data as blob using authenticated API client
    const cleanUrl = src.split('?')[0]; // Strip query token if present since axios adds auth header
    const requestUrl = cleanUrl.startsWith('http') ? cleanUrl : cleanUrl;

    api.get(requestUrl, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        const objectUrl = URL.createObjectURL(res.data);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Direct blob fetch failed, falling back to direct URL:', err);
        // Fallback: direct src will be tried by standard img tag
        if (active) {
          setBlobUrl(src);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src]);

  const handleImgError = () => {
    setError(true);
    setLoading(false);
  };

  if (loading) {
    return (
      <div
        className={`w-full h-full min-h-[250px] bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-400 ${className}`}
        style={style}
      >
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-2" />
        <span className="text-xs font-mono font-medium animate-pulse">
          Loading Forensic Composite...
        </span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div
        className={`w-full h-full min-h-[250px] bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-400 ${className}`}
        style={style}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-3 text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-slate-200 mb-1">{alt || 'Sketch Image Unavailable'}</p>
        <p className="text-[11px] text-slate-400 max-w-xs mb-4">
          Failed to load image resource from storage server.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            setError(false);
            api.get(src.split('?')[0], { responseType: 'blob' })
              .then((res) => {
                const objectUrl = URL.createObjectURL(res.data);
                setBlobUrl(objectUrl);
                setLoading(false);
              })
              .catch(() => {
                setError(true);
                setLoading(false);
              });
          }}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      onError={handleImgError}
      className={className}
      style={style}
    />
  );
};

