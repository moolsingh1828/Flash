import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import LoadingState from '../components/LoadingState';
import { Folder, PlayCircle, Plus } from 'lucide-react';

export default function CourseDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');

  async function loadDetails() {
    try {
      const res = await api.get(`/courses/${id}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDetails(); }, [id]);

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName) return;
    try {
      await api.post('/folders', { name: newFolderName, courseId: id });
      setNewFolderName('');
      loadDetails();
    } catch (err) {
      alert('Error creating folder');
    }
  }

  if (loading) return <LoadingState message="Loading course modules..." />;
  if (!data) return <div className="text-slate-400">Course not found.</div>;

  const { course, folders, videos } = data;

  return (
    <div className="space-y-8">
      <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{course.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{course.description || 'Channel course repository'}</p>
        </div>
        <form onSubmit={handleCreateFolder} className="flex gap-2">
          <input
            type="text"
            placeholder="New Module name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="bg-slate-900 border border-darkBorder rounded-lg px-3 py-1.5 text-xs text-slate-200"
          />
          <button
            type="submit"
            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg"
          >
            <Plus size={14} /> Add Module
          </button>
        </form>
      </div>

      <div className="space-y-6">
        {folders.map((folder) => {
          const folderVideos = videos.filter((v) => v.folderId === folder._id);
          return (
            <div key={folder._id} className="bg-darkCard border border-darkBorder rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-800/60 border-b border-darkBorder flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                  <Folder size={16} className="text-primary" /> {folder.name}
                </span>
                <span className="text-xs text-slate-400">{folderVideos.length} lessons</span>
              </div>
              <div className="divide-y divide-darkBorder">
                {folderVideos.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500">No lessons inside this folder</div>
                ) : (
                  folderVideos.map((video) => (
                    <Link
                      key={video._id}
                      to={`/watch/${video._id}`}
                      className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <PlayCircle size={18} className="text-slate-500 group-hover:text-primary transition-colors" />
                        <div>
                          <h4 className="text-sm font-medium text-slate-200 group-hover:text-primary transition-colors">
                            {video.title}
                          </h4>
                          <span className="text-xs text-slate-500">{video.originalFilename || 'Telegram Media'}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {video.duration ? `${Math.floor(video.duration / 60)}m ${video.duration % 60}s` : ''}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {videos.filter((v) => !v.folderId).length > 0 && (
          <div className="bg-darkCard border border-darkBorder rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-800/60 border-b border-darkBorder flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-200">Unassigned Lessons</span>
            </div>
            <div className="divide-y divide-darkBorder">
              {videos.filter((v) => !v.folderId).map((video) => (
                <Link
                  key={video._id}
                  to={`/watch/${video._id}`}
                  className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <PlayCircle size={18} className="text-slate-500 group-hover:text-primary" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-200 group-hover:text-primary">{video.title}</h4>
                      <span className="text-xs text-slate-500">{video.originalFilename}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {video.duration ? `${Math.floor(video.duration / 60)}m` : ''}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
