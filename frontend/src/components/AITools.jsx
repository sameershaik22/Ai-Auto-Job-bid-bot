import React, { useState, useEffect } from 'react';
import { 
  FileText, Briefcase, Zap, Brain, Edit2, 
  CheckCircle2, XCircle, ArrowRight, Play,
  RefreshCw, Save, Download, Copy, AlertCircle, FileCheck, GitCompare, ChevronRight, X, User, Layers
} from 'lucide-react';

const DiffViewer = ({ original, modified }) => {
  if (!original || !modified) return <div className="text-sm text-gray-500">Run Tailoring to see diffs.</div>;

  const newText = modified;
  
  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center mb-4">
        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-xs font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span> Content Added/Optimized
        </span>
        <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded text-xs font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 block"></span> Unrelated Content Pruned
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-y-auto max-h-[500px]">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Original Baseline</h4>
          <pre className="text-[10px] text-gray-700 whitespace-pre-wrap font-mono">{original}</pre>
        </div>
        <div className="bg-white p-4 rounded-lg border border-emerald-200 overflow-y-auto max-h-[500px] shadow-sm">
          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex justify-between">
            Tailored Result <SparklesIcon />
          </h4>
          <pre className="text-[10px] text-gray-800 whitespace-pre-wrap font-mono">{newText}</pre>
        </div>
      </div>
    </div>
  );
};

const SparklesIcon = () => <Sparkles className="w-3.5 h-3.5" />;
import { Sparkles } from 'lucide-react';

export default function AITools({ setActiveTab }) {
  
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedResume, setSelectedResume] = useState('');
  const [selectedJob, setSelectedJob] = useState('');

  const [tone, setTone] = useState('Professional');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');

  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null); 
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [workspace, setWorkspace] = useState({
    matchResult: null,
    tailoredResume: null,
    coverLetter: null,
    proposal: null,
    versions: { tailored: [], cover: [], proposal: [] }
  });

  const [activeViewTab, setActiveViewTab] = useState('analysis'); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rRes, jRes] = await Promise.all([fetch('/api/resumes'), fetch('/api/jobs')]);
        const rData = await rRes.json();
        const jData = await jRes.json();
        setResumes(rData);
        setJobs(jData);
      } catch (e) {
        console.error('Failed to load assets');
      }
    };
    fetchData();

    const savedDraft = localStorage.getItem('ai_workspace_draft');
    if (savedDraft) {
      try {
        setWorkspace(JSON.parse(savedDraft));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_workspace_draft', JSON.stringify(workspace));
  }, [workspace]);

  const runAIAction = async (endpoint, actionName, reqBody, onSuccess) => {
    if (!selectedResume || !selectedJob) {
      setErrorMsg('Please select a Resume and a Job first.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setActiveAction(actionName);
    setProgressMsg(`Connecting to AI endpoint...`);

    const stages = [
      'Analyzing inputs...',
      'Synthesizing data...',
      'Applying tone parameters...',
      'Generating final output...'
    ];
    let step = 0;
    const interval = setInterval(() => {
      if (step < stages.length) {
        setProgressMsg(stages[step]);
        step++;
      }
    }, 800);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: selectedResume,
          job_id: selectedJob,
          ...reqBody
        })
      });

      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'API Error');
      }

      const data = await res.json();
      onSuccess(data);
      setProgressMsg('Generation Complete!');
      setTimeout(() => { setLoading(false); setProgressMsg(''); setActiveAction(null); }, 1000);
    } catch (err) {
      clearInterval(interval);
      setLoading(false);
      setActiveAction(null);
      setErrorMsg(err.message);
    }
  };

  const handleRunMatch = () => {
    runAIAction('/api/ai/match', 'match', {}, (data) => {
      setWorkspace(prev => ({ ...prev, matchResult: data }));
      setActiveViewTab('analysis');
    });
  };

  const handleTailorResume = () => {
    runAIAction('/api/ai/tailor', 'tailor', { tone }, (data) => {
      setWorkspace(prev => {
        const newVersions = [...prev.versions.tailored, data.tailored_resume];
        return { ...prev, tailoredResume: data.tailored_resume, versions: { ...prev.versions, tailored: newVersions } };
      });
      setActiveViewTab('resume');
    });
  };

  const handleCoverLetter = () => {
    runAIAction('/api/ai/cover-letter', 'cover', { tone }, (data) => {
      setWorkspace(prev => {
        const newVersions = [...prev.versions.cover, data.cover_letter];
        return { ...prev, coverLetter: data.cover_letter, versions: { ...prev.versions, cover: newVersions } };
      });
      setActiveViewTab('cover');
    });
  };

  const handleProposal = () => {
    runAIAction('/api/ai/proposal', 'proposal', { budget, timeline }, (data) => {
      setWorkspace(prev => {
        const newVersions = [...prev.versions.proposal, data.proposal];
        return { ...prev, proposal: data.proposal, versions: { ...prev.versions, proposal: newVersions } };
      });
      setActiveViewTab('proposal');
    });
  };

  const handleSaveApplication = async () => {
    if (!selectedResume || !selectedJob || !workspace.tailoredResume) {
      setErrorMsg('Cannot save: Must select Resume, Job, and generate at least a Tailored Resume.');
      return;
    }
    
    setLoading(true);
    setProgressMsg('Saving Application to Database...');
    try {
      const res = await fetch('/api/applications/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: selectedResume,
          job_id: selectedJob,
          tailored_resume_text: workspace.tailoredResume,
          cover_letter: workspace.coverLetter,
          proposal: workspace.proposal,
          match_score: workspace.matchResult?.score || 0,
          ats_score: workspace.matchResult?.ats_estimate || 0,
          ai_suggestions: workspace.matchResult?.recommendations || []
        })
      });
      
      if (res.ok) {
        setProgressMsg('Application Saved Successfully!');
        setTimeout(() => {
          setActiveTab('applications');
        }, 1000);
      } else {
        throw new Error('Save failed.');
      }
    } catch (e) {
      setErrorMsg(e.message);
      setLoading(false);
    }
  };

  const getOriginalResumeText = () => {
    const r = resumes.find(r => r.id === selectedResume);
    return r ? r.resume_text : '';
  };

  const renderAnalysis = () => {
    if (!workspace.matchResult) return <div className="text-gray-400 text-sm p-10 text-center border-dashed border-2 rounded-xl">Run AI Match Analysis to view ATS estimations and strengths.</div>;
    const { score, ats_estimate, strengths, weaknesses, priority_improvements, matched_skills, missing_skills } = workspace.matchResult;
    
    return (
      <div className="space-y-6 fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-center">
            <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">Overall Match</span>
            <div className="text-2xl font-black text-indigo-700 mt-1">{score}%</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
            <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">ATS Compatibility</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{ats_estimate}%</div>
          </div>
          <div className="bg-white border border-gray-200 p-4 rounded-xl text-center col-span-2">
            <div className="flex items-center justify-center gap-6 h-full">
               <div className="text-center">
                 <div className="text-lg font-bold text-gray-800">{matched_skills?.length || 0}</div>
                 <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mt-0.5">Matching Skills</div>
               </div>
               <div className="h-8 w-px bg-gray-200" />
               <div className="text-center">
                 <div className="text-lg font-bold text-rose-500">{missing_skills?.length || 0}</div>
                 <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mt-0.5">Missing Skills</div>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Key Strengths
            </h4>
            <ul className="space-y-2">
              {(strengths || []).map((s, i) => (
                <li key={i} className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">{s}</li>
              ))}
            </ul>

            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mt-6">
              <XCircle className="w-4 h-4 text-rose-500" /> Weaknesses / Gaps
            </h4>
            <ul className="space-y-2">
              {(weaknesses || []).map((w, i) => (
                <li key={i} className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">{w}</li>
              ))}
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Priority Improvements
            </h4>
            <div className="space-y-3">
              {(priority_improvements || []).map((p, i) => (
                <div key={i} className="group flex items-start justify-between bg-white border border-gray-200 p-3 rounded-lg hover:border-indigo-300 transition">
                  <span className="text-xs text-gray-700 mt-0.5">{p}</span>
                  <button 
                    onClick={() => handleTailorResume()}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold hover:bg-indigo-100 transition whitespace-nowrap">
                    Apply Fix
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContentViewer = (content, placeholder, type) => {
    if (!content) return <div className="text-gray-400 text-sm p-10 text-center border-dashed border-2 rounded-xl">{placeholder}</div>;
    return (
      <div className="space-y-4 fade-in">
        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
          <div className="text-xs font-bold text-gray-500 px-2 uppercase tracking-wider">Generated {type}</div>
          <div className="flex gap-2">
            <button 
              onClick={() => { navigator.clipboard.writeText(content); alert('Copied!'); }}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button 
              className="px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
              <Download className="w-3 h-3" /> DOCX
            </button>
          </div>
        </div>
        <textarea 
          className="w-full h-[500px] p-4 text-[11px] font-mono leading-relaxed bg-white border border-gray-200 rounded-xl resize-none outline-none focus:border-indigo-500 shadow-sm"
          value={content}
          readOnly
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 fade-in h-full flex flex-col">
      {}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-6 h-6 text-indigo-500" /> AI Workspace
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Draft your complete application package using independent AI tools, review changes, and save the final payload.
        </p>
      </div>

      {}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Target Resume</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <select 
                value={selectedResume} onChange={e => setSelectedResume(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none focus:border-indigo-500 transition cursor-pointer appearance-none">
                <option value="">Select a baseline resume...</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.candidate_name} - {r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Target Job Post</label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <select 
                value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none focus:border-indigo-500 transition cursor-pointer appearance-none">
                <option value="">Select an imported job...</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} at {j.company}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tone Parameter</label>
            <select 
              value={tone} onChange={e => setTone(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none focus:border-indigo-500 cursor-pointer">
              <option value="Professional">Professional</option>
              <option value="Bold">Bold / Confident</option>
              <option value="Academic">Academic</option>
            </select>
          </div>
        </div>
      </div>

      {}
      <div className="flex flex-wrap items-center gap-3 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
        <button 
          onClick={handleRunMatch} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-lg text-xs font-bold transition shadow-sm">
          <Brain className="w-4 h-4" /> Analyze Match
        </button>
        <button 
          onClick={handleTailorResume} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-lg text-xs font-bold transition shadow-sm">
          <Edit2 className="w-4 h-4" /> Tailor Resume
        </button>
        <button 
          onClick={handleCoverLetter} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-lg text-xs font-bold transition shadow-sm">
          <FileText className="w-4 h-4" /> Cover Letter
        </button>
        <button 
          onClick={handleProposal} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-lg text-xs font-bold transition shadow-sm">
          <Briefcase className="w-4 h-4" /> Proposal
        </button>

        <div className="flex-1" />

        <button 
          onClick={() => { if(confirm('Clear workspace?')) setWorkspace({matchResult: null, tailoredResume: null, coverLetter: null, proposal: null, versions: { tailored: [], cover: [], proposal: [] }})}}
          className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-rose-500 transition">
          Clear Draft
        </button>
        <button 
          onClick={handleSaveApplication} disabled={loading || !workspace.tailoredResume}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md glow-blue disabled:opacity-50">
          <Save className="w-4 h-4" /> Save Application
        </button>
      </div>

      {}
      {(loading || errorMsg || progressMsg) && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${errorMsg ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}`}>
          {loading ? <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" /> : 
           errorMsg ? <AlertCircle className="w-5 h-5 text-rose-600" /> : 
           <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          
          <div className="flex-1">
            <h4 className={`text-xs font-bold ${errorMsg ? 'text-rose-700' : 'text-blue-800'}`}>
              {errorMsg ? 'Execution Failed' : activeAction ? `Running: ${activeAction.toUpperCase()}` : 'Ready'}
            </h4>
            <p className={`text-[10px] mt-0.5 ${errorMsg ? 'text-rose-600' : 'text-blue-600'}`}>
              {errorMsg || progressMsg}
            </p>
          </div>
          
          {loading && (
            <div className="w-48 h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 animate-pulse w-full"></div>
            </div>
          )}
        </div>
      )}

      {}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm min-h-[600px]">
        {}
        <div className="flex items-center border-b border-gray-200 bg-gray-50/50">
          {[
            { id: 'analysis', label: 'Match Analysis', icon: Brain },
            { id: 'resume', label: 'Tailored Resume', icon: Edit2 },
            { id: 'diff', label: 'Diff Viewer', icon: GitCompare },
            { id: 'cover', label: 'Cover Letter', icon: FileText },
            { id: 'proposal', label: 'Proposal', icon: Zap }
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setActiveViewTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition border-b-2 ${
                activeViewTab === t.id 
                  ? 'border-indigo-600 text-indigo-700 bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
              {((t.id === 'resume' && workspace.tailoredResume) || 
                (t.id === 'cover' && workspace.coverLetter) || 
                (t.id === 'proposal' && workspace.proposal) || 
                (t.id === 'analysis' && workspace.matchResult)) && 
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              }
            </button>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-gray-50/20">
          {activeViewTab === 'analysis' && renderAnalysis()}
          {activeViewTab === 'resume' && renderContentViewer(workspace.tailoredResume, 'Click "Tailor Resume" to generate ATS-optimized content.', 'Resume')}
          {activeViewTab === 'cover' && renderContentViewer(workspace.coverLetter, 'Click "Cover Letter" to generate.', 'Cover Letter')}
          {activeViewTab === 'proposal' && renderContentViewer(workspace.proposal, 'Click "Proposal" to generate freelance bid.', 'Proposal')}
          {activeViewTab === 'diff' && <DiffViewer original={getOriginalResumeText()} modified={workspace.tailoredResume} />}
        </div>
      </div>
    </div>
  );
}
