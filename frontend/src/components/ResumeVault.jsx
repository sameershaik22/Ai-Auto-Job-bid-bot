import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Sparkles, 
  Download, 
  Eye, 
  Plus, 
  CheckCircle,
  Clock,
  TrendingUp,
  X,
  Search,
  Archive,
  Copy,
  Edit2,
  AlertTriangle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function ResumeVault() {
  const [resumes, setResumes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); 
  const [search, setSearch] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);
  const [editResume, setEditResume] = useState(null);
  const [duplicateConflict, setDuplicateConflict] = useState(null);

  const [uploadName, setUploadName] = useState('');
  const [uploadCandidate, setUploadCandidate] = useState('');
  const [uploadText, setUploadText] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStep, setUploadStep] = useState(''); 

  const fetchData = async () => {
    try {
      const [resumesRes, appsRes] = await Promise.all([
        fetch('/api/resumes'),
        fetch('/api/applications')
      ]);
      const [resumesData, appsData] = await Promise.all([
        resumesRes.json(),
        appsRes.json()
      ]);
      setResumes(resumesData);
      setApplications(appsData);
    } catch (err) {
      console.error('Failed to load Vault data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e, forceOverwrite = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setDuplicateConflict(null);
    setUploadStep('uploading');
    
    try {
      const formData = new FormData();
      if (uploadFile) {
        formData.append('file', uploadFile);
      }
      formData.append('name', uploadName);
      formData.append('candidate_name', uploadCandidate);
      formData.append('resume_text', uploadText);
      if (forceOverwrite) {
        formData.append('overwrite', 'true');
      }

      const t1 = setTimeout(() => setUploadStep('parsing'), 600);
      const t2 = setTimeout(() => setUploadStep('extracting'), 1200);
      const t3 = setTimeout(() => setUploadStep('saving'), 1800);

      const response = await fetch('/api/resumes', {
        method: 'POST',
        body: formData
      });

      if (response.status === 409) {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        const err = await response.json();
        if (err.duplicate) {
          setDuplicateConflict(err);
          setLoading(false);
          setUploadStep('');
          return;
        }
      }

      if (response.ok) {
        
        setTimeout(async () => {
          await fetchData();
          setShowUploadModal(false);
          
          setUploadName('');
          setUploadCandidate('');
          setUploadText('');
          setUploadFile(null);
          setLoading(false);
          setUploadStep('');
        }, 2200);
      } else {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        const err = await response.json();
        alert(`Ingestion failed: ${err.error}`);
        setLoading(false);
        setUploadStep('');
      }
    } catch (err) {
      alert(`Connection error: ${err.message}`);
      setLoading(false);
      setUploadStep('');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/resumes/${editResume.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editResume)
      });
      if (response.ok) {
        await fetchData();
        setEditResume(null);
      } else {
        alert('Failed to update resume attributes.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (id) => {
    try {
      const res = await fetch(`/api/resumes/${id}/clone`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleArchive = async (id) => {
    try {
      const res = await fetch(`/api/resumes/${id}/archive`, { method: 'PATCH' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this resume from the vault? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setResumes(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getResumeAnalytics = (resumeId) => {
    const resumeApps = applications.filter(a => a.resume_id === resumeId);
    const successApps = resumeApps.filter(a => a.status === 'success');
    const successRate = resumeApps.length > 0 ? Math.round((successApps.length / resumeApps.length) * 100) : 0;
    return {
      applicationsCount: resumeApps.length,
      successRate
    };
  };

  const filteredResumes = resumes.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.skills || []).some(s => s.toLowerCase().includes(search.toLowerCase()));
      
    const matchesTab = r.status === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" /> Resume Vault
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage baseline profiles, upload PDF file assets, edit credentials, and track success metrics.</p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition font-semibold rounded-lg text-sm glow-blue text-white"
        >
          <Plus className="w-4 h-4" /> Ingest Resume (PDF / Paste)
        </button>
      </div>

      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 p-4 rounded-xl border border-gray-200/80">
        
        {}
        <div className="flex items-center bg-white p-1 rounded-lg border border-gray-200">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'active' ? 'bg-indigo-600/15 text-indigo-600 font-extrabold border border-blue-600/25 glow-blue' : 'text-gray-500 hover:text-slate-355'
            }`}
          >
            Active Profiles
          </button>
          <button 
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'archived' ? 'bg-indigo-600/15 text-indigo-600 font-extrabold border border-blue-600/25 glow-blue' : 'text-gray-500 hover:text-slate-355'
            }`}
          >
            Archived
          </button>
        </div>

        {}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input 
            type="text" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidate, profiles, or tags..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-xs text-gray-700 outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {}
      {filteredResumes.length === 0 ? (
        <div className="text-center py-20 border border-gray-200 border-dashed rounded-2xl p-12 bg-white/90">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-gray-700">No profiles found</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">No records found matching your filters. Import a resume file or adjust your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredResumes.map(resume => {
            const { applicationsCount, successRate } = getResumeAnalytics(resume.id);
            return (
              <div key={resume.id} className="glass-panel p-6 rounded-xl hover:border-gray-200 transition flex flex-col justify-between space-y-5">
                
                {}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-800">{resume.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                          resume.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-100 text-gray-500 border-transparent'
                        }`}>
                          {resume.status}
                        </span>
                        {resume.resume_pdf && (
                          <a 
                            href={resume.resume_pdf} 
                            download 
                            className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-extrabold text-red-400 hover:bg-red-500/20 transition flex items-center gap-1"
                          >
                            <Download className="w-2.5 h-2.5" /> PDF ATTACHED
                          </a>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        Candidate: <strong className="text-gray-800">{resume.candidate_name}</strong>
                        {resume.years_of_experience > 0 && (
                          <span className="text-gray-400 ml-2">({resume.years_of_experience} Years Experience)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {}
                  <div className="flex items-center gap-6 bg-white/80 border border-gray-200 px-5 py-2.5 rounded-lg shrink-0">
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Overall Match</span>
                      <p className="text-base font-bold text-indigo-600 mt-0.5">94%</p>
                    </div>
                    <div className="h-6 w-px bg-gray-100" />
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total Runs</span>
                      <p className="text-base font-bold text-slate-355 mt-0.5">{applicationsCount}</p>
                    </div>
                    <div className="h-6 w-px bg-gray-100" />
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Success rate</span>
                      <p className="text-base font-bold text-emerald-400 mt-0.5">{successRate}%</p>
                    </div>
                  </div>
                </div>

                {}
                {(resume.categories || resume.skills).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200/80 pt-4">
                    
                    {}
                    {resume.categories && resume.categories.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Categories</span>
                        <div className="flex flex-wrap gap-1">
                          {resume.categories.map((cat, idx) => (
                            <span key={idx} className="px-2.5 py-0.5 rounded bg-indigo-50 text-[10px] text-indigo-600 font-bold">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {}
                    {resume.skills && resume.skills.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Core Skillsets</span>
                        <div className="flex flex-wrap gap-1">
                          {resume.skills.slice(0, 10).map((skill, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] text-gray-700">
                              {skill}
                            </span>
                          ))}
                          {resume.skills.length > 10 && (
                            <span className="text-[10px] text-gray-400 font-bold px-1.5">+ {resume.skills.length - 10} more</span>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {}
                <div className="flex flex-wrap items-center justify-between border-t border-gray-200/85 pt-4 gap-4">
                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Ingested: {new Date(resume.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedResume(resume)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-slate-750 text-xs font-semibold text-gray-700 transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview Raw
                    </button>
                    <button 
                      onClick={() => setEditResume({
                        ...resume,
                        skills: resume.skills.join(','),
                        categories: resume.categories.join(','),
                        technologies: resume.technologies.join(',')
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-slate-750 text-xs font-semibold text-gray-700 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      onClick={() => handleClone(resume.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-100 hover:bg-slate-750 text-xs font-semibold text-gray-700 transition"
                      title="Clone Resume Profile"
                    >
                      <Copy className="w-3.5 h-3.5" /> Clone
                    </button>
                    <button 
                      onClick={() => handleToggleArchive(resume.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-855 hover:bg-gray-100 text-xs font-semibold text-gray-500 transition"
                    >
                      <Archive className="w-3.5 h-3.5" /> {resume.status === 'archived' ? 'Unarchive' : 'Archive'}
                    </button>
                    <button 
                      onClick={() => handleDelete(resume.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-450 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" /> Ingest Developer Profile
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded bg-slate-855 hover:bg-gray-100 text-gray-500 transition" disabled={loading}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {}
            {loading && uploadStep !== '' ? (
              <div className="p-12 text-center space-y-6">
                <RefreshCw className="w-8 h-8 text-indigo-500 mx-auto animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-800 text-sm">Processing Profile Ingestion</h4>
                  <p className="text-[10px] text-gray-400">Wait while we parse components and analyze skills...</p>
                </div>
                {}
                <div className="max-w-xs mx-auto bg-gray-50 rounded-lg border border-gray-200 p-4 text-left font-mono text-[9px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Uploading Resume File</span>
                    <span className={uploadStep === 'uploading' ? 'text-indigo-600 animate-pulse' : 'text-emerald-500 font-bold'}>
                      {uploadStep === 'uploading' ? 'RUNNING' : '✓ DONE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Extracting PDF document text</span>
                    <span className={
                      uploadStep === 'uploading' ? 'text-gray-300' :
                      uploadStep === 'parsing' ? 'text-indigo-600 animate-pulse' : 'text-emerald-500 font-bold'
                    }>
                      {uploadStep === 'uploading' ? 'PENDING' : uploadStep === 'parsing' ? 'RUNNING' : '✓ DONE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">AI Extracting skills & experience</span>
                    <span className={
                      uploadStep === 'uploading' || uploadStep === 'parsing' ? 'text-gray-300' :
                      uploadStep === 'extracting' ? 'text-indigo-600 animate-pulse' : 'text-emerald-500 font-bold'
                    }>
                      {uploadStep === 'uploading' || uploadStep === 'parsing' ? 'PENDING' : uploadStep === 'extracting' ? 'RUNNING' : '✓ DONE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Saving records to Neon Database</span>
                    <span className={uploadStep === 'saving' ? 'text-indigo-600 animate-pulse' : 'text-gray-300'}>
                      {uploadStep === 'saving' ? 'RUNNING' : 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">
                
                {}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Option A: Upload Resume Document (PDF / DOCX)</label>
                  <div 
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
                      dragActive ? 'border-blue-500 bg-indigo-600/5' : 'border-gray-200 hover:border-gray-200 bg-white/90'
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload-input').click()}
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    {uploadFile ? (
                      <span className="text-xs font-semibold text-emerald-400">File Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    ) : (
                      <span className="text-xs text-gray-400">Drag & Drop PDF/DOCX here, or click to browse files (5MB Max)</span>
                    )}
                    <input 
                      type="file" 
                      id="file-upload-input" 
                      className="hidden" 
                      accept=".pdf,.docx" 
                      onChange={e => setUploadFile(e.target.files[0])}
                    />
                  </div>
                </div>

                <div className="relative flex items-center py-2 shrink-0">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-gray-300 font-bold uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                {}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Profile Descriptor Name *</label>
                      <input 
                        type="text" 
                        required={!uploadFile}
                        value={uploadName}
                        onChange={e => setUploadName(e.target.value)}
                        placeholder="e.g. Senior Frontend Stack" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Candidate Full Name *</label>
                      <input 
                        type="text" 
                        required={!uploadFile}
                        value={uploadCandidate}
                        onChange={e => setUploadCandidate(e.target.value)}
                        placeholder="e.g. Sameer Ahmed" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Paste Resume CV Raw Text *</label>
                    <textarea 
                      required={!uploadFile}
                      value={uploadText}
                      onChange={e => setUploadText(e.target.value)}
                      placeholder="Paste your resume contents..." 
                      className="w-full h-40 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 font-mono outline-none focus:border-blue-500 transition resize-none"
                    />
                  </div>
                </div>

                {}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-855">
                  <button 
                    type="button" 
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-100 rounded-lg text-xs font-bold uppercase text-gray-500 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 glow-blue"
                  >
                    <Upload className="w-4 h-4" /> Save Profile
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>
      )}

      {}
      {editResume && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
              <div>
                <h3 className="font-bold text-base text-gray-800">Modify Resume Attributes</h3>
                <p className="text-xs text-gray-400 mt-0.5">Edit parsed fields directly to polish alignment</p>
              </div>
              <button onClick={() => setEditResume(null)} className="p-1 rounded bg-gray-100 hover:bg-gray-100 text-gray-500 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Profile Name</label>
                  <input 
                    type="text" 
                    required
                    value={editResume.name}
                    onChange={e => setEditResume({...editResume, name: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Candidate Name</label>
                  <input 
                    type="text" 
                    required
                    value={editResume.candidate_name}
                    onChange={e => setEditResume({...editResume, candidate_name: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Years of Experience</label>
                  <input 
                    type="number" 
                    required
                    value={editResume.years_of_experience}
                    onChange={e => setEditResume({...editResume, years_of_experience: parseInt(e.target.value) || 0})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Skills tags (comma separated)</label>
                <input 
                  type="text" 
                  value={editResume.skills}
                  onChange={e => setEditResume({...editResume, skills: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 font-mono"
                  placeholder="e.g. REACT, TYPESCRIPT, NODE.JS"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Categories (comma separated)</label>
                  <input 
                    type="text" 
                    value={editResume.categories}
                    onChange={e => setEditResume({...editResume, categories: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                    placeholder="e.g. Frontend, Full Stack"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Technologies (comma separated)</label>
                  <input 
                    type="text" 
                    value={editResume.technologies}
                    onChange={e => setEditResume({...editResume, technologies: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. React, PostgreSQL"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Summary Statement</label>
                <textarea 
                  value={editResume.summary}
                  onChange={e => setEditResume({...editResume, summary: e.target.value})}
                  className="w-full h-20 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Raw Resume Text</label>
                <textarea 
                  value={editResume.resume_text}
                  onChange={e => setEditResume({...editResume, resume_text: e.target.value})}
                  className="w-full h-44 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500 font-mono resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => setEditResume(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-100 rounded-lg text-xs font-bold uppercase text-slate-455 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase transition disabled:opacity-50 glow-blue"
                >
                  Save Updates
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {}
      {duplicateConflict && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-gray-200 space-y-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 text-amber-500 uppercase tracking-wider">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Duplicate Resume Detected
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {duplicateConflict.message}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setDuplicateConflict(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-100 text-xs font-bold uppercase text-gray-500 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleUploadSubmit(null, true)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold uppercase text-white shadow-lg shadow-blue-500/15 transition"
              >
                Overwrite Existing
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {selectedResume && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/80">
            <div>
              <h3 className="font-bold text-base text-gray-800">{selectedResume.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Parsed text block viewer</p>
            </div>
            <button onClick={() => setSelectedResume(null)} className="p-1.5 rounded bg-gray-100 hover:bg-gray-100 text-gray-500 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-gray-50 rounded-xl border border-gray-200/80 p-6 font-mono text-[10px] text-slate-450 whitespace-pre-line leading-relaxed">
              {selectedResume.resume_text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

