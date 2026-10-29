import React from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, refreshUser } = useAuth();

  async function handleDisconnectTelegram() {
    if (!confirm('Are you sure you want to disconnect Telegram session?')) return;
    try {
      await api.post('/telegram/disconnect');
      await refreshUser();
      alert('Telegram session disconnected');
    } catch (err) {
      alert('Error disconnecting session');
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Application Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage single-user auth, encrypted session keys, and caching parameters</p>
      </div>

      <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl space-y-4">
        <h2 className="text-base font-semibold text-slate-200">Account Credentials</h2>
        <div className="text-sm text-slate-300">
          Logged in as: <span className="font-mono text-primary">{user?.email}</span>
        </div>
      </div>

      <div className="bg-darkCard border border-darkBorder p-6 rounded-2xl space-y-4">
        <h2 className="text-base font-semibold text-slate-200">Telegram Session State</h2>
        <p className="text-xs text-slate-400">
          Telegram sessions are stored server-side encrypted using AES-256-GCM.
        </p>
        <button
          onClick={handleDisconnectTelegram}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-4 py-2 rounded-lg font-medium"
        >
          Revoke Active Telegram MTProto Session
        </button>
      </div>
    </div>
  );
}
