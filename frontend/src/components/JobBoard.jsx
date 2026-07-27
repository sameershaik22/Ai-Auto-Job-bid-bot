import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  PlusCircle,
  X,
  Globe,
  Search,
  Filter,
  ArrowRight,
  Edit2,
  RefreshCw,
  TrendingUp,
  MapPin,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Check,
  Info
} from 'lucide-react';

export default function JobBoard({ setActiveTab }) {
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState('all'); 
  const [search, setSearch] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [openMatchDrawer, setOpenMatchDrawer] = useState(null); 
  const [verifyImportData, setVerifyImportData] = useState(null); 
  const [editJob, setEditJob] = useState(null);

  const [importUrl, setImportUrl] = useState('');
  const [importStep, setImportStep] = useState(''); 

  const fetchData = async () => {
    try {
      const [jobsRes, resumesRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/resumes')
      ]);
      const [jobsData, resumesData] = await Promise.all([
        jobsRes.json(),
        resumesRes.json()
      ]);
      setJobs(jobsData);
      setResumes(resumesData);
    } catch (err) {
      console.error('Failed to load Job Board data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importUrl) return;
    setLoading(true);
    setImportStep('fetching');

    const t1 = setTimeout(() => setImportStep('extracting'), 800);
    const t2 = setTimeout(() => setImportStep('parsing'), 1600);
    const t3 = setTimeout(() => setImportStep('matching'), 2400);

    try {
      const response = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
      });

      if (response.ok) {
        const details = await response.json();
        
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        setImportStep('saving');
        
        setTimeout(() => {
          setVerifyImportData({
            url: importUrl,
            title: details.title || '',
            company: details.company || '',
            description: details.description || '',
            skills_required: Array.isArray(details.skills_required) ? details.skills_required.join(',') : (details.skills_required || ''),
            location: details.location || 'Remote',
            salary: details.salary || 'TBD'
          });
          setLoading(false);
          setImportStep('');
        }, 600);

      } else {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        const err = await response.json();
        alert(`Import failed: ${err.error}`);
        setLoading(false);
        setImportStep('');
      }
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      alert(`Network error: ${err.message}`);
      setLoading(false);
      setImportStep('');
    }
  };

  const handleConfirmSave = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...verifyImportData,
        skills_required: verifyImportData.skills_required.split(',')
      };

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchData();
        setVerifyImportData(null);
        setShowImportModal(false);
        setImportUrl('');
      } else {
        const err = await response.json();
        alert(`Failed to save: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...editJob,
        skills_required: editJob.skills_required.split(',')
      };

      const response = await fetch(`/api/jobs/${editJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchData();
        setEditJob(null);
      } else {
        alert('Failed to update job details.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this job posting? This deletes linked matching histories.')) return;
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyNowClick = (jobId) => {
    localStorage.setItem('auto_select_job_id', jobId);
    setActiveTab('automation');
  };

  const getSiteDomain = (urlStr) => {
    try {
      return new URL(urlStr).hostname.replace('www.', '');
    } catch (e) {
      return 'Target Portal';
    }
  };

  const filteredJobs = jobs.filter(job => {
    const query = search.toLowerCase();
    const matchesSearch = 
      job.title.toLowerCase().includes(query) ||
      job.company.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query) ||
      (job.skills_required || []).some(s => s.toLowerCase().includes(query));

    const matchesTab = 
      activeTabFilter === 'all' || 
      (activeTabFilter === 'applied' && job.status === 'applied') ||
      (activeTabFilter === 'failed' && job.status === 'failed') ||
      (activeTabFilter === 'unapplied' && (job.status === 'unapplied' || job.status === 'applying'));

    return matchesSearch && matchesTab;
  });

  const MatchGauge = ({ value, label, color = 'blue' }) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const colorClasses = {
      blue: 'stroke-blue-500',
      emerald: 'stroke-emerald-500',
      indigo: 'stroke-indigo-500'
    };

    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r={radius} className="stroke-slate-800" strokeWidth="6" fill="transparent" />
            <circle 
              cx="48" 
              cy="48" 
              r={radius} 
              className={`${colorClasses[color] || 'stroke-blue-500'} transition-all duration-1000 ease-out`} 
              strokeWidth="6" 
              fill="transparent"
              strokeDasharray={circumference} 
              strokeDashoffset={offset} 
              strokeLinecap="round" 
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-xl font-extrabold text-gray-900">{value}%</span>
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center">{label}</span>
      </div>
    );
  };

  const StarRating = ({ value }) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <svg key={star} className={`w-3 h-3 ${star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-500" /> Job Board Feed
          </h2>
          <p className="text-gray-500 text-sm mt-1">Import vacancies by URL, run AI compatibility scoring, and refine required technologies.</p>
        </div>
        <button 
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition font-semibold rounded-lg text-sm glow-blue text-white"
        >
          <Plus className="w-4 h-4" /> Import Job URL
        </button>
      </div>

      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 p-4 rounded-xl border border-gray-200/80">
        
        {}
        <div className="flex items-center bg-white p-1 rounded-lg border border-gray-200 shrink-0">
          <button 
            onClick={() => setActiveTabFilter('all')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition ${
              activeTabFilter === 'all' ? 'bg-indigo-600/15 text-indigo-600 font-extrabold border border-blue-600/25 glow-blue' : 'text-gray-500 hover:text-slate-355'
            }`}
          >
            All Jobs
          </button>
          <button 
            onClick={() => setActiveTabFilter('unapplied')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition ${
              activeTabFilter === 'unapplied' ? 'bg-indigo-600/15 text-indigo-600 font-extrabold border border-blue-600/25 glow-blue' : 'text-gray-500 hover:text-slate-355'
            }`}
          >
            Unapplied
          </button>
          <button 
            onClick={() => setActiveTabFilter('applied')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition ${
              activeTabFilter === 'applied' ? 'bg-indigo-600/15 text-indigo-600 font-extrabold border border-blue-600/25 glow-blue' : 'text-gray-500 hover:text-slate-355'
            }`}
          >
            Applied
          </button>
          <button 
            onClick={() => setActiveTabFilter('failed')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition ${
              activeTabFilter === 'failed' ? 'bg-indigo-600/15 text-indigo-600 font-extrabold border border-blue-600/25 glow-blue' : 'text-gray-500 hover:text-slate-355'
            }`}
          >
            Failed Runs
          </button>
        </div>

        {}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input 
            type="text" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, company, requirements..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-xs text-gray-700 outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-20 border border-gray-200 border-dashed rounded-2xl p-12 bg-white/90">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-gray-700">No jobs found</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">No job openings match your criteria. Add or scrape a job posting to configure auto-applying.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredJobs.map(job => (
            <div key={job.id} className="glass-panel p-6 rounded-xl hover:border-gray-200 transition flex flex-col justify-between space-y-5">
              
              {}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100/70 border border-gray-200/70 text-gray-500 rounded-xl flex items-center justify-center shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{job.title}</h3>
                    <div className="flex items-center gap-3 text-gray-500 text-xs mt-1 flex-wrap">
                      <strong className="text-slate-250">{job.company}</strong>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                      {job.salary && job.salary !== 'TBD' && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="flex items-center gap-0.5 text-indigo-600"><DollarSign className="w-3.5 h-3.5" /> {job.salary}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {}
                {resumes.length > 0 && job.match_score > 0 ? (
                  <div 
                    onClick={() => setOpenMatchDrawer(job)}
                    className="flex items-center gap-6 bg-white/80 border border-gray-200 hover:border-gray-200 transition px-5 py-2.5 rounded-lg shrink-0 cursor-pointer"
                    title="Click to view Estimated ATS Compatibility breakdown & recommendations"
                  >
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">AI Match Score</span>
                      <p className="text-base font-bold text-emerald-400 mt-0.5">{job.match_score}%</p>
                    </div>
                    <div className="h-6 w-px bg-gray-100" />
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Baseline Resume</span>
                      <p className="text-[10px] font-bold text-gray-700 mt-1 max-w-[120px] truncate">{job.recommended_resume_name}</p>
                    </div>
                    <div className="h-6 w-px bg-gray-100" />
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Confidence</span>
                      <span className="block text-[10px] font-extrabold uppercase text-indigo-600 mt-1">{job.match_confidence}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> No Match Score. Please ingest a resume first.
                  </div>
                )}

              </div>

              {}
              {job.skills_required && job.skills_required.length > 0 && (
                <div className="space-y-1.5 border-t border-gray-200/80 pt-4">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Required Skills Matrix</span>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills_required.map((skill, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-[#0f1524] border border-gray-200 text-[10px] text-gray-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {}
              <div className="flex flex-wrap items-center justify-between border-t border-gray-200 pt-4 gap-4">
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1.5 hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" /> Source Link: <span className="text-indigo-600 font-semibold">{getSiteDomain(job.url)}</span> <ExternalLink className="w-3 h-3 text-gray-400" />
                </a>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border mr-2 ${
                    job.status === 'applied' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    job.status === 'applying' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse' :
                    job.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-gray-100 text-slate-450 border-transparent'
                  }`}>{job.status}</span>

                  <button 
                    onClick={() => setSelectedJob(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-slate-750 text-xs font-semibold text-gray-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Description
                  </button>
                  <button 
                    onClick={() => setEditJob({
                      ...job,
                      skills_required: job.skills_required.join(',')
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-slate-750 text-xs font-semibold text-gray-700 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  
                  {resumes.length > 0 && (
                    <button 
                      onClick={() => handleApplyNowClick(job.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-wider text-white transition shadow-md shadow-blue-500/10"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Apply
                    </button>
                  )}

                  <button 
                    onClick={() => handleDelete(job.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-450 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-500" /> Scrape Online Vacancy URL
              </h3>
              <button 
                onClick={() => setShowImportModal(false)} 
                className="p-1 rounded bg-slate-855 hover:bg-gray-100 text-gray-500 transition"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading && importStep !== '' ? (
              <div className="p-12 text-center space-y-6">
                <RefreshCw className="w-8 h-8 text-indigo-500 mx-auto animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-800 text-sm">Processing Vacancy Scrape Ingestion</h4>
                  <p className="text-[10px] text-gray-400">Connecting Playwright scraper endpoints and parsing HTML nodes...</p>
                </div>
                
                {}
                <div className="max-w-xs mx-auto bg-gray-50 rounded-lg border border-gray-200 p-4 text-left font-mono text-[9px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Fetching Job URL Page</span>
                    <span className={importStep === 'fetching' ? 'text-indigo-600 animate-pulse' : 'text-emerald-500 font-bold'}>
                      {importStep === 'fetching' ? 'RUNNING' : '✓ DONE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Extracting raw page content text</span>
                    <span className={
                      importStep === 'fetching' ? 'text-gray-300' :
                      importStep === 'extracting' ? 'text-indigo-600 animate-pulse' : 'text-emerald-500 font-bold'
                    }>
                      {importStep === 'fetching' ? 'PENDING' : importStep === 'extracting' ? 'RUNNING' : '✓ DONE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">AI Analyzing job specifications</span>
                    <span className={
                      importStep === 'fetching' || importStep === 'extracting' ? 'text-gray-300' :
                      importStep === 'parsing' ? 'text-indigo-600 animate-pulse' : 'text-emerald-500 font-bold'
                    }>
                      {importStep === 'fetching' || importStep === 'extracting' ? 'PENDING' : importStep === 'parsing' ? 'RUNNING' : '✓ DONE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Computing compatibility scores</span>
                    <span className={importStep === 'matching' ? 'text-indigo-600 animate-pulse' : 'text-gray-300'}>
                      {importStep === 'matching' ? 'RUNNING' : 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Target Vacancy Link URL *</label>
                  <input 
                    type="url" 
                    required 
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    placeholder="e.g. http://localhost:5000/mock-recruiter/index.html or Greenhouse / Lever URLs..." 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-slate-355 outline-none focus:border-blue-500 transition font-mono"
                  />
                  <span className="text-[10px] text-gray-400 block">Pasting a link triggers the AI-powered DOM scraper to extract required skills, company names, and salary ranges.</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-855">
                  <button 
                    type="button" 
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-100 rounded-lg text-xs font-bold uppercase text-gray-500 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 glow-blue"
                  >
                    <Plus className="w-4 h-4" /> Import URL
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>
      )}

      {}
      {verifyImportData && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
              <div>
                <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" /> Verify Scraped Job Details
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Review and correct imported metadata before writing to Database</p>
              </div>
              <button 
                onClick={() => setVerifyImportData(null)} 
                className="p-1 rounded bg-slate-855 hover:bg-gray-100 text-gray-500 transition"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="p-6 space-y-4 max-h-[550px] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Job Title *</label>
                  <input 
                    type="text" 
                    required
                    value={verifyImportData.title}
                    onChange={e => setVerifyImportData({...verifyImportData, title: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Company Name *</label>
                  <input 
                    type="text" 
                    required
                    value={verifyImportData.company}
                    onChange={e => setVerifyImportData({...verifyImportData, company: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location</label>
                  <input 
                    type="text" 
                    value={verifyImportData.location}
                    onChange={e => setVerifyImportData({...verifyImportData, location: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Estimated Salary</label>
                  <input 
                    type="text" 
                    value={verifyImportData.salary}
                    onChange={e => setVerifyImportData({...verifyImportData, salary: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Required Skills Matrix (comma separated)</label>
                <input 
                  type="text" 
                  value={verifyImportData.skills_required}
                  onChange={e => setVerifyImportData({...verifyImportData, skills_required: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Description Details *</label>
                <textarea 
                  required
                  value={verifyImportData.description}
                  onChange={e => setVerifyImportData({...verifyImportData, description: e.target.value})}
                  className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-slate-355 outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-855">
                <button 
                  type="button" 
                  onClick={() => setVerifyImportData(null)}
                  className="px-4 py-2 bg-slate-855 hover:bg-gray-100 rounded-lg text-xs font-bold uppercase text-slate-450 transition"
                  disabled={loading}
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase transition disabled:opacity-50 glow-blue"
                >
                  {loading ? 'Analyzing...' : 'Confirm & Save Job'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {}
      {editJob && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
              <div>
                <h3 className="font-bold text-base text-gray-800">Modify Job Parameters</h3>
                <p className="text-xs text-gray-400 mt-0.5">Edit job details manually. Updates trigger dynamic re-matching.</p>
              </div>
              <button onClick={() => setEditJob(null)} className="p-1 rounded bg-slate-855 hover:bg-gray-100 text-gray-500 transition" disabled={loading}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[550px] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Job Title *</label>
                  <input 
                    type="text" 
                    required
                    value={editJob.title}
                    onChange={e => setEditJob({...editJob, title: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Company Name *</label>
                  <input 
                    type="text" 
                    required
                    value={editJob.company}
                    onChange={e => setEditJob({...editJob, company: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location</label>
                  <input 
                    type="text" 
                    value={editJob.location}
                    onChange={e => setEditJob({...editJob, location: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Salary</label>
                  <input 
                    type="text" 
                    value={editJob.salary}
                    onChange={e => setEditJob({...editJob, salary: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Required Skills Matrix (comma separated)</label>
                <input 
                  type="text" 
                  value={editJob.skills_required}
                  onChange={e => setEditJob({...editJob, skills_required: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Full Job Post Description *</label>
                <textarea 
                  required
                  value={editJob.description}
                  onChange={e => setEditJob({...editJob, description: e.target.value})}
                  className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-slate-355 outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-855">
                <button 
                  type="button" 
                  onClick={() => setEditJob(null)}
                  className="px-4 py-2 bg-slate-855 hover:bg-gray-100 rounded-lg text-xs font-bold uppercase text-slate-450 transition"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 glow-blue"
                >
                  Save Updates
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {}
      {openMatchDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white border-l border-gray-200 shadow-2xl flex flex-col animate-slideIn">
          
          <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
            <div>
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" /> AI Match & ATS Compatibility
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{openMatchDrawer.title} @ {openMatchDrawer.company}</p>
            </div>
            <button onClick={() => setOpenMatchDrawer(null)} className="p-1.5 rounded bg-slate-855 hover:bg-gray-100 text-gray-500 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {}
            <div className="grid grid-cols-2 gap-4 bg-white/90 p-6 rounded-xl border border-gray-200">
              <MatchGauge value={openMatchDrawer.match_score} label="Overall Match" color="blue" />
              <MatchGauge value={openMatchDrawer.ats_score || 0} label="Estimated ATS Compatibility" color="emerald" />
            </div>

            {}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Confidence Level:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  openMatchDrawer.match_confidence === 'High' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                  openMatchDrawer.match_confidence === 'Medium' ? 'bg-indigo-50 text-indigo-600 border-blue-500/25' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/25'
                }`}>{openMatchDrawer.match_confidence}</span>
              </div>
              
              {openMatchDrawer.match_recommendations?.confidence_reason && (
                <div className="p-3.5 rounded-lg bg-white/80 border border-gray-200 text-xs text-gray-500 flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                  <p>{openMatchDrawer.match_recommendations.confidence_reason}</p>
                </div>
              )}

              {openMatchDrawer.match_recommendations?.reasoning && (
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Why this score? (AI Explanation)</span>
                  <div className="bg-gray-50 p-4 rounded-lg border border-slate-900 text-xs text-gray-700 leading-relaxed">
                    {openMatchDrawer.match_recommendations.reasoning}
                  </div>
                </div>
              )}
            </div>

            {}
            {openMatchDrawer.match_recommendations?.ratings && (
              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Scoring Breakdown</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/80 p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Resume Strength</span>
                    <StarRating value={openMatchDrawer.match_recommendations.ratings.resume_strength} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Technical Skills Match</span>
                    <StarRating value={openMatchDrawer.match_recommendations.ratings.technical_skills} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Keyword Frequency</span>
                    <StarRating value={openMatchDrawer.match_recommendations.ratings.keywords} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Experience Match</span>
                    <StarRating value={openMatchDrawer.match_recommendations.ratings.experience} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>ATS Layout Formatting</span>
                    <StarRating value={openMatchDrawer.match_recommendations.ratings.formatting} />
                  </div>
                </div>
              </div>
            )}

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Matched tags
                </span>
                <div className="flex flex-wrap gap-1">
                  {(openMatchDrawer.matched_skills || []).map((skill, idx) => {
                    const skillName = typeof skill === 'object' ? skill.name : skill;
                    const rating = typeof skill === 'object' ? skill.rating : 5;
                    return (
                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/5 border border-emerald-500/15 text-[10px] text-emerald-400 font-bold">
                        {skillName} <span className="text-[8px] text-emerald-600 font-normal">({rating}★)</span>
                      </div>
                    );
                  })}
                  {(!openMatchDrawer.matched_skills || openMatchDrawer.matched_skills.length === 0) && (
                    <span className="text-xs text-gray-400 font-medium">None detected.</span>
                  )}
                </div>
              </div>

              {}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Missing tags
                </span>
                <div className="flex flex-wrap gap-1">
                  {(openMatchDrawer.missing_skills || []).map((skill, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded bg-rose-500/5 border border-rose-500/15 text-[10px] text-rose-450 font-semibold uppercase">
                      {skill}
                    </span>
                  ))}
                  {(!openMatchDrawer.missing_skills || openMatchDrawer.missing_skills.length === 0) && (
                    <span className="text-xs text-emerald-400 font-bold">Complete match! (0 missing)</span>
                  )}
                </div>
              </div>

            </div>

            {}
            {openMatchDrawer.match_recommendations?.recommendations && (
              <div className="space-y-2.5 border-t border-gray-200 pt-5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Prioritized Tailoring Steps</span>
                <div className="space-y-2.5">
                  {openMatchDrawer.match_recommendations.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 hover:border-gray-200 transition">
                      <div className="flex items-start justify-between gap-4">
                        <h5 className="text-xs font-bold text-gray-800">{rec.title}</h5>
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase shrink-0">
                          <span className={`px-2 py-0.5 rounded border ${
                            rec.impact === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/25' :
                            rec.impact === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' :
                            'bg-indigo-50 text-indigo-600 border-blue-500/25'
                          }`}>{rec.impact} Impact</span>
                          
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 border-transparent">{rec.difficulty} Difficulty</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed font-normal">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {}
            <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button 
                onClick={() => setOpenMatchDrawer(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-100 text-xs font-bold uppercase text-gray-500 rounded-lg transition"
              >
                Close Panel
              </button>
              <button 
                onClick={() => {
                  setOpenMatchDrawer(null);
                  setActiveTab('settings'); 
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition flex items-center gap-1.5 glow-blue"
              >
                Tailor Resume <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>
      )}

      {}
      {selectedJob && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          
          <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
            <div>
              <h3 className="font-bold text-base text-gray-800">{selectedJob.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selectedJob.company} • {selectedJob.location}</p>
            </div>
            <button onClick={() => setSelectedJob(null)} className="p-1.5 rounded bg-slate-855 hover:bg-gray-100 text-gray-500 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-1">
              <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Job URL Source</h4>
              <a 
                href={selectedJob.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 break-all"
              >
                {selectedJob.url} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-1">
              <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Full Details & Requirements</h4>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                {selectedJob.description}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

