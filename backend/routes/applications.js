import express from 'express';
import { query, queryOne, logActivity } from '../database/db.js';
import { runAutomation } from '../automation/runner.js';
import { getIO } from '../socket.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const apps = await query('SELECT * FROM applications ORDER BY created_at DESC');
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { resume_id, job_id, website } = req.body;
    if (!resume_id || !job_id || !website) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const id = `app_${Date.now()}`;
    await query(`
      INSERT INTO applications (id, resume_id, job_id, website, status)
      VALUES (?, ?, ?, ?, ?)
    `, [id, resume_id, job_id, website, 'pending']);
    
    const resume = await queryOne('SELECT name, candidate_name FROM resumes WHERE id = ?', [resume_id]);
    const job = await queryOne('SELECT title, company FROM jobs WHERE id = ?', [job_id]);

    logActivity({
      action: 'application_queued',
      message: `Queued automation to apply for "${job?.title}" at ${job?.company}`,
      entityType: 'application', entityId: id, status: 'info',
      metadata: { resume: resume?.candidate_name, job: job?.title, company: job?.company, portal: website },
      notifTitle: 'Automation Queued', notifType: 'automation', actionUrl: 'automation',
    });

    res.status(201).json({ success: true, id, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const { 
      resume_id, job_id, website, 
      tailored_resume_text, cover_letter, proposal, 
      match_score, ats_score, ai_suggestions 
    } = req.body;

    if (!resume_id || !job_id) {
      return res.status(400).json({ error: 'Missing resume_id or job_id' });
    }

    const id = `app_${Date.now()}`;
    await query(`
      INSERT INTO applications (
        id, resume_id, job_id, website, status, 
        tailored_resume_text, cover_letter, proposal, score, response
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, resume_id, job_id, website || 'unknown', 'saved',
      tailored_resume_text || null, cover_letter || null, proposal || null, 
      match_score || 0, JSON.stringify({ ats_score, ai_suggestions })
    ]);
    
    const job = await queryOne('SELECT title, company FROM jobs WHERE id = ?', [job_id]);

    logActivity({
      action: 'application_saved',
      message: `Saved AI-tailored application draft for "${job?.title}"`,
      entityType: 'application', entityId: id, status: 'success',
      metadata: { job: job?.title, company: job?.company },
      notifTitle: 'Application Saved', notifType: 'application', actionUrl: 'applications',
    });

    res.status(201).json({ success: true, id, status: 'saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const appRecord = await queryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!appRecord) return res.status(404).json({ error: 'Application not found' });
    if (appRecord.status === 'running') return res.status(400).json({ error: 'Already running' });

    await query('UPDATE applications SET status = ? WHERE id = ?', ['running', req.params.id]);
    
    logActivity({
      action: 'automation_started',
      message: `Started application runner for ${appRecord.website}`,
      entityType: 'automation', entityId: req.params.id, status: 'info',
      metadata: { application_id: req.params.id, portal: appRecord.website },
      notifTitle: 'Automation Started', notifType: 'automation', actionUrl: 'automation',
    });

    runAutomation(req.params.id, getIO()).catch(e => console.error('Automation error:', e));
    
    res.json({ success: true, status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM applications WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/interview-prep', async (req, res) => {
  try {
    const appRecord = await queryOne('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRecord) return res.status(404).json({ error: 'Application not found' });

    if (appRecord.interview_prep) {
      return res.json({ success: true, interview_prep: JSON.parse(appRecord.interview_prep) });
    }

    const job = await queryOne('SELECT * FROM jobs WHERE id = $1', [appRecord.job_id]);
    const resume = await queryOne('SELECT * FROM resumes WHERE id = $1', [appRecord.resume_id]);
    if (!job || !resume) return res.status(404).json({ error: 'Job or Resume not found' });

    const { generateInterviewPrep } = await import('../services/aiService.js');
    const resumeText = appRecord.tailored_resume_text || resume.resume_text || '';
    
    const prepData = await generateInterviewPrep(job.title, job.company, job.description, resumeText);
    
    await query('UPDATE applications SET interview_prep = $1 WHERE id = $2', [JSON.stringify(prepData), req.params.id]);

    res.json({ success: true, interview_prep: prepData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
