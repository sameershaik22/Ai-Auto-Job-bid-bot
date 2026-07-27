import express from 'express';
import { queryOne } from '../database/db.js';
import * as aiService from '../services/aiService.js';

const router = express.Router();

async function fetchEntities(req, res) {
  const { resume_id, job_id } = req.body;
  if (!resume_id || !job_id) {
    res.status(400).json({ error: 'Missing resume_id or job_id.' });
    return null;
  }
  const resume = await queryOne('SELECT resume_text, candidate_name, skills FROM resumes WHERE id = ?', [resume_id]);
  const job = await queryOne('SELECT description, title, company FROM jobs WHERE id = ?', [job_id]);

  if (!resume || !job) {
    res.status(404).json({ error: 'Resume or Job not found.' });
    return null;
  }
  return { resume, job };
}

router.post('/match', async (req, res) => {
  try {
    const data = await fetchEntities(req, res);
    if (!data) return;

    console.log(`[AI] Matching resume ${req.body.resume_id} to job ${req.body.job_id}...`);
    const matchResults = await aiService.matchResumeAndJob(data.resume.resume_text, data.job.description);
    res.json(matchResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tailor', async (req, res) => {
  try {
    const data = await fetchEntities(req, res);
    if (!data) return;

    const { tone } = req.body;
    console.log(`[AI] Tailoring resume with tone: ${tone || 'Professional'}...`);

    const tailoredText = await aiService.tailorResume(data.resume.resume_text, data.job.description, tone);
    
    res.json({ tailored_resume: tailoredText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cover-letter', async (req, res) => {
  try {
    const data = await fetchEntities(req, res);
    if (!data) return;

    const { tone } = req.body;
    console.log(`[AI] Generating cover letter with tone: ${tone || 'Professional'}...`);
    
    const coverLetter = await aiService.generateCoverLetter(data.resume.resume_text, data.job.description, tone);
    
    res.json({ cover_letter: coverLetter });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/proposal', async (req, res) => {
  try {
    const data = await fetchEntities(req, res);
    if (!data) return;

    const { budget, timeline, portfolio_links } = req.body;
    console.log(`[AI] Generating freelance proposal...`);
    
    const proposal = await aiService.generateProposal(
      data.resume.resume_text, 
      data.job.description, 
      budget, 
      timeline, 
      portfolio_links
    );
    
    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
