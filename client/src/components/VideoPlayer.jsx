import React, { useRef, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Loader2, AlertCircle } from 'lucide-react';

export default function VideoPlayer({ videoId, initialPosition = 0, onProgressUpdate }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (initialPosition > 0) {
      video.currentTime = initialPosition;
    }

    let lastSent = 0;
    const handleTimeUpdate = () => {
      const current = Math.floor(video.currentTime);
      if (current - lastSent >= 5) {
        lastSent = current;
        api.put(`/videos/${videoId}/progress`, {
          positionSeconds: current,
          completed: video.duration ? current / video.duration > 0.9 : false
        }).catch(() => {});
        if (onProgressUpdate) onProgressUpdate(current);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoId, initialPosition, onProgressUpdate]);

  // Clean URL formatting
  let rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  rawUrl = rawUrl.trim().replace(/\/+$/, '');
  if (!rawUrl.endsWith('/api')) {
    rawUrl = `${rawUrl}/api`;
  }

  const token = localStorage.getItem('token');
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  const streamUrl = `${rawUrl}/videos/${videoId}/stream${tokenQuery}`;

  return (
    <div className="w-full bg-black aspect-video rounded-xl overflow-hidden relative border border-darkBorder shadow-2xl flex flex-col items-center justify-center">
      {/* Loading & Buffering State */}
      {loading && !hasError && (
        <div className="absolute inset-0 bg-slate-900/85 z-10 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <Loader2 className="animate-spin text-primary mb-3" size={38} />
          <p className="text-slate-100 text-sm font-medium">Preparing Video Stream...</p>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            Downloading media from Telegram on first play. This takes a few seconds.
          </p>
        </div>
      )}

      {/* Error Fallback State */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="text-red-400 mb-2" size={32} />
          <p className="text-red-300 font-semibold mb-1 text-sm">Playback could not be initialized</p>
          <p className="text-xs text-slate-400 mb-4 max-w-md">
            The media may still be transferring from Telegram, or the session needs refreshing.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setHasError(false);
                setLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="px-4 py-2 bg-primary hover:bg-sky-400 text-darkBg font-medium text-xs rounded-lg transition-colors"
            >
              Retry Playback
            </button>
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors"
            >
              Direct Stream Link
            </a>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full h-full"
        src={streamUrl}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => {
          setLoading(false);
          setHasError(false);
        }}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
      >
        Your browser does not support HTML5 video streaming.
      </video>
    </div>
  );
}