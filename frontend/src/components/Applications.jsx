import React, { useState, useEffect } from 'react';
import { ClipboardList, ChevronRight, Search, Calendar } from 'lucide-react';

const STATUS_MAP = {
  success: { cls: 'badge-success', label: 'Submitted' },
  pending: { cls: 'badge-pending', label: 'Pending' },
  running: { cls: 'badge-running', label: 'In Review' },
  failed:  { cls: 'badge-failed',  label: 'Rejected' },
};

const PLATFORM_COLORS = {
  Upwork:        { bg: '#14a800', short: 'U'  },
  Indeed:        { bg: '#2164f3', short: 'In' },
  Guru:          { bg: '#00a550', short: 'G'  },
  PeoplePerHour: { bg: '#ff7b00', short: 'P'  },
  Dice:          { bg: '#e1251b', short: 'D'  },
  LinkedIn:      { bg: '#0a66c2', short: 'Li' },
  'Demo Portal': { bg: '#7c3aed', short: 'DP' },
  Other:         { bg: '#64748b', short: 'Ot' },
};

function PlatformBadge({ name }) {
  const p = PLATFORM_COLORS[name] || PLATFORM_COLORS.Other;
  return (
    <span className="inline-flex items-center justify-center rounded font-bold text-white"
      style={{ background: p.bg, width: 22, height: 22, fontSize: 9, flexShrink: 0 }}>
      {p.short}
    </span>
  );
}

export default function Applications({ setActiveTab }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const [appsRes, jobsRes, resumesRes] = await Promise.all([
          fetch('/api/applications'), fetch('/api/jobs'), fetch('/api/resumes'),
        ]);
        const [apps, jobs, resumes] = await Promise.all([appsRes.json(), jobsRes.json(), resumesRes.json()]);

        const jobMap    = Object.fromEntries(jobs.map(j    => [j.id, j]));
        const resumeMap = Object.fromEntries(resumes.map(r => [r.id, r]));

        const enriched = apps.map(app => {
          const job    = jobMap[app.job_id]    || {};
          const resume = resumeMap[app.resume_id] || {};
          let platform = 'Other';
          const site = app.website || '';
          if (site.includes('upwork'))      platform = 'Upwork';
          else if (site.includes('indeed')) platform = 'Indeed';
          else if (site.includes('guru'))   platform = 'Guru';
          else if (site.includes('peopleperhour') || site.includes('pph')) platform = 'PeoplePerHour';
          else if (site.includes('dice'))   platform = 'Dice';
          else if (site.includes('linkedin')) platform = 'LinkedIn';
          else if (site.includes('localhost')) platform = 'Demo Portal';
          return { ...app, jobTitle: job.title || '—', company: job.company || '—',
            platform, candidateName: resume.candidate_name || '—' };
        });
        setApplications(enriched);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = applications.filter(a => {
    const q = search.toLowerCase();
    const match = a.jobTitle?.toLowerCase().includes(q) || a.company?.toLowerCase().includes(q) ||
      a.candidateName?.toLowerCase().includes(q) || a.platform?.toLowerCase().includes(q);
    return match && (statusFilter === 'all' || a.status === statusFilter);
  });

  const counts = {
    all:     applications.length,
    success: applications.filter(a => a.status === 'success').length,
    pending: applications.filter(a => a.status === 'pending').length,
    running: applications.filter(a => a.status === 'running').length,
    failed:  applications.filter(a => a.status === 'failed').length,
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>All Applications</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{applications.length} total applications tracked</p>
        </div>
        <button onClick={() => setActiveTab('automation')}
          className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2"
          style={{ background: 'var(--accent)' }}>
          <ClipboardList className="w-3.5 h-3.5" /> New Application
        </button>
      </div>

      {}
      <div className="flex gap-2 flex-wrap">
        {Object.entries({ all: 'All', success: 'Submitted', pending: 'Pending', running: 'In Review', failed: 'Rejected' }).map(([k, label]) => (
          <button key={k} onClick={() => setStatusFilter(k)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition border"
            style={statusFilter === k
              ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
              : { background: '#fff', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            {label} ({counts[k]})
          </button>
        ))}
      </div>

      {}
      <div className="card overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by job title, company..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border outline-none"
              style={{ background: '#fff', borderColor: 'var(--border)' }} />
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} results</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Loading applications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No applications found</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Run automation to start submitting applications</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                  {['Job Title', 'Company', 'Platform', 'Candidate', 'Status', 'Submitted At', 'Match Score'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(app => {
                  const s = STATUS_MAP[app.status] || STATUS_MAP.pending;
                  return (
                    <tr key={app.id} className="border-b hover:bg-gray-50 transition" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="px-4 py-3">
                        <span className="font-semibold max-w-[140px] block truncate" style={{ color: 'var(--text-primary)' }}>{app.jobTitle}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{app.company}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PlatformBadge name={app.platform} />
                          <span style={{ color: 'var(--text-secondary)' }}>{app.platform}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{app.candidateName}</td>
                      <td className="px-4 py-3"><span className={`${s.cls} text-[10px] font-bold px-2 py-0.5 rounded-full`}>{s.label}</span></td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                        {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: app.score >= 75 ? '#059669' : app.score >= 50 ? '#d97706' : '#64748b' }}>
                          {app.score || 0}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
