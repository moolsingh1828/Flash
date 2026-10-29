import React, { useRef, useEffect, useState } from 'react';
import { api } from '../services/api';

export default function VideoPlayer({ videoId, initialPosition = 0, onProgressUpdate }) {
  const videoRef = useRef(null);
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
      {hasError && (
        <div className="absolute inset-0 bg-slate-900/95 z-10 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-red-400 font-semibold mb-2">Video player could not load media stream.</p>
          <p className="text-xs text-slate-400 mb-4 max-w-md">
            The Telegram MTProto connection might be initializing. You can open the direct stream below:
          </p>
          <a
            href={streamUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-primary hover:bg-sky-400 text-darkBg font-medium text-xs rounded-lg transition-colors"
          >
            Open Stream in New Tab
          </a>
        </div>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full h-full"
        src={streamUrl}
        onError={() => setHasError(true)}
        onPlay={() => setHasError(false)}
      >
        Your browser does not support HTML5 video streaming.
      </video>
    </div>
  );
}