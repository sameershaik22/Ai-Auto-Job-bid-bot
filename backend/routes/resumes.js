import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { query, queryOne, logActivity } from '../database/db.js';
import * as aiService from '../services/aiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${sanitizedName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt === '.pdf' || fileExt === '.docx' || fileExt === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file extension. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

const router = express.Router();

const handleFileUploadMiddleware = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size limit exceeded. Maximum size allowed is 10MB.' });
      }
      return res.status(400).json({ error: `Upload validation error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

router.get('/', async (req, res) => {
  try {
    const resumes = await query('SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    const parsedResumes = resumes.map(r => ({
      ...r,
      skills: r.skills ? r.skills.split(',') : [],
      categories: r.categories ? r.categories.split(',') : [],
      technologies: r.technologies ? r.technologies.split(',') : [],
      experience: JSON.parse(r.experience || '[]'),
      education: JSON.parse(r.education || '[]')
    }));
    res.json(parsedResumes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export function cleanCandidateName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  let clean = rawName.replace(/\.[^/.]+$/, '');
  clean = clean.replace(/[-_]/g, ' ');
  
  const noiseWords = ['resume', 'cv', 'curriculum', 'vitae', 'sde', 'swe', 'software', 'engineer', 'engineering', 'developer', 'fullstack', 'backend', 'frontend', 'profile', 'latest', 'updated', 'final', 'pdf', 'docx', 'txt', 'copy', 'doc'];
  const regex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
  clean = clean.replace(regex, '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  
  const words = clean.split(/\s+/).filter(w => w.length >= 2);
  if (words.length >= 1) {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return '';
}

export function cleanLocation(rawLoc) {
  if (!rawLoc || typeof rawLoc !== 'string') return 'Hyderabad, India';
  let cleaned = rawLoc
    .replace(/professional summary/gi, '')
    .replace(/summary/gi, '')
    .replace(/curriculum vitae|resume|profile|contact|email|phone/gi, '')
    .replace(/sameer|shaik|[0-9+()]/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const knownMatch = rawLoc.match(/\b(Hyderabad|Bangalore|Bengaluru|Delhi|Mumbai|Pune|Chennai|Kolkata|Noida|Gurgaon|San Francisco|San Jose|New York|Seattle|Austin|Chicago|London|Toronto|Vancouver|Singapore)\b/i);
  if (knownMatch) {
    const city = knownMatch[1];
    if (/india|in\b/i.test(rawLoc) || /hyderabad|bangalore|bengaluru|delhi|mumbai|pune|chennai|kolkata|noida|gurgaon/i.test(city)) {
      return `${city}, India`;
    }
    if (/ca|california|ny|new york|tx|texas|wa|washington/i.test(rawLoc)) {
      return `${city}, USA`;
    }
    return city;
  }

  const commaMatch = cleaned.match(/\b([A-Za-z\s]+),\s*([A-Za-z\s]+)\b/);
  if (commaMatch) {
    const cityPart = commaMatch[1].trim();
    const countryPart = commaMatch[2].trim();
    if (cityPart.length > 2 && countryPart.length >= 2) {
      return `${cityPart}, ${countryPart}`;
    }
  }

  return (cleaned.length >= 3 && cleaned.length < 35) ? cleaned : 'Hyderabad, India';
}

router.post('/ingest', handleFileUploadMiddleware, async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    tempFilePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let resume_text = '';
    let resume_pdf = null;
    let resume_docx = null;

    if (fileExt === '.pdf') {
      try {
        const fileBuffer = fs.readFileSync(tempFilePath);
        if (fileBuffer.length > 0) {
          const pdfData = await pdfParse(fileBuffer);
          resume_text = pdfData.text || '';
        }
      } catch (parseErr) {
        console.warn(`PDF parse notice for ${req.file.originalname}: ${parseErr.message}`);
      }
      if (!resume_text.trim()) {
        const baseNameClean = req.file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        resume_text = `${baseNameClean}\nExperienced Professional Resume\nFile: ${req.file.originalname}`;
      }
      resume_pdf = `/uploads/${req.file.filename}`;
    } else if (fileExt === '.txt') {
      resume_text = fs.readFileSync(tempFilePath, 'utf8');
    } else {
      const baseNameClean = req.file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      resume_text = `${baseNameClean}\nDocument Ingested: ${req.file.originalname}`;
      resume_docx = `/uploads/${req.file.filename}`;
    }

    const extracted = await aiService.extractSkills(resume_text);
    const textName = aiService.extractCandidateNameFromText(resume_text);
    const filenameName = req.file ? cleanCandidateName(req.file.originalname) : '';

    let parsedCandidateName = (extracted.candidate_name && extracted.candidate_name.toLowerCase() !== 'candidate profile' && extracted.candidate_name.toLowerCase() !== 'name')
      ? extracted.candidate_name
      : (textName || filenameName || 'Candidate Profile');

    parsedCandidateName = cleanCandidateName(parsedCandidateName) || parsedCandidateName;

    const emailMatch = resume_text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    const phoneMatch = resume_text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
    let cleanPhone = phoneMatch ? phoneMatch[0].trim() : '';
    if (cleanPhone && (cleanPhone.includes('201') || cleanPhone.includes('202')) && cleanPhone.includes('-')) {
      cleanPhone = '';
    }

    const locationMatch = resume_text.match(/(?:Location|Address|City|Based in|Lives in):\s*([A-Za-z0-9\s,.-]{3,35})/i) ||
      resume_text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2,}\b|\bHyderabad\b|\bBangalore\b|\bBengaluru\b|\bDelhi\b|\bMumbai\b|\bSan Francisco\b|\bNew York\b|\bLondon\b)/i);

    const rawLoc = extracted.location || (locationMatch ? (locationMatch[1] || locationMatch[0]).trim() : '');
    const cleanLoc = cleanLocation(rawLoc);

    const linkedinMatch = resume_text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9%_-]+/i);
    const githubMatch = resume_text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9%_-]+/i);
    
    const portfolioMatch = resume_text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:dev|io|me|com|co|net|org)\/?[a-zA-Z0-9%_-]*/i);
    let portfolioUrl = '';
    if (portfolioMatch && !portfolioMatch[0].includes('linkedin') && !portfolioMatch[0].includes('github')) {
      portfolioUrl = portfolioMatch[0].startsWith('http') ? portfolioMatch[0] : `https://${portfolioMatch[0]}`;
    }

    const textLower = resume_text.toLowerCase();
    let detectedRole = 'Software Engineer';
    if (textLower.includes('ai/ml') || textLower.includes('machine learning') || textLower.includes('deep learning')) detectedRole = 'AI/ML Engineer';
    else if (textLower.includes('pm') || textLower.includes('product manager') || textLower.includes('product lead')) detectedRole = 'Product Manager (PM)';
    else if (textLower.includes('fullstack') || textLower.includes('full stack')) detectedRole = 'Full Stack Engineer';
    else if (textLower.includes('frontend') || textLower.includes('react')) detectedRole = 'Frontend Engineer';
    else if (textLower.includes('backend') || textLower.includes('node')) detectedRole = 'Backend Engineer';

    const skillStr = Array.isArray(extracted.skills) ? extracted.skills.slice(0, 6).join(', ') : (extracted.skills || 'software development');
    let autoSummary = extracted.summary || '';
    if (!autoSummary || autoSummary.trim().length < 15) {
      autoSummary = `Experienced ${detectedRole} with background in ${skillStr}. Proven track record of designing high-performance software applications and delivering technical solutions.`;
    }

    const profileTitle = `${parsedCandidateName}'s Profile`;

    const result = {
      success: true,
      name: profileTitle,
      candidate_name: parsedCandidateName,
      target_role: detectedRole,
      email: emailMatch ? emailMatch[0] : (extracted.email || ''),
      phone: cleanPhone || extracted.phone || '',
      location: cleanLoc,
      linkedin_url: linkedinMatch ? (linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`) : (extracted.linkedin_url || ''),
      github_url: githubMatch ? (githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`) : (extracted.github_url || ''),
      portfolio_url: portfolioUrl || extracted.portfolio_url || '',
      skills: skillStr,
      summary: autoSummary,
      years_of_experience: extracted.years_of_experience || 5,
      resume_text: resume_text,
      resume_pdf,
      resume_docx
    };

    res.json(result);
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', handleFileUploadMiddleware, async (req, res) => {
  let tempFilePath = null;
  try {
    let name = req.body.name;
    let candidate_name = req.body.candidate_name;
    let resume_text = req.body.resume_text || '';
    let resume_pdf = null;
    let resume_docx = null;
    const overwrite = req.body.overwrite === 'true';

    if (req.file) {
      tempFilePath = req.file.path;
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      
      if (!name) name = req.file.originalname.replace(fileExt, '');

      if (fileExt === '.pdf') {
        try {
          const fileBuffer = fs.readFileSync(tempFilePath);
          if (fileBuffer.length === 0) throw new Error('PDF file buffer is empty.');
          const pdfData = await pdfParse(fileBuffer);
          resume_text = pdfData.text || '';
          
          if (!resume_text.trim()) throw new Error('No readable text contents found in PDF.');
          resume_pdf = `/uploads/${req.file.filename}`;
        } catch (parseErr) {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          return res.status(400).json({ error: `Corrupted or invalid PDF structure: ${parseErr.message}` });
        }
      } else if (fileExt === '.txt') {
        resume_text = fs.readFileSync(tempFilePath, 'utf8');
      } else {
        resume_text = `[DOCX TEXT INGESTED] File: ${req.file.originalname}`;
        resume_docx = `/uploads/${req.file.filename}`;
      }
    }

    if (!resume_text || !resume_text.trim()) {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: 'Resume contents cannot be empty. Please upload a file or paste text.' });
    }

    const extracted = await aiService.extractSkills(resume_text);
    const textName = aiService.extractCandidateNameFromText(resume_text);
    const filenameName = req.file ? cleanCandidateName(req.file.originalname) : '';

    let parsedCandidateName = candidate_name || (extracted.candidate_name && extracted.candidate_name.toLowerCase() !== 'candidate profile' && extracted.candidate_name.toLowerCase() !== 'name' ? extracted.candidate_name : textName) || filenameName || 'Candidate Profile';

    candidate_name = cleanCandidateName(parsedCandidateName) || parsedCandidateName;
    if (!name || name.toLowerCase().includes('resume') || name.toLowerCase().includes('sde') || name.endsWith('.pdf') || name.endsWith('.docx')) {
      name = `${candidate_name}'s Profile`;
    }

    const prefixToCheck = resume_text.substring(0, 100);
    const existingDuplicate = await queryOne(`
      SELECT id, name, resume_pdf, resume_docx FROM resumes 
      WHERE user_id = ? AND candidate_name = ? AND (resume_text LIKE ? OR name = ?)
    `, [req.user.id, candidate_name, `%${prefixToCheck}%`, name]);

    if (existingDuplicate) {
      if (!overwrite) {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(409).json({
          duplicate: true,
          existingId: existingDuplicate.id,
          existingName: existingDuplicate.name,
          message: `A profile for "${candidate_name}" named "${existingDuplicate.name}" already exists in the vault. Do you want to overwrite it?`
        });
      } else {
        if (existingDuplicate.resume_pdf) {
          const oldPath = path.join(__dirname, '../public', existingDuplicate.resume_pdf);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        if (existingDuplicate.resume_docx) {
          const oldPath = path.join(__dirname, '../public', existingDuplicate.resume_docx);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await query('DELETE FROM resumes WHERE id = ? AND user_id = ? AND user_id = ?', [existingDuplicate.id, req.user.id]);
      }
    }

    const id = `res_${Date.now()}`;
    const skillsStr = (extracted.skills || []).map(s => s.toUpperCase()).join(',');
    const expStr = JSON.stringify(extracted.experience || []);
    const eduStr = JSON.stringify(extracted.education || []);
    const catStr = (extracted.categories || []).join(',');
    const techStr = (extracted.technologies || []).join(',');

    await query(`
      INSERT INTO resumes (
        id, user_id, user_id, name, candidate_name, skills, experience, summary, education, 
        resume_text, years_of_experience, categories, technologies, resume_pdf, resume_docx, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, req.user.id, name, candidate_name, skillsStr, expStr, extracted.summary || '', eduStr, 
      resume_text, extracted.years_of_experience || 6, catStr, techStr, resume_pdf, resume_docx, 'active'
    ]);

    logActivity({
      action: 'resume_uploaded',
      message: `Resume "${name}" uploaded for ${candidate_name}`,
      entityType: 'resume', entityId: id, status: 'success',
      metadata: { resume: name, candidate: candidate_name },
      notifTitle: 'Resume Uploaded',
      notifType: 'resume', actionUrl: 'resumes',
    });

    res.status(201).json({
      success: true,
      data: {
        id, name, candidate_name,
        skills: extracted.skills || [],
        experience: extracted.experience || [],
        education: extracted.education || [],
        summary: extracted.summary || '',
        years_of_experience: extracted.years_of_experience || 6,
        categories: extracted.categories || [],
        technologies: extracted.technologies || [],
        resume_pdf, resume_docx, status: 'active'
      }
    });
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, candidate_name, skills, experience, summary, education, resume_text, years_of_experience, categories, technologies } = req.body;
    
    const skillsStr = Array.isArray(skills) ? skills.map(s => s.toUpperCase()).join(',') : (skills || '');
    const expStr = Array.isArray(experience) ? JSON.stringify(experience) : (experience || '[]');
    const eduStr = Array.isArray(education) ? JSON.stringify(education) : (education || '[]');
    const catStr = Array.isArray(categories) ? categories.join(',') : (categories || '');
    const techStr = Array.isArray(technologies) ? technologies.join(',') : (technologies || '');

    await query(`
      UPDATE resumes 
      SET name = ?, candidate_name = ?, skills = ?, experience = ?, summary = ?, 
          education = ?, resume_text = ?, years_of_experience = ?, categories = ?, technologies = ?, updated_at = ?
      WHERE id = ?
    `, [
      name, candidate_name, skillsStr, expStr, summary, 
      eduStr, resume_text, parseInt(years_of_experience) || 0, catStr, techStr, new Date().toISOString(), req.params.id, req.user.id
    ]);

    const updated = await queryOne('SELECT name, candidate_name FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    logActivity({
      action: 'resume_updated',
      message: `Resume "${updated?.name || req.params.id}" was edited`,
      entityType: 'resume', entityId: req.params.id, status: 'info',
      metadata: { resume: updated?.name, candidate: updated?.candidate_name },
      notifTitle: 'Resume Updated', notifType: 'resume', actionUrl: 'resumes',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/clone', async (req, res) => {
  try {
    const src = await queryOne('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!src) return res.status(404).json({ error: 'Source resume not found.' });

    const id = `res_${Date.now()}`;
    const clonedName = `${src.name} (Clone)`;

    await query(`
      INSERT INTO resumes (
        id, name, candidate_name, skills, experience, summary, education, 
        resume_text, years_of_experience, categories, technologies, resume_pdf, resume_docx, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, req.user.id, clonedName, src.candidate_name, src.skills, src.experience, src.summary, src.education, 
      src.resume_text, src.years_of_experience, src.categories, src.technologies, src.resume_pdf, src.resume_docx, src.status
    ]);

    logActivity({
      action: 'resume_cloned',
      message: `Resume cloned as "${clonedName}"`,
      entityType: 'resume', entityId: id, status: 'info',
      metadata: { resume: clonedName }, notifTitle: 'Resume Cloned',
      notifType: 'resume', actionUrl: 'resumes',
    });
    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const resume = await queryOne('SELECT status FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const nextStatus = resume.status === 'archived' ? 'active' : 'archived';
    await query('UPDATE resumes SET status = ? WHERE id = ? AND user_id = ?', [nextStatus, req.params.id, req.user.id]);

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const resume = await queryOne('SELECT resume_pdf, resume_docx FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (resume) {
      if (resume.resume_pdf) {
        const fullPath = path.join(__dirname, '../public', resume.resume_pdf);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      if (resume.resume_docx) {
        const fullPath = path.join(__dirname, '../public', resume.resume_docx);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    }
    
    const toDelete = await queryOne('SELECT name, candidate_name FROM resumes WHERE id = ?', [req.params.id]);
    await query('DELETE FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    logActivity({
      action: 'resume_deleted',
      message: `Resume "${toDelete?.name || req.params.id}" deleted from vault`,
      entityType: 'resume', entityId: req.params.id, status: 'warning',
      metadata: { resume: toDelete?.name, candidate: toDelete?.candidate_name },
      notifTitle: 'Resume Deleted', notifType: 'resume', actionUrl: 'resumes',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
