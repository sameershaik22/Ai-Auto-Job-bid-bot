import express from 'express';
import { query, queryOne, logActivity } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const candidates = await query(
      "SELECT * FROM resumes WHERE status != 'archived' ORDER BY created_at DESC"
    );
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const candidate = await queryOne('SELECT * FROM resumes WHERE id = $1', [req.params.id]);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      candidate_name, email, phone, location,
      linkedin_url, portfolio_url, github_url,
      preferred_salary, notice_period, visa_status,
      languages, certifications, projects,
      skills, experience, summary, education,
      resume_text, years_of_experience,
      categories, technologies
    } = req.body;

    if (!candidate_name) {
      return res.status(400).json({ error: 'candidate_name is required' });
    }

    const id = `cand_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const name = `${candidate_name}'s Profile`;

    await query(`
      INSERT INTO resumes (
        id, name, candidate_name, email, phone, location,
        linkedin_url, portfolio_url, github_url,
        preferred_salary, notice_period, visa_status,
        languages, certifications, projects,
        skills, experience, summary, education,
        resume_text, years_of_experience, categories, technologies, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
    `, [
      id, name, candidate_name,
      email || null, phone || null, location || null,
      linkedin_url || null, portfolio_url || null, github_url || null,
      preferred_salary || null, notice_period || null, visa_status || null,
      languages || null, certifications || null, projects || null,
      skills || '', JSON.stringify(experience || []), summary || null,
      JSON.stringify(education || []), resume_text || '',
      years_of_experience || 0, categories || null, technologies || null,
      'active'
    ]);

    logActivity({
      action: 'candidate_created',
      message: `New candidate profile created: ${candidate_name}`,
      entityType: 'resume', entityId: id, status: 'success',
      notifTitle: 'Candidate Added', notifType: 'resume', actionUrl: 'profiles',
    });

    const created = await queryOne('SELECT * FROM resumes WHERE id = $1', [id]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      candidate_name, email, phone, location,
      linkedin_url, portfolio_url, github_url,
      preferred_salary, notice_period, visa_status,
      languages, certifications, projects,
      skills, experience, summary, education,
      resume_text, years_of_experience, categories, technologies
    } = req.body;

    await query(`
      UPDATE resumes SET
        candidate_name=$1, email=$2, phone=$3, location=$4,
        linkedin_url=$5, portfolio_url=$6, github_url=$7,
        preferred_salary=$8, notice_period=$9, visa_status=$10,
        languages=$11, certifications=$12, projects=$13,
        skills=$14, experience=$15, summary=$16, education=$17,
        resume_text=$18, years_of_experience=$19, categories=$20, technologies=$21,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$22
    `, [
      candidate_name, email || null, phone || null, location || null,
      linkedin_url || null, portfolio_url || null, github_url || null,
      preferred_salary || null, notice_period || null, visa_status || null,
      languages || null, certifications || null, projects || null,
      skills || '', JSON.stringify(experience || []), summary || null,
      JSON.stringify(education || []), resume_text || '',
      years_of_experience || 0, categories || null, technologies || null,
      req.params.id
    ]);

    const updated = await queryOne('SELECT * FROM resumes WHERE id = $1', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query("UPDATE resumes SET status = 'archived' WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
