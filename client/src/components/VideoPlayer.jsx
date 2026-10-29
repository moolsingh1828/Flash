import React, { useRef, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Subtitles, Upload, Download,
  Loader2, AlertCircle, PictureInPicture, ExternalLink, Sparkles
} from 'lucide-react';

function formatVttTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export default function VideoPlayer({ videoId, initialPosition = 0, onProgressUpdate }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const cueStartTimeRef = useRef(0);

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [buffering, setBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Subtitle States
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [liveCaptionText, setLiveCaptionText] = useState('');
  const [vttContent, setVttContent] = useState('');
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState(null);

  const controlsTimeoutRef = useRef(null);

  // Clean stream URL
  let rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  rawUrl = rawUrl.trim().replace(/\/+$/, '');
  if (!rawUrl.endsWith('/api')) rawUrl = `${rawUrl}/api`;
  const token = localStorage.getItem('token');
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  const streamUrl = `${rawUrl}/videos/${videoId}/stream${tokenQuery}`;

  // Check for existing subtitles on mount
  useEffect(() => {
    let isCancelled = false;

    async function checkExistingSubtitles() {
      try {
        const res = await api.get(`/videos/${videoId}/subtitles`);
        if (isCancelled) return;

        if (res.data?.subtitles && res.data.subtitles.trim().length > 10) {
          const blob = new Blob([res.data.subtitles], { type: 'text/vtt' });
          setSubtitleTrackUrl(URL.createObjectURL(blob));
          setVttContent(res.data.subtitles);
          setIsAutoGenerating(false);
        } else {
          setIsAutoGenerating(true);
          setVttContent('WEBVTT - Auto-Generated from Telegram Audio\n\n');
        }
      } catch {
        setIsAutoGenerating(true);
        setVttContent('WEBVTT - Auto-Generated from Telegram Audio\n\n');
      }
    }

    checkExistingSubtitles();
    return () => { isCancelled = true; };
  }, [videoId]);

  // Live Speech Recognition Subtitle Generator
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !isAutoGenerating) return;

    if (isPlaying && subtitlesEnabled) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          cueStartTimeRef.current = videoRef.current ? videoRef.current.currentTime : 0;
        };

        recognition.onresult = (event) => {
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const startSec = cueStartTimeRef.current;
              const endSec = videoRef.current ? videoRef.current.currentTime : startSec + 2.5;
              const newCue = `${formatVttTime(startSec)} --> ${formatVttTime(Math.max(endSec, startSec + 1))}\n${transcript.trim()}\n\n`;

              setVttContent((prev) => {
                const updated = prev + newCue;
                api.put(`/videos/${videoId}/subtitles`, { subtitles: updated }).catch(() => {});
                return updated;
              });

              cueStartTimeRef.current = videoRef.current ? videoRef.current.currentTime : 0;
              setLiveCaptionText(transcript.trim());
            } else {
              interimText += transcript;
            }
          }
          if (interimText) setLiveCaptionText(interimText);
        };

        recognition.onend = () => {
          if (isPlaying && isAutoGenerating && subtitlesEnabled) {
            try { recognition.start(); } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {}
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      setLiveCaptionText('');
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [isAutoGenerating, isPlaying, subtitlesEnabled, videoId]);

  const handleSubtitleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let content = event.target?.result;
      if (file.name.endsWith('.srt')) {
        content = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }

      await api.put(`/videos/${videoId}/subtitles`, { subtitles: content }).catch(() => {});
      const blob = new Blob([content], { type: 'text/vtt' });
      setSubtitleTrackUrl(URL.createObjectURL(blob));
      setVttContent(content);
      setIsAutoGenerating(false);
      setLiveCaptionText('');
    };
    reader.readAsText(file);
  };

  const handleDownloadSubtitles = () => {
    if (!vttContent) return;
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesson_${videoId}_subtitles.vtt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 2800);
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setHasStarted(true);
            setHasError(false);
          })
          .catch(() => setIsPlaying(false));
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekRelative = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
  }, [duration]);

  const handleVolumeChange = (newVol) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(newVol, 1));
    video.volume = clamped;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeSpeed = (rate) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  };

  // Keyboard Shortcuts (PotPlayer & YouTube)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
        case 'arrowleft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(volume + 0.05);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(volume - 0.05);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'p':
          togglePiP();
          break;
        case 'c':
          setSubtitlesEnabled((prev) => !prev);
          break;
        case '[':
          changeSpeed(Math.max(0.5, playbackRate - 0.25));
          break;
        case ']':
          changeSpeed(Math.min(2.0, playbackRate + 0.25));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative, volume, playbackRate]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setBuffering(false);
    if (initialPosition > 0 && initialPosition < video.duration) {
      video.currentTime = initialPosition;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastSent = 0;
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
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
  }, [videoId, onProgressUpdate]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      className="w-full bg-black aspect-video rounded-xl overflow-hidden relative group select-none flex flex-col justify-end shadow-2xl border border-darkBorder"
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain cursor-pointer"
        src={streamUrl}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => {
          setIsPlaying(true);
          setBuffering(false);
          setHasError(false);
        }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setBuffering(false);
          setHasError(true);
        }}
      >
        {subtitleTrackUrl && subtitlesEnabled && (
          <track kind="subtitles" src={subtitleTrackUrl} srcLang="en" label="English" default />
        )}
      </video>

      {/* Auto-Caption Badge */}
      {isAutoGenerating && subtitlesEnabled && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-primary/30 text-primary text-[11px] font-medium backdrop-blur-sm pointer-events-none">
          <Sparkles size={12} className="animate-pulse" />
          <span>Auto Audio Captions (AI)</span>
        </div>
      )}

      {/* Live Auto Subtitles Banner */}
      {subtitlesEnabled && liveCaptionText && isAutoGenerating && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-2xl px-4 py-1.5 bg-black/85 text-white text-sm md:text-base font-semibold rounded text-center pointer-events-none z-30 transition-all border border-white/10 shadow-lg">
          {liveCaptionText}
        </div>
      )}

      {/* Center Play Button Overlay */}
      {!hasStarted && !hasError && !buffering && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/40 hover:bg-black/20 transition-all z-20"
        >
          <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center text-darkBg shadow-2xl hover:scale-105 transition-all">
            <Play size={36} className="ml-1" />
          </div>
        </div>
      )}

      {/* Subtle Buffering Spinner */}
      {buffering && hasStarted && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-black/60 p-4 rounded-full backdrop-blur-sm">
            <Loader2 className="animate-spin text-primary" size={38} />
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-900/95 z-40 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="text-red-400 mb-2" size={36} />
          <h4 className="text-red-300 font-semibold mb-1 text-sm">Media Playback Notice</h4>
          <p className="text-xs text-slate-400 mb-4 max-w-md">
            Could not stream video. If encoded as an MKV/AVI container, open directly via the link below:
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setHasError(false);
                setBuffering(true);
                if (videoRef.current) {
                  videoRef.current.load();
                  togglePlay();
                }
              }}
              className="px-4 py-2 bg-primary hover:bg-sky-400 text-darkBg font-medium text-xs rounded-lg transition-colors"
            >
              Retry In-Browser
            </button>
            <a
              href={streamUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors border border-slate-700"
            >
              <ExternalLink size={13} /> Direct Stream / VLC
            </a>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 z-30 transition-opacity duration-300 ${
          controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative mb-3 flex items-center group/scrubber cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const target = Number(e.target.value);
              if (videoRef.current) {
                videoRef.current.currentTime = target;
                setCurrentTime(target);
              }
            }}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary group-hover/scrubber:h-2.5 transition-all"
          />
        </div>

        <div className="flex items-center justify-between text-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="hover:text-primary transition-colors p-1">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <button onClick={() => seekRelative(-10)} title="Rewind 10s (J)" className="hover:text-primary p-1">
              <RotateCcw size={17} />
            </button>
            <button onClick={() => seekRelative(10)} title="Forward 10s (L)" className="hover:text-primary p-1">
              <RotateCw size={17} />
            </button>

            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={toggleMute} className="hover:text-primary p-1">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-16 h-1 bg-white/20 rounded-lg accent-primary"
              />
            </div>

            <span className="font-mono text-slate-300 text-[11px] ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              title="Toggle Subtitles (C)"
              className={`p-1.5 rounded transition-colors ${
                subtitlesEnabled ? 'bg-primary text-darkBg font-bold' : 'hover:text-primary text-slate-300'
              }`}
            >
              <Subtitles size={17} />
            </button>

            <label title="Upload or Drag & Drop Subtitles (.srt / .vtt)" className="cursor-pointer hover:text-primary p-1.5">
              <Upload size={16} />
              <input type="file" accept=".srt,.vtt" onChange={handleSubtitleUpload} className="hidden" />
            </label>

            {vttContent && (
              <button
                onClick={handleDownloadSubtitles}
                title="Download Generated Subtitles (.vtt)"
                className="hover:text-primary p-1.5 text-slate-300"
              >
                <Download size={16} />
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="font-medium hover:text-primary px-1.5 py-0.5 rounded border border-white/20 text-[11px]"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 bg-darkCard border border-darkBorder rounded-lg py-1 shadow-2xl z-50 flex flex-col min-w-[70px]">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`px-3 py-1 text-left text-xs hover:bg-slate-800 ${
                        playbackRate === rate ? 'text-primary font-bold' : 'text-slate-300'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={togglePiP} title="Picture in Picture (P)" className="hover:text-primary p-1">
              <PictureInPicture size={17} />
            </button>

            <button onClick={toggleFullscreen} title="Fullscreen (F)" className="hover:text-primary p-1">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}