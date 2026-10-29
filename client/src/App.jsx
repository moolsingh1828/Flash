import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import Watch from './pages/Watch';
import TelegramImport from './pages/TelegramImport';
import Settings from './pages/Settings';
import Login from './pages/Login';
import LoadingState from './components/LoadingState';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-darkBg"><LoadingState message="Authenticating session..." /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex bg-darkBg min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto max-w-7xl">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetails />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/telegram" element={<TelegramImport />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
