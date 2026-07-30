import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  LayoutDashboard, FileText, Briefcase, ClipboardList,
  Settings, Zap, BarChart2, BookOpen, Link2, Bot,
  Upload, Plus, Play, Bell, Search, ChevronDown,
  User, LogOut, X, Menu, CheckCircle, AlertCircle,
  Briefcase as BriefcaseIcon, FileText as FileTextIcon,
  Clock, XCircle, ArrowRight, Cpu
} from 'lucide-react';

import Dashboard    from './components/Dashboard';
import ResumeVault  from './components/ResumeVault';
import JobBoard     from './components/JobBoard';
import AutomationRoom from './components/AutomationRoom';
import AuditLogs    from './components/AuditLogs';
import SettingsView from './components/Settings';
import Reports      from './components/Reports';
import Integrations from './components/Integrations';
import AITools      from './components/AITools';
import Applications from './components/Applications';
import AuthPage     from './components/AuthPage';

const socket = io(window.location.origin);

const NAV_MAIN = [
  { id: 'dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { id: 'resumes',      label: 'Profiles',      Icon: User },
  { id: 'jobs',         label: 'Jobs',          Icon: Briefcase },
  { id: 'applications', label: 'Applications',  Icon: ClipboardList },
  { id: 'automation',   label: 'Queue',         Icon: Zap },
  { id: 'ai-tools',     label: 'AI Tools',      Icon: Bot },
  { id: 'reports',      label: 'Reports',       Icon: BarChart2 },
  { id: 'logs',         label: 'Logs',          Icon: BookOpen },
  { id: 'integrations', label: 'Integrations',  Icon: Link2 },
  { id: 'settings',     label: 'Settings',      Icon: Settings },
];

const PAGE_TITLES = {
  dashboard:    { title: 'Dashboard',           sub: 'Overview of your automation performance and activities' },
  resumes:      { title: 'Candidate Profiles',  sub: 'Manage multi-candidate profiles for autonomous job applications' },
  jobs:         { title: 'Job Board',           sub: 'Browse and import job listings — ATS auto-detected from URL' },
  applications: { title: 'Applications',        sub: 'Track the status of all submitted applications' },
  automation:   { title: 'Queue Builder',       sub: 'Select candidates × jobs and launch fully autonomous automation' },
  'ai-tools':   { title: 'AI Tools',            sub: 'AI-powered tools to optimise your job search' },
  reports:      { title: 'Reports',             sub: 'Analytics, success rates, and performance insights' },
  logs:         { title: 'Logs',                sub: 'Full activity and audit trail for all automation runs' },
  integrations: { title: 'Integrations',        sub: 'Connect and manage your job platform accounts' },
  settings:     { title: 'Settings',            sub: 'Configure AI keys, browser settings and platform credentials' },
};

function NotifIcon({ type }) {
  const props = { style: { width: 14, height: 14 }, className: 'shrink-0 mt-0.5' };
  if (type === 'resume')     return <FileTextIcon {...props} style={{ ...props.style, color: '#4f46e5' }} />;
  if (type === 'job')        return <BriefcaseIcon {...props} style={{ ...props.style, color: '#2563eb' }} />;
  if (type === 'automation') return <Zap {...props} style={{ ...props.style, color: '#f59e0b' }} />;
  if (type === 'ai')         return <Bot {...props} style={{ ...props.style, color: '#7c3aed' }} />;
  if (type === 'system')     return <Cpu {...props} style={{ ...props.style, color: '#64748b' }} />;
  return <CheckCircle {...props} style={{ ...props.style, color: '#22c55e' }} />;
}

function SearchResultIcon({ type }) {
  if (type === 'resume') return <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#4f46e5' }} />;
  if (type === 'job')    return <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: '#2563eb' }} />;
  return                        <ClipboardList className="w-3.5 h-3.5 shrink-0" style={{ color: '#22c55e' }} />;
}

export default function App() {
  
  const [authUser, setAuthUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token') || null);

  const handleAuth = (user, token) => {
    setAuthUser(user);
    setAuthToken(token);
  };

  if (!authUser || !authToken) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return <AppShell authUser={authUser} authToken={authToken} onLogout={() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAuthUser(null);
    setAuthToken(null);
  }} />;
}

function AppShell({ authUser, authToken, onLogout }) {
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [systemLogs, setSystemLogs]     = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(true);

  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [notifOpen, setNotifOpen]           = useState(false);
  const notifRef = useRef(null);

  const [user] = useState({ name: authUser.name, role: 'Administrator', email: authUser.email });

  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  const [runningCount, setRunningCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    socket.on('connect',    () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('automation_log', log => setSystemLogs(p => [log, ...p].slice(0, 100)));
    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('automation_log'); };
  }, []);

  const fetchUser = useCallback(async () => {
    
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {  }
  }, []);

  useEffect(() => {
    fetchUser();
    fetchNotifications();
    const t = setInterval(fetchNotifications, 15000);
    return () => clearInterval(t);
  }, [fetchUser, fetchNotifications]);

  useEffect(() => {
    fetch('/api/applications').then(r => r.json()).then(apps => {
      setRunningCount(apps.filter(a => a.status === 'running').length);
    }).catch(() => {});
    const t = setInterval(() => {
      fetch('/api/applications').then(r => r.json()).then(apps => {
        setRunningCount(apps.filter(a => a.status === 'running').length);
      }).catch(() => {});
    }, 12000);
    return () => clearInterval(t);
  }, [activeTab]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setNotifications(p => p.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {  }
  };

  const deleteNotif = async (id) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(p => p.filter(n => n.id !== id));
    } catch (e) {  }
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q || q.length < 2) { setSearchResults(null); return; }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data);
      } catch (e) { setSearchResults(null); }
      finally { setSearchLoading(false); }
    }, 350);
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false); setUserMenuOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const page = PAGE_TITLES[activeTab] || PAGE_TITLES.dashboard;

  const NavItem = ({ id, label, Icon }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
        style={{
          background:  active ? 'var(--sidebar-active-bg)' : 'transparent',
          color:       active ? '#fff' : 'var(--sidebar-text)',
          borderLeft:  active ? '3px solid var(--sidebar-active)' : '3px solid transparent',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
        {id === 'automation' && runningCount > 0 && (
          <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 live-dot" />
        )}
      </button>
    );
  };

  const totalResults = searchResults
    ? (searchResults.resumes?.length + searchResults.jobs?.length + searchResults.applications?.length) : 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-app)' }}>

      {}
      <aside
        className="sidebar-scroll flex flex-col shrink-0"
        style={{
          width: sidebarOpen ? 240 : 0,
          minWidth: sidebarOpen ? 240 : 0,
          background: 'var(--sidebar-bg)',
          transition: 'width 0.22s ease, min-width 0.22s ease',
          overflow: sidebarOpen ? 'hidden auto' : 'hidden',
        }}
      >
        {}
        <div className="px-5 py-5 flex items-center gap-3 shrink-0 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--sidebar-active)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">AI Auto</div>
            <div className="text-white font-bold text-base tracking-tight leading-none">
              Job Bid <span style={{ color: '#818cf8' }}>Bot</span>
            </div>
          </div>
        </div>

        {}
        <nav className="px-3 pt-4 pb-2 flex-1 space-y-0.5">
          {NAV_MAIN.map(item => <NavItem key={item.id} {...item} />)}
        </nav>

        {}
        <div className="px-4 pb-3 pt-1 border-t border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 mt-3"
            style={{ color: 'var(--sidebar-text-muted)' }}>Quick Actions</p>
          <div className="space-y-2">
            <button onClick={() => setActiveTab('resumes')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border border-white/15 text-white/75 hover:text-white hover:bg-white/10">
              <Upload className="w-3.5 h-3.5" /> Upload Resume
            </button>
            <button onClick={() => setActiveTab('jobs')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border border-white/15 text-white/75 hover:text-white hover:bg-white/10">
              <Plus className="w-3.5 h-3.5" /> Add Job URL
            </button>
            <button onClick={() => setActiveTab('automation')}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition text-white"
              style={{ background: 'var(--sidebar-active)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--sidebar-active)'}>
              <Play className="w-3.5 h-3.5 fill-white" /> Start Automation
            </button>
          </div>
        </div>

        {}
        <div className="mx-3 mb-4 p-3 rounded-xl border border-white/10" style={{ background: 'rgba(79,70,229,0.22)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white text-xs font-bold">Pro Plan</span>
            <button className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: 'var(--sidebar-active)' }}>Upgrade</button>
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--sidebar-text-muted)' }}>
            Unlimited applications.<br />Unlimited opportunities.
          </p>
        </div>
      </aside>

      {}
      <main className="flex-1 flex flex-col overflow-hidden">

        {}
        <header className="h-16 shrink-0 flex items-center px-6 gap-4 border-b"
          style={{ background: '#fff', borderColor: 'var(--border)' }}>

          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(p => !p)}
              className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0">
              <Menu className="w-4 h-4 text-gray-500" />
            </button>
            <div className="hidden md:block min-w-0">
              <h1 className="font-bold text-base leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                {page.title}
              </h1>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{page.sub}</p>
            </div>
          </div>

          {}
          <div className="flex-1 max-w-md mx-auto">
            <button onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition"
              style={{ background: '#f8fafc', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <Search className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-xs">Search jobs, resumes, applications...</span>
              <kbd className="text-[10px] font-medium bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">⌘ K</kbd>
            </button>
          </div>

          {}
          <div className="flex items-center gap-2 shrink-0">

            {}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setNotifOpen(p => !p); if (!notifOpen && unreadCount > 0) markAllRead(); }}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition">
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                    style={{ background: '#ef4444' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 card shadow-2xl z-50 overflow-hidden">
                  {}
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                    <span className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                      Notifications {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[9px]" style={{ background: '#ef4444' }}>{unreadCount}</span>}
                    </span>
                    <button onClick={markAllRead} className="text-[10px] font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                      Mark all read
                    </button>
                  </div>

                  {}
                  <div className="max-h-72 overflow-y-auto divide-y" style={{ '--tw-divide-opacity': 1 }}>
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        No notifications yet
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
                        style={{ background: n.is_read ? 'transparent' : '#fafbff' }}
                        onClick={() => { if (n.action_url) setActiveTab(n.action_url); setNotifOpen(false); }}>
                        <NotifIcon type={n.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                          </p>
                        </div>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />}
                        <button onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                          className="text-gray-300 hover:text-red-400 transition shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2 border-t text-center" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => { setActiveTab('logs'); setNotifOpen(false); }}
                      className="text-[10px] font-semibold flex items-center gap-1 mx-auto hover:underline"
                      style={{ color: 'var(--accent)' }}>
                      View Activity Log <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="relative">
              <button onClick={() => setUserMenuOpen(p => !p)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'var(--accent)' }}>
                  {user.name ? user.name[0].toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {user.name || 'User'}
                  </div>
                  <div className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {user.role || 'Administrator'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 card shadow-lg z-50 py-1">
                  <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email || 'No email set'}</p>
                  </div>
                  <button onClick={() => { setActiveTab('settings'); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-gray-50 transition"
                    style={{ color: 'var(--text-secondary)' }}>
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </button>
                  <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                  <button 
                    onClick={() => { setUserMenuOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>

            {}
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-medium px-2"
              style={{ color: socketConnected ? '#22c55e' : '#ef4444' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 live-dot' : 'bg-red-500'}`} />
              {socketConnected ? 'Live' : 'Offline'}
            </div>
          </div>
        </header>

        {}
        <div className="flex-1 overflow-y-auto p-6 fade-in" style={{ background: 'var(--bg-app)' }}>
          {activeTab === 'dashboard'    && <Dashboard systemLogs={systemLogs} setActiveTab={setActiveTab} />}
          {activeTab === 'resumes'      && <ResumeVault onAction={fetchNotifications} />}
          {activeTab === 'jobs'         && <JobBoard setActiveTab={setActiveTab} onAction={fetchNotifications} />}
          {activeTab === 'applications' && <Applications setActiveTab={setActiveTab} />}
          {activeTab === 'automation'   && <AutomationRoom socket={socket} onAction={fetchNotifications} />}
          {activeTab === 'ai-tools'     && <AITools setActiveTab={setActiveTab} />}
          {activeTab === 'reports'      && <Reports />}
          {activeTab === 'logs'         && <AuditLogs />}
          {activeTab === 'integrations' && <Integrations />}
          {activeTab === 'settings'     && <SettingsView user={user} onUserSave={fetchUser} />}
        </div>
      </main>

      {}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4"
          onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }}>
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            ref={searchRef}
            onClick={e => e.stopPropagation()}>
            {}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input autoFocus type="text" value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search resumes, jobs, applications..."
                className="flex-1 text-sm outline-none" style={{ color: 'var(--text-primary)' }} />
              {searchLoading && <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />}
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }}
                className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {}
            <div className="max-h-96 overflow-y-auto">
              {!searchResults && !searchLoading && (
                <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  Type at least 2 characters to search...
                </div>
              )}
              {searchResults && totalResults === 0 && (
                <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No results found for "<strong>{searchQuery}</strong>"
                </div>
              )}
              {searchResults && (
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
                  {}
                  {searchResults.resumes?.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', background: '#f8fafc' }}>
                        Resumes ({searchResults.resumes.length})
                      </div>
                      {searchResults.resumes.map(r => (
                        <button key={r.id} onClick={() => { setActiveTab('resumes'); setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left">
                          <SearchResultIcon type="resume" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.candidate_name} · {r.years_of_experience}y exp</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'active' ? 'badge-success' : 'badge-pending'}`}>{r.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {}
                  {searchResults.jobs?.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', background: '#f8fafc' }}>
                        Jobs ({searchResults.jobs.length})
                      </div>
                      {searchResults.jobs.map(j => (
                        <button key={j.id} onClick={() => { setActiveTab('jobs'); setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left">
                          <SearchResultIcon type="job" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{j.title}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{j.company} · {j.location}</p>
                          </div>
                          {j.match_score > 0 && (
                            <span className="text-xs font-bold shrink-0" style={{ color: j.match_score >= 75 ? '#059669' : '#d97706' }}>{j.match_score}%</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {}
                  {searchResults.applications?.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', background: '#f8fafc' }}>
                        Applications ({searchResults.applications.length})
                      </div>
                      {searchResults.applications.map(a => (
                        <button key={a.id} onClick={() => { setActiveTab('applications'); setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left">
                          <SearchResultIcon type="application" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.job_title}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{a.company} · {a.candidate_name}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full badge-${a.status}`}>{a.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {}
            <div className="px-4 py-2 border-t flex items-center gap-4 text-[10px]" style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text-muted)' }}>
              <span><kbd className="bg-gray-200 px-1 rounded text-[9px]">↵</kbd> Select</span>
              <span><kbd className="bg-gray-200 px-1 rounded text-[9px]">Esc</kbd> Close</span>
              {totalResults > 0 && <span className="ml-auto">{totalResults} result{totalResults !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
      )}

      {}
      {(userMenuOpen || notifOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setUserMenuOpen(false); setNotifOpen(false); }} />
      )}
    </div>
  );
}
