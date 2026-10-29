import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, DownloadCloud, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Courses', path: '/courses', icon: BookOpen },
    { label: 'Telegram Import', path: '/telegram', icon: DownloadCloud },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-darkCard border-r border-darkBorder flex flex-col justify-between h-screen fixed left-0 top-0">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-darkBorder gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-darkBg">
            T
          </div>
          <span className="font-semibold text-lg text-slate-100">CourseLibrary</span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-slate-700 text-primary' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-darkBorder">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
