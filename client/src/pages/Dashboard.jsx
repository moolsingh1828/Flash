import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import CourseCard from '../components/CourseCard';
import LoadingState from '../components/LoadingState';
import { BookOpen, Video, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [courses, setCourses] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, rRes] = await Promise.all([
          api.get('/courses'),
          api.get('/videos/recent')
        ]);
        setCourses(cRes.data);
        setRecent(rRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <LoadingState message="Organizing library catalog..." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Personal Learning Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Direct stream and access to authorized Telegram channel repositories</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-darkCard border border-darkBorder p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 text-primary rounded-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{courses.length}</div>
            <div className="text-slate-400 text-xs">Total Tracked Courses</div>
          </div>
        </div>

        <div className="bg-darkCard border border-darkBorder p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg">
            <Video size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{courses.length}</div>
            <div className="text-slate-400 text-xs">Course Repositories</div>
          </div>
        </div>

        <div className="bg-darkCard border border-darkBorder p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{recent.length}</div>
            <div className="text-slate-400 text-xs">Recent Lessons in Progress</div>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Continue Watching</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((item) => (
              <Link
                key={item._id}
                to={`/watch/${item.videoId?._id}`}
                className="bg-darkCard border border-darkBorder p-4 rounded-xl hover:border-slate-500 flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-medium text-slate-200 line-clamp-1">{item.videoId?.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.videoId?.originalFilename}</p>
                </div>
                <div className="mt-4 text-xs text-primary font-medium">
                  Resume at {Math.floor(item.positionSeconds / 60)}m {item.positionSeconds % 60}s
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Available Courses</h2>
          <Link to="/courses" className="text-sm text-primary hover:underline">View All</Link>
        </div>
        {courses.length === 0 ? (
          <div className="bg-darkCard border border-darkBorder rounded-xl p-8 text-center text-slate-400">
            No courses found. Go to <Link to="/telegram" className="text-primary hover:underline">Telegram Import</Link> to import videos from authorized channels.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.slice(0, 6).map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
