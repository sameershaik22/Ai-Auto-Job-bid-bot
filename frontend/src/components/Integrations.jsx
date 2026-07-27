import React, { useState, useEffect } from 'react';
import { Link2, CheckCircle, Settings, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

export default function Integrations() {
  const [configuring, setConfiguring] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/platforms')
      .then(r => r.json())
      .then(setPlatforms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active   = platforms.filter(p => p.status === 'active');
  const upcoming = platforms.filter(p => p.status === 'coming_soon');

  const getColor = (name) => {
    const map = {
      'Upwork': '#14a800', 'Guru': '#00a550', 'PeoplePerHour': '#ff7b00',
      'Greenhouse': '#23774c', 'AshbyHQ': '#5046e5', 'Indeed': '#2164f3',
      'Dice': '#e1251b', 'LinkedIn': '#0a66c2', 'Wellfound': '#000000',
      'RemoteOK': '#14b8a6', 'ZipRecruiter': '#007bff', 'FlexJobs': '#00a878'
    };
    return map[name] || '#334155';
  };

  const getShort = (name) => name.substring(0, 2).replace(/[a-z]/, c => c.toUpperCase());
  const getCategory = (name) => {
    if (['Upwork', 'Guru', 'PeoplePerHour'].includes(name)) return 'Freelance';
    if (['Greenhouse', 'AshbyHQ'].includes(name)) return 'ATS';
    if (['RemoteOK', 'FlexJobs'].includes(name)) return 'Remote';
    return 'Job Board';
  };
  const getDesc = (name) => {
    if (name === 'Upwork') return 'Top freelance marketplace. Connect your account to auto-apply to Upwork jobs.';
    if (name === 'LinkedIn') return 'Professional network and job platform with 900M+ members.';
    return `Automated integration for ${name} job applications.`;
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Platform Integrations</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Connect job platforms to enable automated applications. {active.length} active · {upcoming.length} coming soon
          </p>
        </div>
      </div>

      {}
      <div className="card p-4 flex items-center gap-3 text-xs overflow-x-auto">
        {['Your Resume', '→', 'AI Engine', '→', 'Job Platform', '→', 'Auto Apply', '→', 'Track Result'].map((s, i) => (
          s === '→'
            ? <span key={i} className="text-gray-300 text-lg shrink-0">→</span>
            : <span key={i} className="px-3 py-1.5 rounded-lg font-semibold shrink-0"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{s}</span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          {}
          <div>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Active Integrations (Phase 1)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(p => (
                <div key={p.name} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                        style={{ background: getColor(p.name) }}>{getShort(p.name)}</span>
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: '#f1f5f9', color: 'var(--text-muted)' }}>{getCategory(p.name)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full badge-success">Active</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>{getDesc(p.name)}</p>
                  
                  {p.lastSuccess && (
                    <div className="mb-4 text-[10px] font-semibold flex items-center gap-1.5" style={{ color: '#059669' }}>
                      <CheckCircle className="w-3 h-3" /> Last success: {new Date(p.lastSuccess).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto">
                    <button className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition hover:bg-gray-50 flex items-center justify-center gap-1"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      onClick={() => setConfiguring(p.name)}>
                      <Settings className="w-3 h-3" /> Configure
                    </button>
                    <button className="py-1.5 px-3 rounded-lg text-xs font-semibold border transition hover:bg-gray-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {}
          <div className="mt-8">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <AlertCircle className="w-4 h-4 text-amber-500" /> Coming Soon (Phase 2 & 3)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(p => (
                <div key={p.name} className="card p-5 opacity-70 hover:opacity-90 transition-opacity">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                        style={{ background: getColor(p.name) }}>{getShort(p.name)}</span>
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: '#f1f5f9', color: 'var(--text-muted)' }}>{getCategory(p.name)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full badge-pending">Phase {p.phase}</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>{getDesc(p.name)}</p>
                  <button className="w-full mt-auto py-1.5 rounded-lg text-xs font-semibold border transition"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: '#f8fafc' }} disabled>
                    Coming Soon
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {}
      {configuring && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
          onClick={() => setConfiguring(null)}>
          <div className="card p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>{configuring} Settings</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              This integration uses the automation engine and your configured API keys. No additional credentials required.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span className="badge-success text-[10px] font-bold px-2 py-0.5 rounded-full">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Plugin</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{configuring.toLowerCase().replace(/\s+/g, '')}Scraper</span>
              </div>
            </div>
            <button onClick={() => setConfiguring(null)}
              className="w-full mt-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'var(--accent)' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
