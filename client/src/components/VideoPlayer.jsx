import React, { useRef, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Loader2, AlertCircle } from 'lucide-react';

export default function VideoPlayer({ videoId, initialPosition = 0, onProgressUpdate }) {
  const videoRef = useRef(null);
  const [buffering, setBuffering] = useState(true);
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
      {/* Live Buffering Spinner */}
      {buffering && !hasError && (
        <div className="absolute inset-0 bg-slate-900/80 z-10 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <Loader2 className="animate-spin text-primary mb-3" size={36} />
          <p className="text-slate-100 text-sm font-medium">Starting Stream from Telegram...</p>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            Streaming progressively while saving to server cache.
          </p>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="text-red-400 mb-2" size={32} />
          <p className="text-red-300 font-semibold mb-1 text-sm">Stream Error</p>
          <p className="text-xs text-slate-400 mb-4 max-w-md">
            Could not receive stream chunks from Telegram.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setHasError(false);
                setBuffering(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="px-4 py-2 bg-primary hover:bg-sky-400 text-darkBg font-medium text-xs rounded-lg transition-colors"
            >
              Retry
            </button>
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors"
            >
              Direct Link
            </a>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        playsInline
        autoPlay
        className="w-full h-full"
        src={streamUrl}
        onLoadStart={() => setBuffering(true)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => {
          setBuffering(false);
          setHasError(false);
        }}
        onError={() => {
          setBuffering(false);
          setHasError(true);
        }}
      >
        Your browser does not support HTML5 video streaming.
      </video>
    </div>
  );
}