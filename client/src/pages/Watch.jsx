import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import VideoPlayer from '../components/VideoPlayer';
import LoadingState from '../components/LoadingState';
import { ExternalLink } from 'lucide-react';

export default function Watch() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVideo() {
      try {
        const res = await api.get(`/videos/${id}`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, [id]);

  if (loading) return <LoadingState message="Connecting to media pipeline..." />;
  if (!data?.video) return <div className="text-slate-400">Video lesson not found.</div>;

  const { video, progress } = data;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <VideoPlayer videoId={video._id} initialPosition={progress.positionSeconds} />

      <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-100">{video.title}</h1>
          <p className="text-xs text-slate-400 font-mono">Original: {video.originalFilename || 'telegram_media.mp4'}</p>
          {video.originalCaption && (
            <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-darkBorder text-slate-300 text-sm whitespace-pre-line">
              {video.originalCaption}
            </div>
          )}
        </div>

        <div className="flex md:flex-col gap-3 shrink-0">
          {video.courseId && (
            <Link
              to={`/courses/${video.courseId}`}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              Course Overview
            </Link>
          )}

          {video.telegramChatId && (
            <a
              href={`https://t.me/c/${video.telegramChatId.replace('-100', '')}/${video.telegramMessageId}`}
              target="_blank"
              rel="noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              <ExternalLink size={14} /> Open in Telegram
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
