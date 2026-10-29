import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import CourseCard from '../components/CourseCard';
import LoadingState from '../components/LoadingState';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');

  async function loadCourses() {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  function handleOpenCreate() {
    setEditingCourse(null);
    setTitle('');
    setDescription('');
    setCoverImage('');
    setShowModal(true);
  }

  function handleOpenEdit(course, e) {
    e.preventDefault();
    e.stopPropagation();
    setEditingCourse(course);
    setTitle(course.title);
    setDescription(course.description || '');
    setCoverImage(course.coverImage || '');
    setShowModal(true);
  }

  async function handleDeleteCourse(id, title, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${title}" and all its lessons?`)) return;

    try {
      await api.delete(`/courses/${id}`);
      setCourses(courses.filter(c => c._id !== id));
    } catch {
      alert('Failed to delete course');
    }
  }

  async function handleSaveCourse(e) {
    e.preventDefault();
    try {
      if (editingCourse) {
        await api.patch(`/courses/${editingCourse._id}`, { title, description, coverImage });
      } else {
        await api.post('/courses', { title, description, coverImage });
      }
      setShowModal(false);
      loadCourses();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed saving course');
    }
  }

  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Course Catalog</h1>
          <p className="text-slate-400 text-sm mt-1">Manage, edit, and organize all imported courses</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-darkCard border border-darkBorder rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-primary hover:bg-sky-400 text-darkBg font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} /> Add Course
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading courses..." />
      ) : filtered.length === 0 ? (
        <div className="bg-darkCard border border-darkBorder rounded-xl p-12 text-center text-slate-400">
          No courses found. Click <strong>Add Course</strong> or import from Telegram.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map(course => (
            <div key={course._id} className="relative group">
              <CourseCard course={course} />
              {/* Quick Actions Overlay */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 p-1 rounded-lg border border-darkBorder shadow-lg">
                <button
                  onClick={(e) => handleOpenEdit(course, e)}
                  title="Edit Course"
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-primary rounded"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => handleDeleteCourse(course._id, course.title, e)}
                  title="Delete Course"
                  className="p-1.5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              {editingCourse ? 'Edit Course' : 'Create New Course'}
            </h3>
            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm focus:border-primary focus:outline-none"
                  placeholder="e.g. Masterclass React & Node"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm focus:border-primary focus:outline-none"
                  placeholder="Syllabus and overview..."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cover Image URL (Optional)</label>
                <input
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm focus:border-primary focus:outline-none"
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary hover:bg-sky-400 text-darkBg font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {editingCourse ? 'Update Course' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}