import React, { useState, useEffect } from 'react';
import { Search, Clock, Shield, Filter, FileText, Briefcase, Zap, Bot, Database, Activity, RefreshCw } from 'lucide-react';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 };
const muted = { color: 'var(--text-muted)' };

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/activity?limit=200')
      .then(r => r.json())
      .then(data => {
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase();
    const matchSearch = (log.action || '').toLowerCase().includes(q) || 
                        (log.resume_name || '').toLowerCase().includes(q) ||
                        (log.job_title || '').toLowerCase().includes(q);
    const matchType = filterType === 'all' || log.entity_type === filterType;
    return matchSearch && matchType;
  });

  const getEntityIcon = (type) => {
    if (type === 'resume') return <FileText className="w-4 h-4 text-indigo-500" />;
    if (type === 'job') return <Briefcase className="w-4 h-4 text-blue-500" />;
    if (type === 'application' || type === 'automation') return <Zap className="w-4 h-4 text-amber-500" />;
    if (type === 'ai') return <Bot className="w-4 h-4 text-purple-500" />;
    return <Database className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-8 fade-in">
      {}
      <div className="border-b pb-5 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>System Audit Logs</h2>
          <p className="text-sm mt-0.5" style={muted}>
            Comprehensive activity feed across all entities, automations, and system events.
          </p>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Feed
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-5 rounded-xl shadow-sm space-y-5" style={card}>
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Filters</h4>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider block" style={muted}>Search Action / Target</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5" style={muted} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="e.g. uploaded, designer..."
                  className="w-full rounded-lg py-2 pl-9 pr-4 text-xs outline-none transition border"
                  style={{ background: '#f8fafc', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider block" style={muted}>Entity Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="w-full rounded-lg p-2.5 text-xs outline-none transition border cursor-pointer"
                style={{ background: '#f8fafc', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="all">All Entities</option>
                <option value="resume">Resumes</option>
                <option value="job">Jobs</option>
                <option value="application">Applications & Automation</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl shadow-sm text-center" style={{ background: '#f8fafc', border: '1px solid var(--border)' }}>
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: 'var(--accent)' }} />
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{filteredLogs.length}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={muted}>Events Displayed</div>
          </div>
        </div>

        {}
        <div className="lg:col-span-3">
          <div className="rounded-xl overflow-hidden shadow-sm flex flex-col" style={{ ...card, height: 'calc(100vh - 180px)' }}>
            <div className="p-4 border-b flex items-center justify-between bg-gray-50/50" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Activity Stream
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading && logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-xs" style={muted}>Loading audit trail...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                  <Activity className="w-10 h-10 opacity-20" style={muted} />
                  <p className="text-sm font-semibold" style={muted}>No activity logs match your filters.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLogs.map((log) => {
                    let metaStr = null;
                    if (log.details) {
                      try {
                        const parsed = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                        if (Object.keys(parsed).length > 0) {
                          metaStr = JSON.stringify(parsed, null, 2);
                        }
                      } catch (e) {  }
                    }

                    return (
                      <div key={log.id} className="flex gap-4 fade-in">
                        <div className="flex flex-col items-center mt-1">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border"
                            style={{ background: 'white', borderColor: 'var(--border)' }}>
                            {getEntityIcon(log.entity_type)}
                          </div>
                          <div className="w-px h-full mt-2" style={{ background: 'var(--border)' }} />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </p>
                              {log.entity_id && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded mr-1.5" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                                    {log.entity_type} #{log.entity_id}
                                  </span>
                                  {log.resume_name && <span className="font-semibold">{log.resume_name}</span>}
                                  {log.job_title && <span className="font-semibold">{log.job_title}</span>}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px]" style={muted}>
                              <Clock className="w-3 h-3" />
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </div>
                          
                          {metaStr && (
                            <div className="mt-3 bg-gray-900 rounded-lg p-3 overflow-x-auto">
                              <pre className="text-[10px] text-gray-300 font-mono leading-relaxed m-0">
                                {metaStr}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
