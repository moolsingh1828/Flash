import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Folder } from 'lucide-react';

export default function CourseCard({ course }) {
  return (
    <Link
      to={`/courses/${course._id}`}
      className="bg-darkCard border border-darkBorder rounded-xl overflow-hidden hover:border-slate-500 transition-all flex flex-col group"
    >
      <div className="h-36 bg-slate-800 flex items-center justify-center border-b border-darkBorder">
        {course.coverImage ? (
          <img src={course.coverImage} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={42} className="text-slate-600 group-hover:text-primary transition-colors" />
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-lg text-slate-100 group-hover:text-primary transition-colors line-clamp-1">
            {course.title}
          </h3>
          <p className="text-slate-400 text-sm mt-2 line-clamp-2">
            {course.description || 'No description available for this course.'}
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-darkBorder flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Folder size={14} /> {course.source === 'telegram' ? 'Telegram Channel' : 'Manual Course'}
          </span>
          <span>{new Date(course.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
}
