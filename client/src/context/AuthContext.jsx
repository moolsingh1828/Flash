import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function checkUser() {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { checkUser(); }, []);

async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
    }
    setUser(res.data.user);
    return res.data;
  }

  async function logout() {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: checkUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
