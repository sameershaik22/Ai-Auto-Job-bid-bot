import express from 'express';
import { query, queryOne, logActivity } from '../database/db.js';
import * as aiService from '../services/aiService.js';
import { scrapeJobUrl } from '../services/scraperService.js';

const router = express.Router();

function detectATSPlatform(url) {
  if (!url) return 'generic';
  const u = url.toLowerCase();
  if (u.includes('jobs.lever.co') || u.includes('lever.co/')) return 'lever';
  if (u.includes('boards.greenhouse.io') || u.includes('greenhouse.io')) return 'greenhouse';
  if (u.includes('ashbyhq.com') || u.includes('jobs.ashbyhq.com')) return 'ashby';
  if (u.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (u.includes('workday.com') || u.includes('myworkdayjobs.com')) return 'workday';
  if (u.includes('taleo.net')) return 'taleo';
  if (u.includes('icims.com')) return 'icims';
  if (u.includes('bamboohr.com')) return 'bamboohr';
  if (u.includes('localhost') || u.includes('mock-recruiter')) return 'mock_portal';
  return 'generic';
}

router.get('/', async (req, res) => {
  try {
    const jobs = await query('SELECT * FROM jobs ORDER BY created_at DESC');
    const parsedJobs = jobs.map(j => {
      let recData = { recommendations: [], confidence_reason: '', reasoning: '', ratings: {} };
      try { if (j.match_recommendations) recData = JSON.parse(j.match_recommendations); } catch (e) {}

      let mSkills = [];
      try { if (j.matched_skills) mSkills = JSON.parse(j.matched_skills); } catch (e) {}

      let misSkills = [];
      try { if (j.missing_skills) misSkills = JSON.parse(j.missing_skills); } catch (e) {}

      return {
        ...j,
        skills_required: j.skills_required ? j.skills_required.split(',') : [],
        matched_skills: mSkills,
        missing_skills: misSkills,
        match_recommendations: recData
      };
    });
    res.json(parsedJobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url' });
    const details = await scrapeJobUrl(url);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: `Failed to scrape page: ${err.message}` });
  }
});

router.post('/', async (req, res) => {
  try {
    const { url, title, company, description, skills_required, location, salary } = req.body;
    if (!url || !title || !company || !description) {
      return res.status(400).json({ error: 'Missing required parameters: url, title, company, description' });
    }

    const existing = await queryOne('SELECT id FROM jobs WHERE url = ?', [url]);
    if (existing) return res.status(409).json({ error: 'A job posting with this URL already exists.' });

    const id = `job_${Date.now()}`;
    const skillsStr = Array.isArray(skills_required) ? skills_required.join(',') : (skills_required || '');

    const activeResumes = await query("SELECT id, name, resume_text FROM resumes WHERE status = 'active'");
    let bestScore = 0, bestResumeId = null, bestResumeName = null;
    let bestConfidence = 'Low', bestAtsScore = 0;
    let bestMatchedSkills = '[]', bestMissingSkills = '[]', bestRecommendations = '{}';

    if (activeResumes.length > 0) {
      for (const resItem of activeResumes) {
        try {
          const match = await aiService.matchResumeAndJob(resItem.resume_text, description);
          if (match.score > bestScore) {
            bestScore = match.score;
            bestResumeId = resItem.id;
            bestResumeName = resItem.name;
            bestConfidence = match.confidence || 'Medium';
            bestAtsScore = match.ats_estimate || 0;
            bestMatchedSkills = JSON.stringify(match.matched_skills || []);
            bestMissingSkills = JSON.stringify(match.missing_skills || []);
            bestRecommendations = JSON.stringify({
              recommendations: match.recommendations || [],
              confidence_reason: match.confidence_reason || '',
              reasoning: match.reasoning || '',
              ratings: match.ratings || {}
            });
          }
        } catch (matchErr) {}
      }
    }

    const atsPlatform = detectATSPlatform(url);

    await query(`
      INSERT INTO jobs (
        id, url, title, company, description, skills_required, location, salary,
        ats_platform,
        match_score, recommended_resume_id, recommended_resume_name, match_confidence,
        matched_skills, missing_skills, match_recommendations, ats_score, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      id, url, title, company, description, skillsStr, location || 'Remote', salary || 'TBD',
      atsPlatform,
      bestScore, bestResumeId, bestResumeName, bestConfidence,
      bestMatchedSkills, bestMissingSkills, bestRecommendations, bestAtsScore, 'unapplied'
    ]);

    logActivity({
      action: 'job_imported',
      message: `Job "${title}" at ${company} imported (${bestScore}% match)`,
      entityType: 'job', entityId: id, status: 'success',
      metadata: { job: title, company, match_score: bestScore, location },
      notifTitle: 'New Job Imported', notifType: 'job', actionUrl: 'jobs',
    });

    res.status(201).json({
      success: true,
      data: {
        id, url, title, company, description, skills_required, location, salary,
        match_score: bestScore, recommended_resume_id: bestResumeId,
        recommended_resume_name: bestResumeName, match_confidence: bestConfidence, status: 'unapplied'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, company, description, skills_required, location, salary } = req.body;
    const skillsStr = Array.isArray(skills_required) ? skills_required.join(',') : (skills_required || '');

    const activeResumes = await query("SELECT id, name, resume_text FROM resumes WHERE status = 'active'");
    let bestScore = 0, bestResumeId = null, bestResumeName = null;
    let bestConfidence = 'Low', bestAtsScore = 0;
    let bestMatchedSkills = '[]', bestMissingSkills = '[]', bestRecommendations = '{}';

    if (activeResumes.length > 0) {
      for (const resItem of activeResumes) {
        try {
          const match = await aiService.matchResumeAndJob(resItem.resume_text, description);
          if (match.score > bestScore) {
            bestScore = match.score;
            bestResumeId = resItem.id;
            bestResumeName = resItem.name;
            bestConfidence = match.confidence || 'Medium';
            bestAtsScore = match.ats_estimate || 0;
            bestMatchedSkills = JSON.stringify(match.matched_skills || []);
            bestMissingSkills = JSON.stringify(match.missing_skills || []);
            bestRecommendations = JSON.stringify({
              recommendations: match.recommendations || [],
              confidence_reason: match.confidence_reason || '',
              reasoning: match.reasoning || '',
              ratings: match.ratings || {}
            });
          }
        } catch (matchErr) {}
      }
    }

    await query(`
      UPDATE jobs 
      SET title = ?, company = ?, description = ?, skills_required = ?, location = ?, salary = ?,
          match_score = ?, recommended_resume_id = ?, recommended_resume_name = ?, match_confidence = ?,
          matched_skills = ?, missing_skills = ?, match_recommendations = ?, ats_score = ?
      WHERE id = ?
    `, [
      title, company, description, skillsStr, location || 'Remote', salary || 'TBD',
      bestScore, bestResumeId, bestResumeName, bestConfidence, 
      bestMatchedSkills, bestMissingSkills, bestRecommendations, bestAtsScore, req.params.id
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const toDelete = await queryOne('SELECT title, company FROM jobs WHERE id = ?', [req.params.id]);
    await query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    logActivity({
      action: 'job_deleted',
      message: `Job "${toDelete?.title || req.params.id}" removed from board`,
      entityType: 'job', entityId: req.params.id, status: 'warning',
      metadata: { job: toDelete?.title, company: toDelete?.company },
      notify: false,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
