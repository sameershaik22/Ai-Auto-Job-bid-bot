import React, { useState, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Award, Target, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card shadow-lg p-3 text-xs">
      <p className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span className="font-bold">{p.value}{p.name.includes('Rate') ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
};

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>;

  const s  = data?.summary || {};
  const cd = data?.applicationsByDay || [];
  const platforms      = data?.platforms || [];
  const activityTypes  = data?.activityTypes || {};

  const platformBarData = platforms.map(p => ({
    name: p.name.length > 8 ? p.name.slice(0, 8) + '…' : p.name,
    Applications: p.applications,
    'Success Rate': p.successRate,
  }));

  const kpis = [
    { label: 'Total Applications', value: s.totalApplications || 0, sub: 'All time', Icon: BarChart2, color: '#4f46e5' },
    { label: 'Avg Match Score',    value: `${s.avgMatchScore   || 0}%`, sub: 'Per application', Icon: Target,  color: '#7c3aed' },
    { label: 'Avg ATS Score',      value: `${s.avgAtsScore     || 0}%`, sub: 'Est. ATS compatibility', Icon: Award, color: '#059669' },
    { label: 'Est. Interviews',    value: s.interviews || 0, sub: `${s.successRate || 0}% success rate`, Icon: TrendingUp, color: '#d97706' },
  ];

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports & Analytics</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Performance insights across your entire job search</p>
      </div>

      {}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color: 'var(--text-primary)' }}>Applications Over Time</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cd} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3fa" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Applications" stroke="#4f46e5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Submitted"    stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-5" style={{ color: 'var(--text-primary)' }}>Platform Performance</h3>
          {platformBarData.length === 0 ? (
            <div className="h-56 flex items-center justify-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Submit applications to see platform stats</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformBarData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3fa" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Applications" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Success Rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {}
      <div className="card p-5">
        <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Platform Breakdown</h3>
        {platforms.length === 0 ? (
          <div className="py-8 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No platform data yet. Submit applications to see analytics.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Platform', 'Applications', 'Success Rate', 'Performance'].map(h => (
                    <th key={h} className="text-left pb-3 pr-6 font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platforms.map((p, i) => (
                  <tr key={p.name} className="border-b hover:bg-gray-50 transition" style={{ borderColor: 'var(--border-soft)' }}>
                    <td className="py-3 pr-6 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                    <td className="py-3 pr-6 font-semibold" style={{ color: 'var(--text-primary)' }}>{p.applications}</td>
                    <td className="py-3 pr-6 font-bold text-emerald-600">{p.successRate}%</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 rounded-full" style={{ background: '#f1f5f9' }}>
                          <div className="h-full rounded-full" style={{ width: `${p.successRate}%`, background: '#4f46e5' }} />
                        </div>
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
      {Object.keys(activityTypes).length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Activity Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(activityTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([action, count]) => (
                <div key={action} className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
                  <div className="text-xl font-extrabold mb-1" style={{ color: 'var(--accent)' }}>{count}</div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
