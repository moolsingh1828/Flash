import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DownloadCloud, CheckCircle, RefreshCw } from 'lucide-react';

export default function TelegramImport() {
  const [status, setStatus] = useState(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('phone');
  const [channels, setChannels] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(false);

  async function checkStatus() {
    try {
      const res = await api.get('/telegram/status');
      setStatus(res.data);
      if (res.data.connected) {
        setStep('ready');
        loadChannels();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadChannels() {
    try {
      const res = await api.get('/telegram/channels');
      setChannels(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => { checkStatus(); }, []);

  async function handleSendCode(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/telegram/auth/start', { phoneNumber: phone });
      setStep('code');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to request login code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/telegram/auth/verify', { code });
      if (res.data.requires2FA) setStep('2fa');
      else {
        setStep('ready');
        checkStatus();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2FA(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/telegram/auth/2fa', { password });
      setStep('ready');
      checkStatus();
    } catch (err) {
      alert(err.response?.data?.error || 'Invalid 2FA password');
    } finally {
      setLoading(false);
    }
  }

  async function startImport(channelId) {
    try {
      const res = await api.post('/telegram/import', { channelId });
      setActiveJob({ id: res.data.jobId, messagesScanned: 0, videosImported: 0, status: 'running' });
      pollJob(res.data.jobId);
    } catch (err) {
      alert('Failed starting import task');
    }
  }

  function pollJob(jobId) {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/telegram/import/status/${jobId}`);
        setActiveJob(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 1500);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Telegram Channel Importer</h1>
        <p className="text-slate-400 text-sm mt-1">Authenticate session securely and import course video metadata</p>
      </div>

      {step !== 'ready' ? (
        <div className="bg-darkCard border border-darkBorder p-8 rounded-2xl max-w-md mx-auto space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Connect Telegram Account</h2>

          {step === 'phone' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number (with country code)</label>
                <input
                  type="text"
                  required
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-sky-400 text-darkBg font-medium py-2 rounded-lg text-sm"
              >
                {loading ? 'Sending Request...' : 'Send Telegram Code'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Verification Code</label>
                <input
                  type="text"
                  required
                  placeholder="12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-sky-400 text-darkBg font-medium py-2 rounded-lg text-sm"
              >
                {loading ? 'Validating Code...' : 'Verify Code'}
              </button>
            </form>
          )}

          {step === '2fa' && (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Two-Step Verification Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder rounded-lg p-2.5 text-slate-100 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-sky-400 text-darkBg font-medium py-2 rounded-lg text-sm"
              >
                {loading ? 'Verifying...' : 'Submit 2FA Password'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-darkCard border border-darkBorder p-5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-400" size={20} />
              <div>
                <span className="font-semibold text-sm text-slate-200">Connected: {status?.phone}</span>
                <p className="text-xs text-slate-400">Telegram MTProto Authorized Session</p>
              </div>
            </div>
            <button
              onClick={loadChannels}
              className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg"
            >
              <RefreshCw size={14} /> Refresh Channels
            </button>
          </div>

          {activeJob && (
            <div className="bg-darkCard border border-primary/30 p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm text-slate-100">
                  Import Job Status: <span className="text-primary uppercase text-xs">{activeJob.status}</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">Job: {activeJob._id || activeJob.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-900 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-slate-200">{activeJob.messagesScanned}</div>
                  <div className="text-[10px] text-slate-400">Scanned</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-emerald-400">{activeJob.videosImported}</div>
                  <div className="text-[10px] text-slate-400">Imported</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-slate-400">{activeJob.itemsSkipped || 0}</div>
                  <div className="text-[10px] text-slate-400">Skipped</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-darkCard border border-darkBorder rounded-xl overflow-hidden">
            <div className="p-4 bg-slate-800/40 border-b border-darkBorder font-semibold text-sm text-slate-200">
              Select Authorized Channels / Groups
            </div>
            <div className="divide-y divide-darkBorder">
              {channels.map((chan) => (
                <div key={chan.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30">
                  <div>
                    <h4 className="text-sm font-medium text-slate-200">{chan.title}</h4>
                    <span className="text-xs text-slate-500 font-mono">Channel ID: {chan.id}</span>
                  </div>
                  <button
                    onClick={() => startImport(chan.id)}
                    className="flex items-center gap-1.5 bg-primary hover:bg-sky-400 text-darkBg font-medium text-xs px-3 py-1.5 rounded-lg"
                  >
                    <DownloadCloud size={14} /> Import Channel
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
