import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import CourseCard from '../components/CourseCard';
import LoadingState from '../components/LoadingState';
import { Plus, Search } from 'lucide-react';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

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

  useEffect(() => { loadCourses(); }, []);

  async function handleCreateCourse(e) {
    e.preventDefault();
    try {
      await api.post('/courses', { title, description });
      setTitle('');
      setDescription('');
      setShowModal(false);
      loadCourses();
    } catch (err) {
      alert('Failed creating course');
    }
  }

  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Course Catalog</h1>
          <p className="text-slate-400 text-sm mt-1">Organized channels, modules, and manual learning paths</p>
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
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-sky-400 text-darkBg font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} /> Create Course
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading courses..." />
      ) : filtered.length === 0 ? (
        <div className="bg-darkCard border border-darkBorder rounded-xl p-12 text-center text-slate-400">
          No matching courses found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map(course => (
            <CourseCard key={course._id} course={course} />
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Create New Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm"
                  placeholder="e.g. Distributed Systems Masterclass"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm"
                  placeholder="Course syllabus description..."
                  rows={3}
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
                  className="bg-primary hover:bg-sky-400 text-darkBg font-medium px-4 py-2 rounded-lg text-sm"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
