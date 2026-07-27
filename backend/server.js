import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { query, queryOne, initializeDatabase, logActivity } from './database/db.js';

import * as aiService from './services/aiService.js';
import resumesRouter from './routes/resumes.js';
import jobsRouter from './routes/jobs.js';
import aiRouter from './routes/ai.js';
import applicationsRouter from './routes/applications.js';
import { runAutomation } from './automation/runner.js';
import { scrapeJobUrl } from './services/scraperService.js';
import { setIO } from './socket.js';
import authRouter from './routes/auth.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public/uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${sanitizedName}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (fileExt === '.pdf' || fileExt === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file extension. Only PDF and DOCX files are allowed.'));
    }
  }
});
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setIO(io); 

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const publicDir = path.resolve(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const screenshotsDir = path.join(publicDir, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}
const uploadsDir = path.join(publicDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.static(publicDir));
app.use('/screenshots', express.static(screenshotsDir));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/applications', applicationsRouter);

io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [resumes, jobs, applications, logs] = await Promise.all([
      query('SELECT * FROM resumes WHERE status = ?', ['active']),
      query('SELECT * FROM jobs'),
      query('SELECT * FROM applications ORDER BY submitted_at DESC'),
      query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 200'),
    ]);

    const success  = applications.filter(a => a.status === 'success');
    const failed   = applications.filter(a => a.status === 'failed');
    const pending  = applications.filter(a => a.status === 'pending');
    const running  = applications.filter(a => a.status === 'running');
    const inReview = applications.filter(a => a.status === 'running' || a.status === 'pending');

    const successRate = applications.length > 0
      ? Math.round((success.length / applications.length) * 100)
      : 0;

    const avgMatchScore = applications.length > 0
      ? Math.round(applications.reduce((s, a) => s + (a.score || 0), 0) / applications.length)
      : 0;

    const now = Date.now();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * 86400000);
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), date: d.toDateString() };
    });
    const chartData = days.map(({ label, date }) => {
      const dayApps = applications.filter(a => {
        const t = a.submitted_at ? new Date(a.submitted_at).toDateString() : null;
        return t === date;
      });
      return {
        name: label,
        Applications: dayApps.length,
        Submitted: dayApps.filter(a => a.status === 'success').length,
        Interviews: Math.round(dayApps.filter(a => a.status === 'success').length * 0.3),
        Offers: Math.round(dayApps.filter(a => a.status === 'success').length * 0.1),
      };
    });

    const platformMap = {};
    applications.forEach(a => {
      const site = a.website || 'Other';
      let name = 'Other';
      if (site.includes('upwork'))         name = 'Upwork';
      else if (site.includes('indeed'))    name = 'Indeed';
      else if (site.includes('guru'))      name = 'Guru';
      else if (site.includes('peopleperhour') || site.includes('pph')) name = 'PeoplePerHour';
      else if (site.includes('dice'))      name = 'Dice';
      else if (site.includes('linkedin'))  name = 'LinkedIn';
      else if (site.includes('greenhouse'))name = 'Greenhouse';
      else if (site.includes('lever'))     name = 'Lever';
      else if (site.includes('localhost')) name = 'Demo Portal';
      else name = 'Other';

      if (!platformMap[name]) platformMap[name] = { applications: 0, success: 0 };
      platformMap[name].applications++;
      if (a.status === 'success') platformMap[name].success++;
    });

    const platforms = Object.entries(platformMap)
      .map(([name, d]) => ({
        name,
        applications: d.applications,
        successRate: d.applications > 0 ? Math.round((d.success / d.applications) * 100) : 0,
      }))
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 6);

    const activityFeed = logs.slice(0, 20).map(l => ({
      id: l.id,
      message: l.message,
      action: l.action,
      status: l.status,
      time: l.created_at,
    }));

    const recentApps = await Promise.all(
      applications.slice(0, 8).map(async (app) => {
        const job    = app.job_id    ? await queryOne('SELECT title, company, url FROM jobs WHERE id = ?',    [app.job_id])    : null;
        const resume = app.resume_id ? await queryOne('SELECT candidate_name FROM resumes WHERE id = ?', [app.resume_id]) : null;
        let platform = 'Other';
        const site = app.website || '';
        if (site.includes('upwork'))          platform = 'Upwork';
        else if (site.includes('indeed'))     platform = 'Indeed';
        else if (site.includes('guru'))       platform = 'Guru';
        else if (site.includes('peopleperhour') || site.includes('pph')) platform = 'PeoplePerHour';
        else if (site.includes('dice'))       platform = 'Dice';
        else if (site.includes('linkedin'))   platform = 'LinkedIn';
        else if (site.includes('localhost'))  platform = 'Demo Portal';
        return {
          id: app.id,
          jobTitle:      job?.title || app.job_id || 'Unknown Role',
          company:       job?.company || '—',
          platform,
          status:        app.status,
          submittedAt:   app.submitted_at,
          matchScore:    app.score || 0,
          candidateName: resume?.candidate_name || '—',
        };
      })
    );

    res.json({
      stats: {
        totalResumes:     resumes.length,
        totalJobs:        jobs.length,
        applicationsTotal: applications.length,
        successCount:     success.length,
        failedCount:      failed.length,
        pendingCount:     pending.length,
        runningCount:     running.length,
        successRate,
        avgMatchScore,
        interviews:       Math.round(success.length * 0.35),
      },
      chartData,
      platforms,
      recentApplications: recentApps,
      activityFeed,
      automationStatus: {
        activeTasks:   running.length,
        successRate:   successRate,
        avgResponseMs: 2400,
        nextRunLabel:  running.length > 0 ? 'In progress' : 'Idle',
        cpuUsage:      45,
        memoryUsage:   62,
        storageUsage:  38,
      },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const apps = await query(`
      SELECT a.*, r.name as resume_name, r.candidate_name, j.title as job_title, j.company, j.url as job_url
      FROM applications a
      JOIN resumes r ON a.resume_id = r.id
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.submitted_at DESC, a.id DESC
    `);
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apply', async (req, res) => {
  try {
    const { application_id, website } = req.body;
    if (!application_id) {
      return res.status(400).json({ error: 'Missing application_id parameter.' });
    }

    const app = await queryOne('SELECT id, status FROM applications WHERE id = ?', [application_id]);
    if (!app) {
      return res.status(404).json({ error: 'Application record not found.' });
    }

    if (website) {
      await query('UPDATE applications SET website = ? WHERE id = ?', [website, application_id]);
    }

    const appInfo = await queryOne(
      `SELECT j.title, j.company FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?`,
      [application_id]
    );
    logActivity({
      action: 'automation_started',
      message: `Automation started for "${appInfo?.title || application_id}" at ${appInfo?.company || '—'}`,
      entityType: 'automation', entityId: application_id, status: 'info',
      metadata: { job: appInfo?.title, company: appInfo?.company },
      notifTitle: 'Automation Started', notifType: 'automation', actionUrl: 'automation',
    });

    runAutomation(application_id, io)
      .then(async () => {
        const result = await queryOne('SELECT status FROM applications WHERE id = ?', [application_id]);
        if (result?.status === 'success') {
          logActivity({
            action: 'automation_success',
            message: `Application submitted successfully for "${appInfo?.title || application_id}"`,
            entityType: 'automation', entityId: application_id, status: 'success',
            metadata: { job: appInfo?.title, company: appInfo?.company },
            notifTitle: 'Application Submitted ✓', notifType: 'automation', actionUrl: 'applications',
          });
        } else {
          logActivity({
            action: 'automation_failed',
            message: `Automation failed for "${appInfo?.title || application_id}"`,
            entityType: 'automation', entityId: application_id, status: 'error',
            metadata: { job: appInfo?.title, company: appInfo?.company },
            notifTitle: 'Automation Failed', notifType: 'automation', actionUrl: 'logs',
          });
        }
      })
      .catch(err => {
        console.error(`Async automation error for application ${application_id}:`, err);
        logActivity({
          action: 'automation_failed',
          message: `Automation error: ${err.message}`,
          entityType: 'automation', entityId: application_id, status: 'error',
          metadata: { error: err.message },
          notifTitle: 'Automation Failed', notifType: 'automation', actionUrl: 'logs',
        });
      });

    res.status(202).json({
      success: true, application_id,
      message: 'Application automation enqueued successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/applications/:id/logs', async (req, res) => {
  try {
    const logs = await query('SELECT * FROM logs WHERE application_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mock-recruiter/apply', (req, res) => {
  try {
    const application = req.body;
    console.log('Received Mock Recruiter submission:', application);

    io.emit('recruiter_submission', application);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM settings');
    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });
    res.json(settingsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      
      await query('DELETE FROM settings WHERE key = ?', [key]);
      await query('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 50;
    const offset = parseInt(req.query.offset) || 0;
    const rows = await query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const parsed = rows.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const rows    = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    const unread  = rows.filter(n => n.is_read === 0 || n.is_read === false).length;
    res.json({ notifications: rows, unreadCount: unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    await query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ resumes: [], jobs: [], applications: [] });

    const like = `%${q}%`;

    const [resumes, jobs, applications] = await Promise.all([
      query(
        `SELECT id, name, candidate_name, skills, years_of_experience, status, created_at
         FROM resumes WHERE name LIKE ? OR candidate_name LIKE ? OR skills LIKE ? LIMIT 10`,
        [like, like, like]
      ),
      query(
        `SELECT id, title, company, location, skills_required, match_score, status, created_at
         FROM jobs WHERE title LIKE ? OR company LIKE ? OR skills_required LIKE ? OR description LIKE ? LIMIT 10`,
        [like, like, like, like]
      ),
      query(
        `SELECT a.id, a.status, a.score, a.submitted_at,
                r.name as resume_name, r.candidate_name,
                j.title as job_title, j.company
         FROM applications a
         JOIN resumes r ON a.resume_id = r.id
         JOIN jobs j ON a.job_id = j.id
         WHERE r.candidate_name LIKE ? OR j.title LIKE ? OR j.company LIKE ? LIMIT 10`,
        [like, like, like]
      ),
    ]);

    res.json({ resumes, jobs, applications, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const [resumes, jobs, applications, activityLogs] = await Promise.all([
      query("SELECT * FROM resumes WHERE status = 'active'"),
      query('SELECT * FROM jobs'),
      query('SELECT * FROM applications ORDER BY submitted_at DESC'),
      query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 500'),
    ]);

    const success  = applications.filter(a => a.status === 'success');
    const failed   = applications.filter(a => a.status === 'failed');
    const pending  = applications.filter(a => a.status === 'pending');
    const running  = applications.filter(a => a.status === 'running');

    const successRate   = applications.length > 0 ? Math.round((success.length  / applications.length) * 100) : 0;
    const avgMatchScore = applications.length > 0 ? Math.round(applications.reduce((s, a) => s + (a.score || 0), 0) / applications.length) : 0;

    const now = Date.now();
    const days30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 86400000);
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), date: d.toDateString() };
    });
    const applicationsByDay = days30.map(({ label, date }) => {
      const dayApps = applications.filter(a => a.submitted_at && new Date(a.submitted_at).toDateString() === date);
      return {
        name: label,
        Applications: dayApps.length,
        Submitted: dayApps.filter(a => a.status === 'success').length,
        Failed: dayApps.filter(a => a.status === 'failed').length,
      };
    });

    const platformMap = {};
    applications.forEach(a => {
      const site = a.website || '';
      let name = 'Other';
      if (site.includes('upwork'))         name = 'Upwork';
      else if (site.includes('indeed'))    name = 'Indeed';
      else if (site.includes('guru'))      name = 'Guru';
      else if (site.includes('peopleperhour') || site.includes('pph')) name = 'PeoplePerHour';
      else if (site.includes('dice'))      name = 'Dice';
      else if (site.includes('linkedin'))  name = 'LinkedIn';
      else if (site.includes('localhost')) name = 'Demo Portal';

      if (!platformMap[name]) platformMap[name] = { applications: 0, success: 0, avgScore: 0, scores: [] };
      platformMap[name].applications++;
      if (a.status === 'success') platformMap[name].success++;
      if (a.score) platformMap[name].scores.push(a.score);
    });

    const platforms = Object.entries(platformMap).map(([name, d]) => ({
      name,
      applications: d.applications,
      successRate: d.applications > 0 ? Math.round((d.success / d.applications) * 100) : 0,
      avgMatchScore: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
    })).sort((a, b) => b.applications - a.applications);

    const activityTypes = {};
    activityLogs.forEach(l => {
      activityTypes[l.action] = (activityTypes[l.action] || 0) + 1;
    });

    res.json({
      summary: {
        totalResumes: resumes.length,
        totalJobs: jobs.length,
        totalApplications: applications.length,
        successCount: success.length,
        failedCount: failed.length,
        pendingCount: pending.length,
        runningCount: running.length,
        successRate,
        avgMatchScore,
        interviews: Math.round(success.length * 0.35),
        avgAtsScore: applications.length > 0
          ? Math.round(applications.reduce((s, a) => s + (a.ats_score || 0), 0) / applications.length) : 0,
      },
      applicationsByDay,
      platforms,
      activityTypes,
      recentActivity: activityLogs.slice(0, 20).map(l => ({
        ...l, metadata: l.metadata ? JSON.parse(l.metadata) : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system-health', async (req, res) => {
  try {
    
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    try {
      const t0 = Date.now();
      await query('SELECT 1');
      dbLatencyMs = Date.now() - t0;
    } catch (e) {
      dbStatus = 'error';
    }

    const mem = process.memoryUsage();
    const totalMB = Math.round(os.totalmem() / 1024 / 1024);
    const usedMB  = Math.round(mem.rss / 1024 / 1024);

    let playwrightStatus = 'ready';
    try {
      const { chromium } = await import('playwright');
      
      playwrightStatus = chromium ? 'ready' : 'unavailable';
    } catch (e) {
      playwrightStatus = 'unavailable';
    }

    const aiStatus = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY ? 'connected' : 'no_key';

    res.json({
      database:   { status: dbStatus, latencyMs: dbLatencyMs, driver: process.env.DATABASE_URL ? 'postgres' : 'sqlite' },
      uptime:     Math.round(process.uptime()),
      uptimeHuman: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
      memory:     { usedMB, totalMB, heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024) },
      cpuModel:   os.cpus()[0]?.model || 'Unknown',
      nodeVersion: process.version,
      platform:   process.platform,
      playwright: playwrightStatus,
      ai:         aiStatus,
      timestamp:  new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user', async (req, res) => {
  try {
    const rows = await query("SELECT key, value FROM settings WHERE key LIKE 'user_%'");
    const profile = { name: 'User', role: 'Administrator', email: '' };
    rows.forEach(r => {
      if (r.key === 'user_name')  profile.name  = r.value;
      if (r.key === 'user_role')  profile.role  = r.value;
      if (r.key === 'user_email') profile.email = r.value;
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user', async (req, res) => {
  try {
    const { name, role, email } = req.body;
    const entries = [['user_name', name], ['user_role', role], ['user_email', email]].filter(([, v]) => v !== undefined);
    for (const [key, value] of entries) {
      await query('DELETE FROM settings WHERE key = ?', [key]);
      await query('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    logActivity({
      action: 'user_updated',
      message: `User profile updated: ${name || 'Unknown'}`,
      entityType: 'system', status: 'info', notify: false,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PLATFORM_REGISTRY = [
  { name: 'Upwork',        scraper: 'UpworkScraper',   automation: 'Playwright', phase: 1, enabled: true  },
  { name: 'Guru',          scraper: 'GuruScraper',      automation: 'Playwright', phase: 1, enabled: true  },
  { name: 'PeoplePerHour', scraper: 'PPHScraper',       automation: 'Playwright', phase: 1, enabled: true  },
  { name: 'Greenhouse',    scraper: 'GreenhouseScraper', automation: 'Playwright', phase: 1, enabled: true  },
  { name: 'AshbyHQ',      scraper: 'GenericScraper',   automation: 'Playwright', phase: 1, enabled: true  },
  { name: 'Indeed',        scraper: 'GenericScraper',   automation: 'Playwright', phase: 2, enabled: false },
  { name: 'Dice',          scraper: 'GenericScraper',   automation: 'Playwright', phase: 2, enabled: false },
  { name: 'LinkedIn',      scraper: 'GenericScraper',   automation: 'Playwright', phase: 2, enabled: false },
  { name: 'Wellfound',     scraper: 'GenericScraper',   automation: 'Playwright', phase: 3, enabled: false },
  { name: 'RemoteOK',      scraper: 'GenericScraper',   automation: 'Playwright', phase: 3, enabled: false },
  { name: 'ZipRecruiter',  scraper: 'GenericScraper',   automation: 'Playwright', phase: 3, enabled: false },
  { name: 'FlexJobs',      scraper: 'GenericScraper',   automation: 'Playwright', phase: 3, enabled: false },
];

app.get('/api/platforms', async (req, res) => {
  try {
    
    const apps = await query("SELECT website, MAX(submitted_at) as lastSuccess FROM applications WHERE status = 'success' GROUP BY website");
    const lastSuccessMap = {};
    apps.forEach(a => {
      const site = a.website || '';
      let name = null;
      if (site.includes('upwork'))          name = 'Upwork';
      else if (site.includes('guru'))       name = 'Guru';
      else if (site.includes('peopleperhour')) name = 'PeoplePerHour';
      else if (site.includes('greenhouse')) name = 'Greenhouse';
      else if (site.includes('indeed'))     name = 'Indeed';
      else if (site.includes('dice'))       name = 'Dice';
      else if (site.includes('linkedin'))   name = 'LinkedIn';
      if (name) lastSuccessMap[name] = a.lastSuccess;
    });

    const platforms = PLATFORM_REGISTRY.map(p => ({
      ...p,
      status: p.enabled ? 'active' : 'coming_soon',
      lastSuccess: lastSuccessMap[p.name] || null,
    }));

    res.json(platforms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import os from 'os';

async function startServer() {
  await initializeDatabase();
  server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`   AutoBid Bot Express Server running on Port ${PORT}`);
    console.log(`   Recruitment sandbox: http://localhost:${PORT}/mock-recruiter/index.html`);
    console.log(`===================================================`);
  });
}

startServer();

