import React, { useState, useEffect } from 'react';
import {
  User, Plus, Trash2, Upload, Edit2, X, Search, CheckCircle,
  Mail, Phone, MapPin, Linkedin, Globe, Github, DollarSign,
  Clock, Shield, Languages, Award, Briefcase, FileText, Save,
  ChevronDown, ChevronUp, RefreshCw, AlertCircle
} from 'lucide-react';

const EMPTY_PROFILE = {
  candidate_name: '', email: '', phone: '', location: '',
  linkedin_url: '', portfolio_url: '', github_url: '',
  preferred_salary: '', notice_period: '', visa_status: '',
  languages: '', certifications: '', projects: '',
  skills: '', summary: '',
  years_of_experience: 0, resume_text: '',
};

const VISA_OPTIONS = [
  'US Citizen', 'Green Card', 'H1-B Visa', 'OPT / STEM OPT', 'TN Visa',
  'L1 Visa', 'O1 Visa', 'UK Citizen', 'EU Citizen', 'Authorized to work',
  'Requires sponsorship', 'Other'
];

const NOTICE_OPTIONS = [
  'Immediately available', '1 week', '2 weeks', '1 month', '2 months', '3 months'
];

export default function CandidateProfiles() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStep, setUploadStep] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates');
      const data = await res.json();
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load candidates:', err);
    }
  };

  useEffect(() => { fetchCandidates(); }, []);

  const openNew = () => {
    setForm(EMPTY_PROFILE);
    setEditProfile(null);
    setUploadFile(null);
    setUploadStep('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setForm({
      candidate_name: c.candidate_name || '',
      email: c.email || '',
      phone: c.phone || '',
      location: c.location || '',
      linkedin_url: c.linkedin_url || '',
      portfolio_url: c.portfolio_url || '',
      github_url: c.github_url || '',
      preferred_salary: c.preferred_salary || '',
      notice_period: c.notice_period || '',
      visa_status: c.visa_status || '',
      languages: c.languages || '',
      certifications: c.certifications || '',
      projects: c.projects || '',
      skills: c.skills || '',
      summary: c.summary || '',
      years_of_experience: c.years_of_experience || 0,
      resume_text: c.resume_text || '',
    });
    setEditProfile(c);
    setUploadFile(null);
    setUploadStep('');
    setShowModal(true);
  };

  const handleFileChange = async (file) => {
    if (!file) return;
    setUploadFile(file);
    setUploadStep('uploading');

    const fd = new FormData();
    fd.append('resume', file);

    try {
      const res = await fetch('/api/resumes/ingest', { method: 'POST', body: fd });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errJson.error || 'Upload failed');
      }
      const data = await res.json();
      setUploadStep('parsed');
      setForm(prev => ({
        ...prev,
        candidate_name: prev.candidate_name || data.candidate_name || file.name.replace(/\.[^/.]+$/, ''),
        email: data.email || prev.email || '',
        phone: data.phone || prev.phone || '',
        location: data.location || prev.location || '',
        linkedin_url: data.linkedin_url || prev.linkedin_url || '',
        github_url: data.github_url || prev.github_url || '',
        skills: typeof data.skills === 'string' ? data.skills : (Array.isArray(data.skills) ? data.skills.join(', ') : (prev.skills || '')),
        summary: data.summary || prev.summary || '',
        years_of_experience: data.years_of_experience || prev.years_of_experience || 0,
        resume_text: data.resume_text || prev.resume_text || '',
      }));
    } catch (err) {
      setUploadStep('error');
      console.error('Ingest upload error:', err);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleSave = async () => {
    if (!form.candidate_name.trim()) {
      alert('Candidate name is required');
      return;
    }
    setSaving(true);
    try {
      const url = editProfile ? `/api/candidates/${editProfile.id}` : '/api/candidates';
      const method = editProfile ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchCandidates();
      setShowModal(false);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this candidate profile?')) return;
    await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
    await fetchCandidates();
  };

  const filtered = candidates.filter(c =>
    !search || c.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.skills?.toLowerCase().includes(search.toLowerCase())
  );

  const field = (key, placeholder, type = 'text') => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[key] || ''}
      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
        color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box'
      }}
    />
  );

  const sectionLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, marginTop: 20 }}>
      {text}
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Candidate Profiles</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {candidates.length} profile{candidates.length !== 1 ? 's' : ''} · Select profiles in the Queue to run automation
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Search profiles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, width: 200 }}
            />
          </div>
          <button onClick={openNew} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            <Plus size={15} /> Add Candidate
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <User size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No candidate profiles yet</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Add a profile to start automating applications</div>
          <button onClick={openNew} style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Add Your First Candidate
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(c => {
            const isExpanded = expandedId === c.id;
            const skills = c.skills ? c.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6) : [];
            return (
              <div key={c.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                overflow: 'hidden', transition: 'box-shadow 0.2s'
              }}>
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0
                      }}>
                        {c.candidate_name?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{c.candidate_name}</div>
                          {c.name && (
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', fontWeight: 700,
                              border: '1px solid rgba(99,102,241,0.3)'
                            }}>
                              🎯 {c.name}
                            </span>
                          )}
                        </div>
                        {c.email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.email}</div>}
                        {c.location && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.location}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(c)} style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)' }}><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(c.id)} style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                    {c.years_of_experience > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><Briefcase size={11} style={{ marginRight: 3 }} />{c.years_of_experience}y exp</span>}
                    {c.visa_status && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><Shield size={11} style={{ marginRight: 3 }} />{c.visa_status}</span>}
                    {c.notice_period && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><Clock size={11} style={{ marginRight: 3 }} />{c.notice_period}</span>}
                    {c.preferred_salary && <span style={{ fontSize: 11, color: '#22c55e' }}><DollarSign size={11} style={{ marginRight: 1 }} />{c.preferred_salary}</span>}
                  </div>

                  {skills.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 12 }}>
                      {skills.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', fontWeight: 600 }}>{s}</span>
                      ))}
                    </div>
                  )}

                  <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 12,
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12
                  }}>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {isExpanded ? 'Show less' : 'View full profile'}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', background: 'var(--bg-secondary)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {c.phone && <div style={{ color: 'var(--text-muted)' }}><Phone size={12} style={{ marginRight: 6 }} />{c.phone}</div>}
                    {c.linkedin_url && <div><Linkedin size={12} style={{ marginRight: 6, color: '#0077b5' }} /><a href={c.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#0077b5' }}>{c.linkedin_url}</a></div>}
                    {c.github_url && <div><Github size={12} style={{ marginRight: 6 }} /><a href={c.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)' }}>{c.github_url}</a></div>}
                    {c.portfolio_url && <div><Globe size={12} style={{ marginRight: 6 }} /><a href={c.portfolio_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{c.portfolio_url}</a></div>}
                    {c.languages && <div style={{ color: 'var(--text-muted)' }}><Languages size={12} style={{ marginRight: 6 }} />Languages: {c.languages}</div>}
                    {c.certifications && <div style={{ color: 'var(--text-muted)' }}><Award size={12} style={{ marginRight: 6 }} />Certs: {c.certifications}</div>}
                    {c.summary && <div style={{ color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{c.summary.substring(0, 200)}{c.summary.length > 200 ? '...' : ''}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 640,
            maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--border)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editProfile ? 'Edit Candidate Profile' : 'New Candidate Profile'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer',
                  background: dragActive ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
                  marginBottom: 4
                }}
                onClick={() => document.getElementById('cv-file-input').click()}
              >
                <input id="cv-file-input" type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={e => handleFileChange(e.target.files[0])} />
                <Upload size={24} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                {uploadStep === 'uploading' && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Uploading & parsing resume with AI...</div>}
                {uploadStep === 'parsed' && <div style={{ color: '#22c55e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><CheckCircle size={14} /> Resume parsed! Fields auto-filled below.</div>}
                {uploadStep === 'error' && <div style={{ color: '#ef4444', fontSize: 13 }}>Parse failed. Fill fields manually.</div>}
                {!uploadStep && (
                  <>
                    <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>Drop resume PDF here</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>AI will auto-fill the fields below</div>
                  </>
                )}
              </div>

              {sectionLabel('Profile & Personal Info')}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  🎯 Target Role / Resume Title * (e.g. AI/ML, ML, PM, Full Stack)
                </label>
                {field('name', 'e.g. AI/ML Engineer Resume')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Name *</label>
                  {field('candidate_name', 'Sameer Shaik')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
                  {field('email', 'sameer@email.com', 'email')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Phone</label>
                  {field('phone', '+1 (555) 000-0000')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Location</label>
                  {field('location', 'New York, NY')}
                </div>
              </div>

              {sectionLabel('Online Profiles')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>LinkedIn URL</label>
                  {field('linkedin_url', 'https://linkedin.com/in/username')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GitHub URL</label>
                  {field('github_url', 'https://github.com/username')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Portfolio / Website</label>
                  {field('portfolio_url', 'https://myportfolio.com')}
                </div>
              </div>

              {sectionLabel('Application Preferences')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Preferred Salary</label>
                  {field('preferred_salary', '$120,000 / year')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notice Period</label>
                  <select
                    value={form.notice_period || ''}
                    onChange={e => setForm(p => ({ ...p, notice_period: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
                  >
                    <option value="">Select...</option>
                    {NOTICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Work Authorization</label>
                  <select
                    value={form.visa_status || ''}
                    onChange={e => setForm(p => ({ ...p, visa_status: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}
                  >
                    <option value="">Select...</option>
                    {VISA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Years of Experience</label>
                  <input
                    type="number" min={0} max={50}
                    value={form.years_of_experience || 0}
                    onChange={e => setForm(p => ({ ...p, years_of_experience: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {sectionLabel('Skills & Additional Info')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Languages</label>
                  {field('languages', 'English, Hindi, Spanish')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Skills (comma separated)</label>
                  <textarea
                    placeholder="React, Node.js, PostgreSQL, Docker..."
                    value={form.skills || ''}
                    onChange={e => setForm(p => ({ ...p, skills: e.target.value }))}
                    rows={2}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Certifications</label>
                  {field('certifications', 'AWS Certified, Google Cloud, PMP...')}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Professional Summary</label>
                  <textarea
                    placeholder="Brief professional summary..."
                    value={form.summary || ''}
                    onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Resume Text (for AI)</label>
                  <textarea
                    placeholder="Paste full resume text here..."
                    value={form.resume_text || ''}
                    onChange={e => setForm(p => ({ ...p, resume_text: e.target.value }))}
                    rows={5}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: 'var(--bg-card)' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                borderRadius: 8, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer'
              }}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
