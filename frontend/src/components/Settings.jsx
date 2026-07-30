import React, { useState, useEffect } from 'react';
import { Key, Monitor, ShieldAlert, CheckCircle, Save, Cpu, User, RefreshCw, Lock } from 'lucide-react';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 };
const muted = { color: 'var(--text-muted)' };
const inputCls = 'w-full rounded-lg p-2.5 text-xs outline-none transition border';
const inputStyle = { background: '#f8fafc', borderColor: '#e2e8f0', color: 'var(--text-primary)' };
const monoStyle = { ...inputStyle, fontFamily: 'monospace' };

export default function SettingsView({ user: userProp, onUserSave }) {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [userName,  setUserName]  = useState('');
  const [userRole,  setUserRole]  = useState('Administrator');
  const [userEmail, setUserEmail] = useState('');

  const [geminiKey,    setGeminiKey]    = useState('');
  const [openaiKey,    setOpenaiKey]    = useState('');

  const [headlessMode, setHeadlessMode] = useState('false');
  const [typingDelay,  setTypingDelay]  = useState('80');

  const [maxRetries,  setMaxRetries]  = useState('1');
  const [concurrency, setConcurrency] = useState('1');

  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const [credentials, setCredentials] = useState({});
  const [credSaving, setCredSaving] = useState({});

  const PLATFORMS = ['LinkedIn', 'Indeed', 'Workday', 'Greenhouse', 'Lever'];

  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      setGeminiKey(d.GEMINI_API_KEY   || '');
      setOpenaiKey(d.OPENAI_API_KEY   || '');
      setHeadlessMode(d.HEADLESS_MODE || 'false');
      setTypingDelay(d.TYPING_DELAY   || '80');
      setMaxRetries(d.MAX_RETRIES     || '1');
      setConcurrency(d.CONCURRENCY    || '1');
    }).catch(console.error);

    fetch('/api/credentials').then(r => r.ok ? r.json() : []).then(rows => {
      const map = {};
      rows.forEach(r => { map[r.platform] = { email: r.email || '', password: '' }; });
      setCredentials(map);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (userProp) {
      setUserName(userProp.name  || '');
      setUserRole(userProp.role  || 'Administrator');
      setUserEmail(userProp.email || '');
    }
  }, [userProp]);

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/system-health');
      setHealth(await res.json());
    } catch (e) {  }
    finally { setHealthLoading(false); }
  };

  useEffect(() => { if (activeSubTab === 'health') loadHealth(); }, [activeSubTab]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, role: userRole, email: userEmail }),
      });
      if (res.ok) {
        setSuccess('Profile saved!');
        setTimeout(() => setSuccess(''), 3000);
        if (onUserSave) onUserSave(); 
      } else { alert('Failed to save profile.'); }
    } catch (e) { alert('Error saving profile.'); }
    finally { setLoading(false); }
  };

  const handleSaveCredential = async (platform) => {
    const cred = credentials[platform];
    if (!cred?.email) { alert('Email is required'); return; }
    setCredSaving(p => ({ ...p, [platform]: true }));
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platform.toLowerCase(), email: cred.email, password: cred.password }),
      });
      if (res.ok) { setSuccess(`${platform} credentials saved!`); setTimeout(() => setSuccess(''), 3000); }
      else { const e = await res.json(); alert(e.error || 'Save failed'); }
    } catch (e) { alert('Error saving credentials'); }
    finally { setCredSaving(p => ({ ...p, [platform]: false })); }
  };

  const handleDeleteCredential = async (platform) => {
    await fetch(`/api/credentials/${platform.toLowerCase()}`, { method: 'DELETE' });
    setCredentials(p => { const n = { ...p }; delete n[platform]; return n; });
  };

  const navItems = [
    { id: 'profile',     Icon: User,        label: 'User Profile'        },
    { id: 'api',         Icon: Key,         label: 'API Credentials'     },
    { id: 'credentials', Icon: Lock,        label: 'Platform Logins'     },
    { id: 'browser',     Icon: Monitor,     label: 'Browser Settings'    },
    { id: 'advanced',    Icon: ShieldAlert, label: 'Queue & Security'    },
    { id: 'health',      Icon: Cpu,         label: 'System Health'       },
  ];

  const isProfileTab = activeSubTab === 'profile';

  return (
    <div className="space-y-8 fade-in">

      {}
      <div className="border-b pb-5 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <p className="text-sm mt-1" style={muted}>Configure your profile, API credentials, browser and automation parameters.</p>
        </div>
        {success && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold badge-success">
            <CheckCircle className="w-4 h-4" /> {success}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {}
        <div className="lg:col-span-1">
          <div className="p-2 rounded-xl space-y-0.5 shadow-sm" style={card}>
            {navItems.map(({ id, Icon, label }) => {
              const active = activeSubTab === id;
              return (
                <button key={id} onClick={() => setActiveSubTab(id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: active ? 'var(--accent-light)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                  }}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {}
        <div className="lg:col-span-3">

          {}
          {activeSubTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="p-6 rounded-xl space-y-5 shadow-sm" style={card}>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-3"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                <User className="w-4 h-4" style={{ color: 'var(--accent)' }} /> User Profile
              </h3>
              <p className="text-xs" style={muted}>
                This profile is stored in your local database. Your name appears in the header and user menu.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Display Name</label>
                  <input type="text" value={userName} onChange={e => setUserName(e.target.value)}
                    placeholder="Your name" className={inputCls} style={inputStyle} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Role</label>
                  <select value={userRole} onChange={e => setUserRole(e.target.value)}
                    className={inputCls} style={inputStyle}>
                    <option value="Administrator">Administrator</option>
                    <option value="Job Seeker">Job Seeker</option>
                    <option value="Freelancer">Freelancer</option>
                    <option value="Recruiter">Recruiter</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Email</label>
                  <input type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)}
                    placeholder="you@example.com" className={inputCls} style={inputStyle} />
                </div>
              </div>
              <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                <button type="submit" disabled={loading}
                  className="px-6 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition"
                  style={{ background: loading ? '#818cf8' : 'var(--accent)' }}>
                  <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {}
          {activeSubTab === 'api' && (
            <form onSubmit={handleSaveSettings} className="p-6 rounded-xl space-y-5 shadow-sm" style={card}>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-3"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                <Cpu className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Generative AI Integration
              </h3>
              <p className="text-xs" style={muted}>
                Provide keys to enable real AI generation. Both keys are stored in the local database, never sent anywhere else.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>
                    Google Gemini API Key <span className="text-red-500">*</span>
                  </label>
                  <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIza..." className={inputCls} style={monoStyle} />
                  <p className="text-[10px]" style={muted}>
                    Get free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                      className="underline" style={{ color: 'var(--accent)' }}>aistudio.google.com</a> — Required for all AI features.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>OpenAI API Key <span className="text-gray-400">(Optional)</span></label>
                  <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..." className={inputCls} style={monoStyle} />
                  <p className="text-[10px]" style={muted}>Used as fallback if Gemini fails.</p>
                </div>
              </div>
              <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                <button type="submit" disabled={loading}
                  className="px-6 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition"
                  style={{ background: loading ? '#818cf8' : 'var(--accent)' }}>
                  <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save Keys'}
                </button>
              </div>
            </form>
          )}

          {}
          {activeSubTab === 'credentials' && (
            <div className="p-6 rounded-xl space-y-5 shadow-sm" style={card}>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-3"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                <Lock className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Platform Login Credentials
              </h3>
              <p className="text-xs" style={muted}>
                Credentials are AES-256 encrypted before storage. The bot uses these to log in to platforms that require authentication before applying.
              </p>
              <div className="space-y-4">
                {PLATFORMS.map(platform => {
                  const cred = credentials[platform] || { email: '', password: '' };
                  const isSaving = credSaving[platform];
                  return (
                    <div key={platform} className="p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{platform}</div>
                        {credentials[platform]?.email && (
                          <button onClick={() => handleDeleteCredential(platform)} className="text-xs" style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          type="email" placeholder={`${platform} email`} value={cred.email}
                          onChange={e => setCredentials(p => ({ ...p, [platform]: { ...cred, email: e.target.value } }))}
                          className={inputCls} style={inputStyle}
                        />
                        <input
                          type="password" placeholder="Password" value={cred.password}
                          onChange={e => setCredentials(p => ({ ...p, [platform]: { ...cred, password: e.target.value } }))}
                          className={inputCls} style={monoStyle}
                        />
                      </div>
                      <button onClick={() => handleSaveCredential(platform)} disabled={isSaving}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
                        style={{ background: isSaving ? '#818cf8' : 'var(--accent)', border: 'none', cursor: 'pointer' }}>
                        <Save className="w-3 h-3" /> {isSaving ? 'Saving…' : `Save ${platform}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {}
          {activeSubTab === 'browser' && (
            <form onSubmit={handleSaveSettings} className="p-6 rounded-xl space-y-5 shadow-sm" style={card}>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-3"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                <Monitor className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Playwright Web Fingerprints
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Browser Launch Mode</label>
                  <select value={headlessMode} onChange={e => setHeadlessMode(e.target.value)}
                    className={inputCls} style={inputStyle}>
                    <option value="true">Headless (Background — production)</option>
                    <option value="false">Headful (Visible browser — debugging)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Typing Delay (ms)</label>
                  <input type="number" value={typingDelay} onChange={e => setTypingDelay(e.target.value)}
                    className={inputCls} style={monoStyle} min="20" max="500" />
                  <span className="text-[10px]" style={muted}>Keystroke interval to mimic human typing (recommended: 80ms)</span>
                </div>
              </div>
              <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                <button type="submit" disabled={loading}
                  className="px-6 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition"
                  style={{ background: loading ? '#818cf8' : 'var(--accent)' }}>
                  <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save Browser Config'}
                </button>
              </div>
            </form>
          )}

          {}
          {activeSubTab === 'advanced' && (
            <form onSubmit={handleSaveSettings} className="p-6 rounded-xl space-y-5 shadow-sm" style={card}>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b pb-3"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                <ShieldAlert className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Worker Concurrency & Security
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Max Retries on Crash</label>
                  <input type="number" value={maxRetries} onChange={e => setMaxRetries(e.target.value)}
                    className={inputCls} style={monoStyle} min="0" max="5" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={muted}>Queue Worker Concurrency</label>
                  <input type="number" value={concurrency} onChange={e => setConcurrency(e.target.value)}
                    className={inputCls} style={monoStyle} min="1" max="10" />
                  <span className="text-[10px]" style={muted}>Chromium nodes allowed to run concurrently.</span>
                </div>
              </div>
              <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                <button type="submit" disabled={loading}
                  className="px-6 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition"
                  style={{ background: loading ? '#818cf8' : 'var(--accent)' }}>
                  <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save Queue Config'}
                </button>
              </div>
            </form>
          )}

          {}
          {activeSubTab === 'health' && (
            <div className="p-6 rounded-xl shadow-sm space-y-5" style={card}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"
                  style={{ color: 'var(--text-secondary)' }}>
                  <Cpu className="w-4 h-4" style={{ color: 'var(--accent)' }} /> System Health
                </h3>
                <button onClick={loadHealth} disabled={healthLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <RefreshCw className={`w-3 h-3 ${healthLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {healthLoading && !health && (
                <div className="py-8 text-center text-xs" style={muted}>Checking system health...</div>
              )}

              {health && (
                <div className="space-y-4">
                  {}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Database',   value: health.database?.status, ok: health.database?.status === 'healthy' },
                      { label: 'AI Engine',  value: health.ai === 'connected' ? 'connected' : 'no API key', ok: health.ai === 'connected' },
                      { label: 'Playwright', value: health.playwright, ok: health.playwright === 'ready' },
                      { label: 'Node.js',    value: health.nodeVersion, ok: true },
                    ].map(({ label, value, ok }) => (
                      <div key={label} className="p-3 rounded-xl text-center" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
                        <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Uptime',         value: health.uptimeHuman },
                      { label: 'DB Latency',      value: `${health.database?.latencyMs}ms (${health.database?.driver})` },
                      { label: 'Memory Used',     value: `${health.memory?.usedMB} MB / ${health.memory?.totalMB} MB` },
                      { label: 'Heap Used',       value: `${health.memory?.heapUsedMB} MB` },
                      { label: 'Platform',        value: health.platform },
                      { label: 'Last Checked',    value: health.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
                        <span className="text-xs" style={muted}>{label}</span>
                        <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
