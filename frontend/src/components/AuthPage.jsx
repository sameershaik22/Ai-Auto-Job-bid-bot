import React, { useState } from 'react';
import { Brain, Eye, EyeOff, Mail, Lock, User, Zap, CheckCircle } from 'lucide-react';

const FEATURES = [
  'AI Resume Tailoring with Gemini',
  'ATS Compatibility Scoring',
  'Automated Cover Letters',
  'Playwright Job Application Bots',
  'Neon Cloud Database Storage',
  'Real-time Dashboard Analytics',
];

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login'); 
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      fontFamily: "'Inter', sans-serif", background: '#f5f7fb'
    }}>
      {}
      <div style={{
        width: '45%', background: 'linear-gradient(135deg, #1a1f36 0%, #0f1525 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 56px', color: '#fff',
        boxSizing: 'border-box'
      }}>
        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Brain size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>Job Bid Bot</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>AI Auto — Production</div>
          </div>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px' }}>
          Your AI-Powered<br />
          <span style={{ color: '#818cf8' }}>Job Application</span><br />
          Platform
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7, marginBottom: 44 }}>
          Upload resumes, import jobs, let AI tailor your applications and automate submissions — all from one elegant dashboard.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={16} color="#4ade80" />
              <span style={{ fontSize: 13.5, color: '#cbd5e1' }}>{f}</span>
            </div>
          ))}
        </div>

      </div>

      {}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px', boxSizing: 'border-box'
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32 }}>
            {mode === 'login'
              ? 'Sign in to access your AI workspace.'
              : 'Start your free account. No credit card required.'}
          </p>

          {}
          <div style={{
            display: 'flex', background: '#f1f5f9', borderRadius: 10,
            padding: 4, marginBottom: 28
          }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 600, transition: 'all 0.2s',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#1e293b' : '#94a3b8',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
                }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  name="name" type="text" placeholder="Full Name"
                  value={form.name} onChange={handleChange} required
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                name="email" type="email" placeholder="Email address"
                value={form.email} onChange={handleChange} required
                style={inputStyle}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                name="password" type={showPass ? 'text' : 'password'} placeholder="Password"
                value={form.password} onChange={handleChange} required minLength={6}
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, color: '#dc2626', fontSize: 13
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                padding: '13px', background: loading ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 14.5,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
              }}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px 12px 42px',
  border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14,
  color: '#1e293b', background: '#fff', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
  fontFamily: 'inherit'
};
