import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        await api.post('/auth/register', { email, password });
      } else {
        await api.post('/auth/login', { email, password });
      }
      await refreshUser();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-darkBg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary mx-auto mb-3 flex items-center justify-center font-bold text-xl text-darkBg">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Telegram Course Library</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isRegistering ? 'Create your personal account' : 'Sign in to your offline repository'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-slate-900 border border-darkBorder rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full bg-slate-900 border border-darkBorder rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-sky-400 text-darkBg font-semibold py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? 'Please wait...' : isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          {isRegistering ? 'Already have an account? ' : "Don't have an account yet? "}
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-primary hover:underline font-medium"
          >
            {isRegistering ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}