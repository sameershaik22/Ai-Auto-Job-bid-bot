import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Square, Cpu, User, Briefcase, CheckCircle2,
  Clock, AlertCircle, ChevronRight, Terminal, Sparkles,
  RotateCcw, Search, X, Layers, Zap, RefreshCw
} from 'lucide-react';

const ATS_COLORS = {
  lever: '#00b4d8',
  greenhouse: '#22c55e',
  ashby: '#f59e0b',
  smartrecruiters: '#3b82f6',
  workday: '#8b5cf6',
  generic: '#6b7280',
  mock_portal: '#ec4899',
};

const STATUS_STYLE = {
  queued:  { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Queued' },
  running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Running' },
  done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'Done' },
  failed:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Failed' },
  skipped: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Skipped' },
};

export default function AutomationRoom({ socket }) {
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [selectedJobs, setSelectedJobs] = useState(new Set());
  const [search, setSearch] = useState({ candidates: '', jobs: '' });

  const [isRunning, setIsRunning] = useState(false);
  const [queueRunId, setQueueRunId] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [queueProgress, setQueueProgress] = useState(null);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [activeItemId, setActiveItemId] = useState(null);
  const terminalRef = useRef(null);

  const loadData = async () => {
    try {
      const [cRes, jRes] = await Promise.all([
        fetch('/api/candidates'),
        fetch('/api/jobs')
      ]);
      const [cData, jData] = await Promise.all([cRes.json(), jRes.json()]);
      setCandidates(Array.isArray(cData) ? cData : []);
      setJobs(Array.isArray(jData) ? jData : []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  useEffect(() => {
    if (!socket) return;

    const handleQueueProgress = (data) => {
      setQueueProgress(data);
      if (data.status === 'done' || data.status === 'stopped') {
        setIsRunning(false);
      }
    };

    const handleQueueItemUpdate = (data) => {
      setActiveItemId(data.itemId);
      setQueueItems(prev => prev.map(item =>
        item.id === data.itemId ? { ...item, status: data.status } : item
      ));
    };

    const handleQueueItemLog = (data) => {
      setConsoleLogs(prev => [...prev, { id: Date.now(), message: data.message, time: new Date().toLocaleTimeString() }]);
    };

    const handleAutomationLog = (log) => {
      setConsoleLogs(prev => [...prev, {
        id: Date.now(), message: log.message, status: log.status,
        time: new Date().toLocaleTimeString()
      }]);
    };

    socket.on('queue_progress', handleQueueProgress);
    socket.on('queue_item_update', handleQueueItemUpdate);
    socket.on('queue_item_log', handleQueueItemLog);
    socket.on('automation_log', handleAutomationLog);

    return () => {
      socket.off('queue_progress', handleQueueProgress);
      socket.off('queue_item_update', handleQueueItemUpdate);
      socket.off('queue_item_log', handleQueueItemLog);
      socket.off('automation_log', handleAutomationLog);
    };
  }, [socket]);

  const toggleCandidate = (id) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleJob = (id) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalQueue = selectedCandidates.size * selectedJobs.size;

  const handleLaunch = async () => {
    if (totalQueue === 0) {
      alert('Select at least one candidate and one job first.');
      return;
    }
    if (!window.confirm(`Launch ${totalQueue} application(s) automatically?\n\nThis will apply to ${selectedJobs.size} job(s) on behalf of ${selectedCandidates.size} candidate(s). The bot will run fully autonomously.`)) return;

    setIsRunning(true);
    setConsoleLogs([]);
    setQueueItems([]);
    setQueueProgress(null);

    try {
      const res = await fetch('/api/queue/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: [...selectedCandidates],
          job_ids: [...selectedJobs]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start queue');

      setQueueRunId(data.queue_run_id);

      const statusRes = await fetch('/api/queue/status');
      const statusData = await statusRes.json();
      if (statusData.items) setQueueItems(statusData.items);

    } catch (err) {
      alert(`Failed to launch: ${err.message}`);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    await fetch('/api/queue/stop', { method: 'POST' });
    setIsRunning(false);
  };

  const filteredCandidates = candidates.filter(c =>
    !search.candidates ||
    c.candidate_name?.toLowerCase().includes(search.candidates.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.candidates.toLowerCase())
  );

  const filteredJobs = jobs.filter(j =>
    !search.jobs ||
    j.title?.toLowerCase().includes(search.jobs.toLowerCase()) ||
    j.company?.toLowerCase().includes(search.jobs.toLowerCase())
  );

  const getLogColor = (status) => {
    if (status === 'success') return '#22c55e';
    if (status === 'error') return '#ef4444';
    if (status === 'warning') return '#f59e0b';
    return '#94a3b8';
  };

  return (
    <div style={{ display: 'flex', gap: 20, padding: '24px', height: 'calc(100vh - 80px)', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: 'var(--accent)' }} /> Queue Builder
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Select candidates × jobs → Launch autonomous automation
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {totalQueue > 0 && (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', padding: '6px 14px', background: 'rgba(99,102,241,0.1)', borderRadius: 20 }}>
                  {totalQueue} application{totalQueue !== 1 ? 's' : ''} queued
                </div>
              )}
              {isRunning ? (
                <button onClick={handleStop} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  <Square size={14} /> Stop Queue
                </button>
              ) : (
                <button onClick={handleLaunch} disabled={totalQueue === 0} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                  background: totalQueue === 0 ? 'var(--border)' : 'linear-gradient(135deg, var(--accent), #7c3aed)',
                  border: 'none', borderRadius: 8, color: totalQueue === 0 ? 'var(--text-muted)' : '#fff',
                  fontWeight: 700, fontSize: 13, cursor: totalQueue === 0 ? 'default' : 'pointer',
                  boxShadow: totalQueue > 0 ? '0 4px 20px rgba(99,102,241,0.4)' : 'none'
                }}>
                  <Zap size={14} /> Launch {totalQueue > 0 ? `${totalQueue} Application${totalQueue !== 1 ? 's' : ''}` : 'Queue'}
                </button>
              )}
            </div>
          </div>

          {isRunning && queueProgress && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Progress: {queueProgress.completed}/{queueProgress.total}</span>
                <span>{queueProgress.failed > 0 ? `${queueProgress.failed} failed` : 'All good'}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'linear-gradient(90deg, var(--accent), #22c55e)',
                  width: `${queueProgress.total > 0 ? (queueProgress.completed / queueProgress.total) * 100 : 0}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14} style={{ color: 'var(--accent)' }} /> Candidates
                  {selectedCandidates.size > 0 && <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 20 }}>{selectedCandidates.size}</span>}
                </div>
                {selectedCandidates.size > 0 && (
                  <button onClick={() => setSelectedCandidates(new Set())} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  placeholder="Search candidates..."
                  value={search.candidates}
                  onChange={e => setSearch(p => ({ ...p, candidates: e.target.value }))}
                  style={{ width: '100%', padding: '7px 12px 7px 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {filteredCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                  No candidates. Add profiles first.
                </div>
              ) : filteredCandidates.map(c => {
                const selected = selectedCandidates.has(c.id);
                return (
                  <div key={c.id} onClick={() => toggleCandidate(c.id)} style={{
                    display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: selected ? 'rgba(99,102,241,0.1)' : 'transparent',
                    border: `1px solid ${selected ? 'var(--accent)' : 'transparent'}`, marginBottom: 4, transition: 'all 0.15s'
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {selected && <CheckCircle2 size={11} color="#fff" />}
                    </div>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0
                    }}>
                      {c.candidate_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.candidate_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email || `${c.years_of_experience || 0}y experience`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Briefcase size={14} style={{ color: 'var(--accent)' }} /> Jobs
                  {selectedJobs.size > 0 && <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 20 }}>{selectedJobs.size}</span>}
                </div>
                {selectedJobs.size > 0 && (
                  <button onClick={() => setSelectedJobs(new Set())} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  placeholder="Search jobs..."
                  value={search.jobs}
                  onChange={e => setSearch(p => ({ ...p, jobs: e.target.value }))}
                  style={{ width: '100%', padding: '7px 12px 7px 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {filteredJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                  No jobs. Import jobs from the Job Board first.
                </div>
              ) : filteredJobs.map(j => {
                const selected = selectedJobs.has(j.id);
                const ats = j.ats_platform || 'generic';
                const atsColor = ATS_COLORS[ats] || '#6b7280';
                return (
                  <div key={j.id} onClick={() => toggleJob(j.id)} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: selected ? 'rgba(99,102,241,0.1)' : 'transparent',
                    border: `1px solid ${selected ? 'var(--accent)' : 'transparent'}`, marginBottom: 4, transition: 'all 0.15s'
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1
                    }}>
                      {selected && <CheckCircle2 size={11} color="#fff" />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.title}</div>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: `${atsColor}20`, color: atsColor, fontWeight: 700, flexShrink: 0 }}>
                          {ats.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.company}{j.location ? ` · ${j.location}` : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
        {queueItems.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={13} style={{ color: 'var(--accent)' }} /> Queue Status
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {queueItems.map((item, i) => {
                const s = STATUS_STYLE[item.status] || STATUS_STYLE.queued;
                const isActive = item.id === activeItemId;
                return (
                  <div key={item.id} style={{
                    display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px',
                    borderBottom: i < queueItems.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isActive ? 'rgba(59,130,246,0.05)' : 'transparent'
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.candidate_name} → {item.job_title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.company}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 700, flexShrink: 0 }}>
                      {isActive && item.status === 'running' ? '● ' : ''}{s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ background: '#0f172a', border: '1px solid var(--border)', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 280, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={13} style={{ color: '#22c55e' }} /> Live Logs
            </div>
            {consoleLogs.length > 0 && (
              <button onClick={() => setConsoleLogs([])} style={{ fontSize: 11, color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            )}
          </div>
          <div ref={terminalRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', fontFamily: 'monospace' }}>
            {consoleLogs.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 11, paddingTop: 8 }}>
                Waiting for automation to start...<span style={{ animation: 'blink 1s infinite' }}>█</span>
              </div>
            ) : consoleLogs.map(log => (
              <div key={log.id} style={{ fontSize: 11, color: getLogColor(log.status), lineHeight: 1.7, wordBreak: 'break-all' }}>
                <span style={{ color: '#475569', marginRight: 8 }}>{log.time}</span>{log.message}
              </div>
            ))}
          </div>
        </div>

        {!isRunning && totalQueue > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} style={{ color: 'var(--accent)' }} /> Queue Summary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)' }}>
              <div>Candidates: <strong style={{ color: 'var(--text-primary)' }}>{selectedCandidates.size}</strong></div>
              <div>Jobs: <strong style={{ color: 'var(--text-primary)' }}>{selectedJobs.size}</strong></div>
              <div>Total applications: <strong style={{ color: 'var(--accent)' }}>{totalQueue}</strong></div>
              <div style={{ marginTop: 4, padding: '8px 10px', background: 'rgba(34,197,94,0.08)', borderRadius: 6, color: '#22c55e', lineHeight: 1.5 }}>
                AI will tailor each resume, fill forms, and submit — fully automatic.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
