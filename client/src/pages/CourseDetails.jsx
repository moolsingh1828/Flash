import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import LoadingState from '../components/LoadingState';
import { Folder, PlayCircle, Plus, Edit2, Trash2 } from 'lucide-react';

export default function CourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  async function loadDetails() {
    try {
      const res = await api.get(`/courses/${id}`);
      setData(res.data);
      setEditTitle(res.data.course.title);
      setEditDescription(res.data.course.description || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [id]);

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post('/folders', { name: newFolderName, courseId: id });
      setNewFolderName('');
      loadDetails();
    } catch {
      alert('Error creating module folder');
    }
  }

  async function handleUpdateCourse(e) {
    e.preventDefault();
    try {
      await api.patch(`/courses/${id}`, { title: editTitle, description: editDescription });
      setIsEditing(false);
      loadDetails();
    } catch {
      alert('Failed updating course');
    }
  }

  async function handleDeleteCourse() {
    if (!confirm(`Are you sure you want to permanently delete "${data.course.title}" and all its lessons?`)) return;
    try {
      await api.delete(`/courses/${id}`);
      navigate('/courses');
    } catch {
      alert('Failed to delete course');
    }
  }

  if (loading) return <LoadingState message="Loading course modules..." />;
  if (!data) return <div className="text-slate-400">Course not found.</div>;

  const { course, folders, videos } = data;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {isEditing ? (
          <form onSubmit={handleUpdateCourse} className="w-full space-y-3">
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2 text-slate-100 text-lg font-bold"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2 text-slate-300 text-xs"
              rows={2}
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-primary hover:bg-sky-400 text-darkBg text-xs font-semibold px-3 py-1.5 rounded-lg">
                Save
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{course.title}</h1>
              <button onClick={() => setIsEditing(true)} title="Edit Title/Desc" className="text-slate-500 hover:text-primary">
                <Edit2 size={16} />
              </button>
              <button onClick={handleDeleteCourse} title="Delete Course" className="text-slate-500 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="text-slate-400 text-sm mt-1">{course.description || 'No description provided.'}</p>
          </div>
        )}

        <form onSubmit={handleCreateFolder} className="flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="New Module name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="bg-slate-900 border border-darkBorder rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg"
          >
            <Plus size={14} /> Add Module
          </button>
        </form>
      </div>

      {/* Modules & Lesson Hierarchy */}
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
                  <div className="p-4 text-xs text-slate-500">No lessons inside this module</div>
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
                          <span className="text-xs text-slate-500">{video.originalFilename || 'Telegram Video Lesson'}</span>
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

        {/* Unassigned Lessons */}
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