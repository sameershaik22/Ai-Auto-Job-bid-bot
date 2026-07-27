import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Briefcase, ClipboardList, TrendingUp, Brain, Users,
  CheckCircle, Clock, XCircle, AlertCircle, ChevronRight,
  Activity, Cpu, HardDrive, MemoryStick, ArrowUpRight, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PLATFORM_COLORS = {
  Upwork:        { bg: '#14a800', short: 'U'  },
  Indeed:        { bg: '#2164f3', short: 'In' },
  Guru:          { bg: '#00a550', short: 'G'  },
  PeoplePerHour: { bg: '#ff7b00', short: 'P'  },
  Dice:          { bg: '#e1251b', short: 'D'  },
  LinkedIn:      { bg: '#0a66c2', short: 'Li' },
  Greenhouse:    { bg: '#23774c', short: 'Gh' },
  Lever:         { bg: '#0072ce', short: 'Lv' },
  'Demo Portal': { bg: '#7c3aed', short: 'DP' },
  Other:         { bg: '#64748b', short: 'Ot' },
};

function PlatformBadge({ name, size = 20 }) {
  const p = PLATFORM_COLORS[name] || PLATFORM_COLORS.Other;
  return (
    <span className="inline-flex items-center justify-center rounded font-bold text-white text-[10px]"
      style={{ background: p.bg, width: size, height: size, fontSize: 9, flexShrink: 0 }}>
      {p.short}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    success: { cls: 'badge-success', label: 'Submitted' },
    pending: { cls: 'badge-pending', label: 'Pending' },
    running: { cls: 'badge-running', label: 'In Review' },
    failed:  { cls: 'badge-failed',  label: 'Rejected' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`${s.cls} text-[10px] font-bold px-2 py-0.5 rounded-full`}>{s.label}</span>
  );
}

const DONUT_COLORS = ['#4f46e5', '#f59e0b', '#8b5cf6', '#ef4444'];
const DONUT_LABELS = ['Submitted', 'Pending', 'In Review', 'Rejected'];

function StatCard({ title, value, sub, trend, Icon, iconBg }) {
  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{title}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {value}
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-1 text-xs font-medium text-emerald-600">
            <ArrowUpRight className="w-3 h-3" />
            <span>{trend}</span>
            {sub && <span className="text-gray-400 font-normal">{sub}</span>}
          </div>
        )}
        {!trend && sub && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card shadow-lg p-3 text-xs">
      <p className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="card shadow-lg p-3 text-xs">
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{name}: <strong>{value}</strong></p>
    </div>
  );
};

export default function Dashboard({ systemLogs, setActiveTab }) {
  const [data, setData]       = useState(null);
  const [activity, setActivity] = useState([]);
  const [health, setHealth]    = useState(null);
  const [loading, setLoading]  = useState(true);
  const [filter, setFilter]    = useState('14d');

  const load = useCallback(async () => {
    try {
      const [statsRes, actRes, healthRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/activity?limit=20'),
        fetch('/api/system-health'),
      ]);
      const [statsJson, actJson, healthJson] = await Promise.all([
        statsRes.json(), actRes.json(), healthRes.json(),
      ]);
      setData(statsJson);
      setActivity(Array.isArray(actJson) ? actJson : []);
      setHealth(healthJson);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  const s  = data?.stats || {};
  const cd = data?.chartData || [];
  const platforms      = data?.platforms || [];
  const recentApps     = data?.recentApplications || [];
  const activityFeed   = activity;
  const automation     = data?.automationStatus || {};

  const donutData = [
    { name: 'Submitted', value: s.successCount || 0 },
    { name: 'Pending',   value: s.pendingCount  || 0 },
    { name: 'In Review', value: s.runningCount  || 0 },
    { name: 'Rejected',  value: s.failedCount   || 0 },
  ].filter(d => d.value > 0);
  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  const STAT_CARDS = [
    { title: 'Total Resumes',      value: s.totalResumes    || 0,  trend: '+1 this week', sub: '',                Icon: FileText,     iconBg: '#7c3aed' },
    { title: 'Total Jobs',         value: s.totalJobs       || 0,  trend: 'active listings', sub: '',            Icon: Briefcase,    iconBg: '#2563eb' },
    { title: 'Applications Today', value: s.applicationsTotal || 0, trend: `${s.successCount || 0} successful`, sub: '', Icon: ClipboardList, iconBg: '#059669' },
    { title: 'Success Rate',       value: `${s.successRate  || 0}%`, trend: 'vs last week', sub: '',            Icon: TrendingUp,   iconBg: '#d97706' },
    { title: 'AI Match Score Avg', value: `${s.avgMatchScore || 0}%`, trend: 'ATS optimised', sub: '',         Icon: Brain,        iconBg: '#7c3aed' },
    { title: 'Interviews',         value: s.interviews      || 0,  trend: '+2 this week', sub: '',              Icon: Users,        iconBg: '#059669' },
  ];

  const activityIcon = (status) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (status === 'error')   return <XCircle     className="w-4 h-4 text-red-500    shrink-0" />;
    if (status === 'warning') return <AlertCircle className="w-4 h-4 text-amber-500  shrink-0" />;
    return                           <Activity    className="w-4 h-4 text-blue-500   shrink-0" />;
  };

  return (
    <div className="space-y-6 fade-in">

      {}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAT_CARDS.map(c => <StatCard key={c.title} {...c} />)}
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Applications Overview</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Performance over time</p>
            </div>
            <div className="flex items-center gap-2">
              {['7d', '14d', '30d'].map(f => (
                <button key={f}
                  onClick={() => setFilter(f)}
                  className="text-xs px-3 py-1 rounded-lg font-medium transition"
                  style={filter === f
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: '#f1f5f9', color: 'var(--text-secondary)' }}>
                  {f === '7d' ? 'Last 7 Days' : f === '14d' ? 'Last 14 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filter === '7d' ? cd.slice(-7) : filter === '30d' ? cd : cd}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3fa" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Applications" stroke="#4f46e5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Submitted"    stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Interviews"   stroke="#a78bfa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Offers"       stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Applications by Status</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Current breakdown</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData.length ? donutData : [{ name: 'No data', value: 1 }]}
                    cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                    dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2}>
                    {(donutData.length ? donutData : [{ name: 'No data', value: 1 }]).map((_, i) => (
                      <Cell key={i} fill={donutData.length ? DONUT_COLORS[i % DONUT_COLORS.length] : '#e2e8f0'} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{donutTotal}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total</span>
              </div>
            </div>
            {}
            <div className="flex-1 space-y-2">
              {donutData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                    <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>
                      ({donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
              {donutData.length === 0 && (
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>No application data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Top Job Platforms</h3>
          <button onClick={() => setActiveTab('integrations')}
            className="text-xs font-semibold flex items-center gap-1 hover:underline"
            style={{ color: 'var(--accent)' }}>
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {platforms.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
            No application data yet. Submit applications to see platform stats.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Platform', 'Applications', 'Success Rate'].map(h => (
                    <th key={h} className="text-left pb-3 pr-6 font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
                {platforms.map(p => (
                  <tr key={p.name} className="hover:bg-gray-50 transition">
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2.5">
                        <PlatformBadge name={p.name} size={22} />
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-6 font-semibold" style={{ color: 'var(--text-primary)' }}>{p.applications.toLocaleString()}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.successRate}%`, background: '#22c55e' }} />
                        </div>
                        <span className="font-bold text-emerald-600">{p.successRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Applications</h3>
            <button onClick={() => setActiveTab('applications')}
              className="text-xs font-semibold flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}>
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentApps.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No applications yet. Start automation to see data here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['Job Title', 'Company', 'Platform', 'Status', 'Date', 'Match'].map(h => (
                      <th key={h} className="text-left pb-3 pr-4 font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentApps.map(app => (
                    <tr key={app.id} className="border-b hover:bg-gray-50 transition" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="py-3 pr-4">
                        <span className="font-semibold truncate max-w-[120px] block" style={{ color: 'var(--text-primary)' }}>
                          {app.jobTitle}
                        </span>
                      </td>
                      <td className="py-3 pr-4" style={{ color: 'var(--text-secondary)' }}>{app.company}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <PlatformBadge name={app.platform} size={18} />
                          <span style={{ color: 'var(--text-secondary)' }}>{app.platform}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={app.status} /></td>
                      <td className="py-3 pr-4" style={{ color: 'var(--text-muted)' }}>
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3">
                        <span className="font-bold" style={{ color: app.matchScore >= 75 ? '#059669' : app.matchScore >= 50 ? '#d97706' : '#64748b' }}>
                          {app.matchScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {}
        <div className="lg:col-span-2 space-y-5">

          {}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Activity Feed</h3>
              <button onClick={() => setActiveTab('logs')}
                className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                View All
              </button>
            </div>
            {activityFeed.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No recent activity.</p>
            ) : (
              <div className="space-y-3 max-h-52 overflow-y-auto">
                {activityFeed.slice(0, 8).map((item, i) => (
                  <div key={item.id || i} className="flex items-start gap-2.5">
                    {activityIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.message}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {item.action} · {item.time ? new Date(item.time).toLocaleTimeString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Automation Status</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: automation.activeTasks > 0 ? '#dcfce7' : '#f1f5f9',
                          color:      automation.activeTasks > 0 ? '#15803d' : '#64748b' }}>
                {automation.activeTasks > 0 ? 'Running' : 'Idle'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Active Tasks',      value: automation.activeTasks  || 0 },
                { label: 'Success Rate',      value: `${automation.successRate || 0}%` },
                { label: 'Avg Response Time', value: `${((automation.avgResponseMs || 2400) / 1000).toFixed(1)}s` },
                { label: 'Next Run',          value: automation.nextRunLabel || 'Idle' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setActiveTab('automation')}
              className="w-full py-2 rounded-lg text-xs font-bold text-white transition"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
              View All Tasks
            </button>

                      {}
            <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>System Usage</span>
                {health && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Up {health.uptimeHuman}
                  </span>
                )}
              </div>
              {[
                { label: 'Memory Used',  Icon: MemoryStick, value: health ? Math.round((health.memory.usedMB / health.memory.totalMB) * 100) : automation.memoryUsage || 62,  color: '#f59e0b', detail: health ? `${health.memory.usedMB}/${health.memory.totalMB} MB` : '' },
                { label: 'CPU / Process',Icon: Cpu,         value: automation.cpuUsage || 45, color: '#4f46e5', detail: '' },
                { label: 'DB Latency',   Icon: HardDrive,   value: health ? Math.min(100, (health.database?.latencyMs || 0) * 2) : 38, color: '#22c55e',
                  detail: health ? `${health.database?.latencyMs}ms · ${health.database?.driver}` : '' },
              ].map(({ label, Icon, value, color, detail }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <Icon className="w-3 h-3" style={{ color }} /> {label}
                    </span>
                    <span className="font-bold text-right" style={{ color: 'var(--text-primary)' }}>
                      {detail || `${value}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: '#f1f5f9' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
                  </div>
                </div>
              ))}
              {health && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${health.database?.status === 'healthy' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>DB</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${health.ai === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>AI {health.ai === 'connected' ? '✓' : '— no key'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${health.playwright === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Playwright {health.playwright}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
