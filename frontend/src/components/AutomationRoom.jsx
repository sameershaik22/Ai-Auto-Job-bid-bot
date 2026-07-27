import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Play, 
  Cpu, 
  Settings2, 
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Terminal,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  MonitorPlay,
  RotateCcw,
  Download,
  Clipboard,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Check
} from 'lucide-react';

export default function AutomationRoom({ socket }) {
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');

  const [tone, setTone] = useState('Professional');
  const [budget, setBudget] = useState('$1,500');
  const [timeline, setTimeline] = useState('2 Weeks');
  const [portfolioLinks, setPortfolioLinks] = useState('github.com/sameer, sameer.dev');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiOutput, setAiOutput] = useState(null); 
  const [activeTab, setActiveTab] = useState('diff'); 

  const [verifiedResume, setVerifiedResume] = useState(false);
  const [verifiedLetter, setVerifiedLetter] = useState(false);
  const [verifiedProposal, setVerifiedProposal] = useState(false);

  const [regenResumeLoading, setRegenResumeLoading] = useState(false);
  const [regenLetterLoading, setRegenLetterLoading] = useState(false);
  const [regenProposalLoading, setRegenProposalLoading] = useState(false);

  const [runningAppId, setRunningAppId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeScreenshot, setActiveScreenshot] = useState(null);

  const [checklist, setChecklist] = useState({
    browser: 'pending',
    navigate: 'pending',
    login: 'pending',
    formFill: 'pending',
    resumeUpload: 'pending',
    submit: 'pending'
  });
  const [consoleLogs, setConsoleLogs] = useState([]);
  const terminalEndRef = useRef(null);

  const loadLists = async () => {
    try {
      const [resumesRes, jobsRes] = await Promise.all([
        fetch('/api/resumes'),
        fetch('/api/jobs')
      ]);
      const [resumesData, jobsData] = await Promise.all([
        resumesRes.json(),
        jobsRes.json()
      ]);
      
      setResumes(resumesData);
      setJobs(jobsData);

      if (resumesData.length > 0) {
        setSelectedResumeId(resumesData[0].id);
      }

      const autoJobId = localStorage.getItem('auto_select_job_id');
      if (autoJobId) {
        setSelectedJobId(autoJobId);
        localStorage.removeItem('auto_select_job_id');
      } else if (jobsData.length > 0) {
        setSelectedJobId(jobsData[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  const runAiPipeline = async () => {
    if (!selectedResumeId || !selectedJobId) {
      alert('Please select both a baseline resume and target job.');
      return;
    }
    
    setAiLoading(true);
    setAiStep(1);
    
    const steps = [
      'Analyzing target job description attributes...',
      'Running skill alignment and keyword mapping...',
      'Selecting optimal baseline resume profile...',
      'Tailoring skills matrix & resume sections...',
      'Optimizing summaries for ATS relevance...',
      'Drafting job-specific cover letter...',
      'Generating unique freelance bid proposal...'
    ];

    let currentStep = 1;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep <= steps.length) {
        setAiStep(currentStep);
      } else {
        clearInterval(interval);
      }
    }, 900);

    try {
      const response = await fetch('/api/ai/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: selectedResumeId,
          job_id: selectedJobId,
          tone,
          budget,
          timeline,
          portfolio_links: portfolioLinks
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Pipeline execution failed.');
      }

      const data = await response.json();
      
      setTimeout(() => {
        setAiOutput(data);
        setAiLoading(false);
        setAiStep(0);
        clearInterval(interval);

        setVerifiedResume(false);
        setVerifiedLetter(false);
        setVerifiedProposal(false);
      }, 1000);

    } catch (err) {
      alert(`AI Tailoring failed: ${err.message}`);
      setAiLoading(false);
      setAiStep(0);
      clearInterval(interval);
    }
  };

  const startAutomation = async () => {
    if (!aiOutput || !aiOutput.application_id) {
      alert('Please run the AI Matcher & Tailoring step first.');
      return;
    }

    setIsRunning(true);
    setConsoleLogs([]);
    setActiveScreenshot(null);
    setRunningAppId(aiOutput.application_id);
    
    setChecklist({
      browser: 'pending',
      navigate: 'pending',
      login: 'pending',
      formFill: 'pending',
      resumeUpload: 'pending',
      submit: 'pending'
    });

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: aiOutput.application_id,
          website: 'mock_portal'
        })
      });
      
      if (!response.ok) {
        setIsRunning(false);
        alert('Failed to initialize automation runner.');
      }
    } catch (err) {
      console.error(err);
      setIsRunning(false);
    }
  };

  const handleRegenLetter = async () => {
    setRegenLetterLoading(true);
    try {
      const response = await fetch(`/api/applications/${aiOutput.application_id}/regenerate-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone })
      });
      if (response.ok) {
        const data = await response.json();
        setAiOutput(prev => ({ ...prev, cover_letter: data.cover_letter }));
      } else {
        alert('Failed to regenerate cover letter.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegenLetterLoading(false);
    }
  };

  const handleRegenProposal = async () => {
    setRegenProposalLoading(true);
    try {
      const response = await fetch(`/api/applications/${aiOutput.application_id}/regenerate-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, budget, timeline, portfolio_links: portfolioLinks })
      });
      if (response.ok) {
        const data = await response.json();
        setAiOutput(prev => ({ ...prev, proposal: data.proposal }));
      } else {
        alert('Failed to regenerate proposal.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegenProposalLoading(false);
    }
  };

  const handleRegenResume = async () => {
    setRegenResumeLoading(true);
    try {
      const response = await fetch(`/api/applications/${aiOutput.application_id}/regenerate-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone })
      });
      if (response.ok) {
        const data = await response.json();
        setAiOutput(prev => ({ 
          ...prev, 
          tailored_resume_text: data.tailored_resume_text,
          score: data.score,
          ats_estimate: data.ats_estimate,
          matched_skills: data.matched_skills,
          missing_skills: data.missing_skills,
          match_recommendations: data.match_recommendations
        }));
      } else {
        alert('Failed to regenerate resume.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegenResumeLoading(false);
    }
  };

  useEffect(() => {
    if (!socket || !runningAppId) return;

    const handleLog = (log) => {
      if (log.application_id !== runningAppId) return;

      setConsoleLogs(prev => [...prev, log]);
      
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      const msg = log.message.toLowerCase();
      
      if (msg.includes('launching browser')) {
        setChecklist(prev => ({ ...prev, browser: 'running' }));
      } else if (msg.includes('browser instance')) {
        setChecklist(prev => ({ ...prev, browser: 'success', navigate: 'running' }));
      } else if (msg.includes('navigating') || msg.includes('navigated')) {
        setChecklist(prev => ({ ...prev, navigate: 'success', login: 'running' }));
      } else if (msg.includes('authenticating') || msg.includes('credentials')) {
        setChecklist(prev => ({ ...prev, login: 'success', formFill: 'running' }));
      } else if (msg.includes('entering candidate') || msg.includes('populating')) {
        setChecklist(prev => ({ ...prev, login: 'success', formFill: 'running' }));
      } else if (msg.includes('uploading physical') || msg.includes('resume_uploaded')) {
        setChecklist(prev => ({ ...prev, formFill: 'success', resumeUpload: 'running' }));
      } else if (msg.includes('clicking application') || msg.includes('form submitted')) {
        setChecklist(prev => ({ ...prev, resumeUpload: 'success', submit: 'running' }));
      } else if (msg.includes('submission successfully processed')) {
        setChecklist(prev => ({ ...prev, submit: 'success' }));
        setIsRunning(false);
      } else if (msg.includes('critical execution exception') || msg.includes('submit error')) {
        setChecklist(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(k => {
            if (updated[k] === 'running' || updated[k] === 'pending') {
              updated[k] = 'failed';
            }
          });
          return updated;
        });
        setIsRunning(false);
      }

      if (log.screenshot_path) {
        setActiveScreenshot(log.screenshot_path);
      }
    };

    socket.on('automation_log', handleLog);
    return () => {
      socket.off('automation_log', handleLog);
    };
  }, [runningAppId, socket]);

  const renderVisualDiff = (original, tailored) => {
    if (!original || !tailored) return null;
    const origLines = original.split('\n');
    const tailLines = tailored.split('\n');
    const result = [];
    
    let i = 0, j = 0;
    while (i < origLines.length || j < tailLines.length) {
      const orig = origLines[i] || '';
      const tail = tailLines[j] || '';
      
      if (orig === tail) {
        result.push({ type: 'normal', text: orig });
        i++;
        j++;
      } else {
        if (orig && !tailLines.includes(orig)) {
          result.push({ type: 'removed', text: `- ${orig}` });
          i++;
        } else if (tail && !origLines.includes(tail)) {
          result.push({ type: 'added', text: `+ ${tail}` });
          j++;
        } else {
          result.push({ type: 'removed', text: `- ${orig}` });
          result.push({ type: 'added', text: `+ ${tail}` });
          i++;
          j++;
        }
      }
    }

    return (
      <div className="font-mono text-[10px] bg-gray-50 p-6 border border-slate-900 rounded-lg overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed">
        {result.map((line, idx) => (
          <div 
            key={idx} 
            className={`py-0.5 px-2 rounded-sm ${
              line.type === 'added' ? 'bg-emerald-500/10 text-emerald-400 font-bold border-l-2 border-emerald-500' :
              line.type === 'removed' ? 'bg-rose-500/10 text-rose-400 border-l-2 border-rose-500 line-through' :
              'text-slate-450'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>
    );
  };

  const currentResume = resumes.find(r => r.id === selectedResumeId);
  const currentJob = jobs.find(j => j.id === selectedJobId);

  const allVerified = verifiedResume && verifiedLetter && verifiedProposal;

  return (
    <div className="space-y-8 animate-fadeIn">
      {}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cpu className="w-6 h-6 text-indigo-500" /> Automation Room
        </h2>
        <p className="text-gray-500 text-sm mt-1">Configure candidate parameters, optimize resume matrix structures, and trigger automated form filler scripts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {}
        <div className="lg:col-span-2 space-y-8">
          
          {}
          <div className="glass-panel p-6 rounded-xl space-y-6">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-4.5 h-4.5 text-indigo-500" /> Pipeline Parameters
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Baseline Resume</label>
                <select 
                  value={selectedResumeId}
                  onChange={e => { setSelectedResumeId(e.target.value); setAiOutput(null); }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  disabled={aiLoading || isRunning}
                >
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.candidate_name})</option>
                  ))}
                </select>
              </div>

              {}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Target Job listing</label>
                <select 
                  value={selectedJobId}
                  onChange={e => { setSelectedJobId(e.target.value); setAiOutput(null); }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  disabled={aiLoading || isRunning}
                >
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.company} - {j.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-gray-200">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Resume/Copy Tone</label>
                <select 
                  value={tone} 
                  onChange={e => setTone(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-[10px] text-gray-700 outline-none"
                >
                  <option value="Professional">Professional</option>
                  <option value="Bold">Bold / Creative</option>
                  <option value="Academic">Technical / Academic</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Estimated Budget</label>
                <input 
                  type="text" 
                  value={budget} 
                  onChange={e => setBudget(e.target.value)} 
                  className="w-full bg-gray-50 border border-slate-855 rounded p-2 text-[10px] text-gray-700 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Delivery Timeline</label>
                <input 
                  type="text" 
                  value={timeline} 
                  onChange={e => setTimeline(e.target.value)} 
                  className="w-full bg-gray-50 border border-slate-855 rounded p-2 text-[10px] text-gray-700 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Portfolio Links</label>
                <input 
                  type="text" 
                  value={portfolioLinks} 
                  onChange={e => setPortfolioLinks(e.target.value)} 
                  className="w-full bg-gray-50 border border-slate-855 rounded p-2 text-[10px] text-gray-700 outline-none"
                />
              </div>
            </div>

            {currentResume && currentJob && !aiOutput && (
              <div className="p-4 rounded-lg bg-indigo-600/5 border border-blue-500/10 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Ready to tailor documents and optimize compatibility score indices?</span>
                <button 
                  onClick={runAiPipeline}
                  disabled={aiLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 transition font-semibold rounded text-xs text-white flex items-center gap-1.5 glow-blue disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Start AI Tailoring
                </button>
              </div>
            )}
          </div>

          {}
          {aiLoading && (
            <div className="glass-panel p-8 rounded-xl text-center space-y-6">
              <Cpu className="w-10 h-10 text-indigo-500 mx-auto animate-spin" />
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800">Executing Deep AI Optimization Pipeline</h4>
                <p className="text-xs text-gray-400">Injecting target requirements, extracting skills matrix, and drafting copywriting assets.</p>
              </div>
              
              <div className="max-w-md mx-auto bg-white/90 rounded-lg p-4 text-left font-mono text-[10px] space-y-1.5 border border-gray-200">
                <div className={aiStep >= 1 ? 'text-emerald-400 font-semibold animate-pulse' : 'text-gray-300'}>
                  {aiStep > 1 ? '✓' : '●'} Analyzing target job description attributes...
                </div>
                <div className={aiStep >= 2 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                  {aiStep > 2 ? '✓' : aiStep === 2 ? '● animate-pulse' : '○'} Running skill alignment and keyword mapping...
                </div>
                <div className={aiStep >= 3 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                  {aiStep > 3 ? '✓' : aiStep === 3 ? '● animate-pulse' : '○'} Selecting optimal baseline resume profile...
                </div>
                <div className={aiStep >= 4 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                  {aiStep > 4 ? '✓' : aiStep === 4 ? '● animate-pulse' : '○'} Tailoring skills matrix & resume sections...
                </div>
                <div className={aiStep >= 5 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                  {aiStep > 5 ? '✓' : aiStep === 5 ? '● animate-pulse' : '○'} Optimizing summaries for ATS relevance...
                </div>
                <div className={aiStep >= 6 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                  {aiStep > 6 ? '✓' : aiStep === 6 ? '● animate-pulse' : '○'} Drafting job-specific cover letter...
                </div>
                <div className={aiStep >= 7 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                  {aiStep > 7 ? '✓' : aiStep === 7 ? '● animate-pulse' : '○'} Generating unique freelance bid proposal...
                </div>
              </div>
            </div>
          )}

          {}
          {aiOutput && !aiLoading && (
            <div className="space-y-6 animate-fadeIn">
              
              {}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Match Score</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-emerald-400">{aiOutput.score}%</span>
                    <span className="text-[9px] text-gray-400 font-semibold line-through">{aiOutput.original_score}%</span>
                    <span className="text-[9px] text-emerald-500 font-bold">+{aiOutput.score - aiOutput.original_score}% Gain</span>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">AI ATS Estimate</span>
                  <h5 className="text-xl font-bold text-indigo-600 mt-1">{aiOutput.ats_estimate}%</h5>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Keywords Added</span>
                  <h5 className="text-xl font-bold text-gray-800 mt-1">+{aiOutput.matched_skills?.length || 5} Tags</h5>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Missing Skills</span>
                  <h5 className="text-xl font-bold text-rose-450 mt-1">Reduced to {aiOutput.missing_skills?.length || 0}</h5>
                </div>
              </div>

              {}
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="flex bg-white border-b border-gray-200 p-1">
                  <button 
                    onClick={() => setActiveTab('diff')}
                    className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider rounded transition ${
                      activeTab === 'diff' ? 'bg-indigo-600/15 text-indigo-600 border border-indigo-200' : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Resume Tailor Diff
                  </button>
                  <button 
                    onClick={() => setActiveTab('letter')}
                    className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider rounded transition ${
                      activeTab === 'letter' ? 'bg-indigo-600/15 text-indigo-600 border border-indigo-200' : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Tailored Cover Letter
                  </button>
                  <button 
                    onClick={() => setActiveTab('proposal')}
                    className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider rounded transition ${
                      activeTab === 'proposal' ? 'bg-indigo-600/15 text-indigo-600 border border-indigo-200' : 'text-gray-400 hover:text-gray-500'
                    }`}
                  >
                    Bidding Proposal
                  </button>
                </div>

                <div className="p-6">
                  
                  {}
                  {activeTab === 'diff' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Visual Changes comparison</h5>
                          <p className="text-[10px] text-gray-400 mt-0.5">Line-by-line diff comparing baseline resume text to optimized ATS structure</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleRegenResume}
                            disabled={regenResumeLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-100 rounded text-xs text-gray-700 transition font-semibold"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${regenResumeLoading ? 'animate-spin' : ''}`} /> Re-Tailor
                          </button>
                          
                          {}
                          <a 
                            href={`/api/applications/${aiOutput.application_id}/download-pdf`}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-xs text-white transition font-semibold shadow-md shadow-blue-500/10"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </a>
                          <a 
                            href={`/api/applications/${aiOutput.application_id}/download-docx`}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-slate-750 rounded text-xs text-gray-700 transition font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" /> Word
                          </a>
                        </div>
                      </div>

                      {renderVisualDiff(currentResume.resume_text, aiOutput.tailored_resume_text)}
                    </div>
                  )}

                  {}
                  {activeTab === 'letter' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Targeted Cover Letter</h5>
                          <p className="text-[10px] text-gray-400 mt-0.5">Optimized for <strong className="text-gray-500">{currentJob.company}</strong> in <strong className="text-gray-500">{tone}</strong> tone</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleRegenLetter}
                            disabled={regenLetterLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-100 rounded text-xs text-gray-700 transition font-semibold"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${regenLetterLoading ? 'animate-spin' : ''}`} /> Regenerate
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(aiOutput.cover_letter);
                              alert('Copied cover letter to clipboard!');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-slate-750 rounded text-xs text-gray-700 transition font-semibold"
                          >
                            <Clipboard className="w-3.5 h-3.5" /> Copy
                          </button>
                        </div>
                      </div>

                      <textarea 
                        value={aiOutput.cover_letter}
                        onChange={e => setAiOutput({...aiOutput, cover_letter: e.target.value})}
                        className="w-full h-80 bg-gray-50 border border-slate-900 rounded-lg p-4 font-mono text-[10px] text-gray-700 outline-none focus:border-blue-500 leading-relaxed resize-none"
                      />
                    </div>
                  )}

                  {}
                  {activeTab === 'proposal' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Freelance Bid Proposal</h5>
                          <p className="text-[10px] text-gray-400 mt-0.5">Compiled matching budgets ({budget}) and delivery schedules ({timeline})</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleRegenProposal}
                            disabled={regenProposalLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-100 rounded text-xs text-gray-700 transition font-semibold"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${regenProposalLoading ? 'animate-spin' : ''}`} /> Regenerate
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(aiOutput.proposal);
                              alert('Copied proposal to clipboard!');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-slate-750 rounded text-xs text-gray-700 transition font-semibold"
                          >
                            <Clipboard className="w-3.5 h-3.5" /> Copy
                          </button>
                        </div>
                      </div>

                      <textarea 
                        value={aiOutput.proposal}
                        onChange={e => setAiOutput({...aiOutput, proposal: e.target.value})}
                        className="w-full h-80 bg-gray-50 border border-slate-900 rounded-lg p-4 font-mono text-[10px] text-gray-700 outline-none focus:border-blue-500 leading-relaxed resize-none"
                      />
                    </div>
                  )}

                </div>
              </div>

              {}
              <div className="glass-panel p-6 rounded-xl space-y-4 border border-blue-500/10 bg-indigo-600/5">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" /> Human Review Verification Checklist
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Review and verify each tailored document. Checking these boxes confirms that formatting, required keywords, and parameters are approved before running form-fill browser script engines.
                </p>

                <div className="space-y-3.5 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer text-xs text-gray-700 font-semibold select-none">
                    <input 
                      type="checkbox" 
                      checked={verifiedResume}
                      onChange={e => setVerifiedResume(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-200 bg-gray-50 focus:ring-0 accent-blue-500 mt-0.5"
                    />
                    <span>Verify and Approve tailored ATS resume structure [✓]</span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer text-xs text-gray-700 font-semibold select-none">
                    <input 
                      type="checkbox" 
                      checked={verifiedLetter}
                      onChange={e => setVerifiedLetter(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-200 bg-gray-50 focus:ring-0 accent-blue-500 mt-0.5"
                    />
                    <span>Verify and Approve custom tailored cover letter [✓]</span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer text-xs text-gray-700 font-semibold select-none">
                    <input 
                      type="checkbox" 
                      checked={verifiedProposal}
                      onChange={e => setVerifiedProposal(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-200 bg-gray-50 focus:ring-0 accent-blue-500 mt-0.5"
                    />
                    <span>Verify and Approve bidding proposal parameters [✓]</span>
                  </label>
                </div>

                {allVerified && (
                  <div className="pt-4 border-t border-gray-200/80 flex items-center justify-end animate-fadeIn">
                    <button 
                      onClick={startAutomation}
                      disabled={isRunning}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 transition font-bold text-xs uppercase tracking-wider text-white rounded-lg flex items-center gap-2 glow-blue shadow-lg shadow-blue-500/10 animate-bounce"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Approve & Submit Application
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {}
        <div className="space-y-8">
          
          {}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Automation Status Tracker</h4>
            
            <div className="space-y-3.5 text-xs font-medium">
              <div className="flex items-center justify-between">
                <span className="text-slate-450">Launch Browser Node</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  checklist.browser === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                  checklist.browser === 'running' ? 'bg-indigo-50 text-indigo-600 border-blue-500/15 animate-pulse' :
                  checklist.browser === 'failed' ? 'bg-rose-500/10 text-rose-450 border-rose-500/15' : 
                  'bg-gray-50 text-gray-400 border-transparent'
                }`}>{checklist.browser}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-455">Navigate to Portal</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  checklist.navigate === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                  checklist.navigate === 'running' ? 'bg-indigo-50 text-indigo-600 border-blue-500/15 animate-pulse' :
                  checklist.navigate === 'failed' ? 'bg-rose-500/10 text-rose-455 border-rose-500/15' : 
                  'bg-gray-50 text-gray-400 border-transparent'
                }`}>{checklist.navigate}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-455">Populate Contact Details</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  checklist.login === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                  checklist.login === 'running' ? 'bg-indigo-50 text-indigo-600 border-blue-500/15 animate-pulse' :
                  checklist.login === 'failed' ? 'bg-rose-500/10 text-rose-455 border-rose-500/15' : 
                  'bg-gray-50 text-gray-400 border-transparent'
                }`}>{checklist.login === 'success' ? 'success' : checklist.login === 'running' ? 'running' : checklist.login}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-455">Inject Matching Skills Matrix</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  checklist.formFill === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                  checklist.formFill === 'running' ? 'bg-indigo-50 text-indigo-600 border-blue-500/15 animate-pulse' :
                  checklist.formFill === 'failed' ? 'bg-rose-500/10 text-rose-455 border-rose-500/15' : 
                  'bg-gray-50 text-gray-400 border-transparent'
                }`}>{checklist.formFill === 'success' ? 'success' : checklist.formFill === 'running' ? 'running' : checklist.formFill}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-455">Upload Tailored PDF Document</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  checklist.resumeUpload === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                  checklist.resumeUpload === 'running' ? 'bg-indigo-50 text-indigo-600 border-blue-500/15 animate-pulse' :
                  checklist.resumeUpload === 'failed' ? 'bg-rose-500/10 text-rose-455 border-rose-500/15' : 
                  'bg-gray-50 text-gray-400 border-transparent'
                }`}>{checklist.resumeUpload === 'success' ? 'success' : checklist.resumeUpload === 'running' ? 'running' : checklist.resumeUpload}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-455">Submit Application</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  checklist.submit === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                  checklist.submit === 'running' ? 'bg-indigo-50 text-indigo-600 border-blue-500/15 animate-pulse' :
                  checklist.submit === 'failed' ? 'bg-rose-500/10 text-rose-455 border-rose-500/15' : 
                  'bg-gray-50 text-gray-400 border-transparent'
                }`}>{checklist.submit}</span>
              </div>
            </div>
          </div>

          {}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-500" /> Active Screen Preview
            </h4>
            
            <div className="aspect-video bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative">
              {activeScreenshot ? (
                <img 
                  src={activeScreenshot} 
                  alt="Playwright runner stream capture" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-gray-300 p-6 space-y-2">
                  <MonitorPlay className="w-8 h-8 text-slate-700 mx-auto" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider">Awaiting Browser Session Trigger</p>
                </div>
              )}
            </div>
          </div>

          {}
          <div className="glass-panel p-6 rounded-xl flex flex-col h-[320px]">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500" /> Live Terminal Logs
            </h4>
            
            <div className="flex-1 bg-gray-50 rounded-lg p-4 font-mono text-[10px] overflow-y-auto leading-relaxed border border-slate-905">
              {consoleLogs.length === 0 ? (
                <span className="text-gray-300 block">Console stream idle...</span>
              ) : (
                consoleLogs.map((log, idx) => (
                  <div key={idx} className="mb-2 last:mb-0">
                    <span className="text-gray-400">[{new Date(log.created_at || Date.now()).toLocaleTimeString()}]</span>{' '}
                    <span className={
                      log.status === 'success' ? 'text-emerald-400' :
                      log.status === 'error' ? 'text-rose-450 font-bold' :
                      log.status === 'warning' ? 'text-amber-400' : 'text-indigo-600'
                    }>
                      {log.action}
                    </span>:{' '}
                    <span className="text-gray-700">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

