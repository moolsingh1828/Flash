import React, { useRef, useEffect } from 'react';
import { api, API_BASE_URL } from '../services/api';

export default function VideoPlayer({ videoId, initialPosition = 0, onProgressUpdate }) {
  const videoRef = useRef(null);

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
        });
        if (onProgressUpdate) onProgressUpdate(current);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoId, initialPosition, onProgressUpdate]);

  // Clean stream URL using normalized API_BASE_URL
  const streamUrl = `${API_BASE_URL}/videos/${videoId}/stream`;

  return (
    <div className="w-full bg-black aspect-video rounded-xl overflow-hidden relative border border-darkBorder shadow-2xl">
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full"
        src={streamUrl}
      >
        Your browser does not support HTML5 video streaming.
      </video>
    </div>
  );
}