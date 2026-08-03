import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, queryOne } from '../database/db.js';
import MockPortalPlugin from './plugins/mock_portal.js';
import LeverPlugin from './plugins/lever.js';
import GreenhousePlugin from './plugins/greenhouse.js';
import GenericPlugin from './plugins/generic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let geminiClient = null;
if (process.env.GEMINI_API_KEY) {
  geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function detectATSFromUrl(url) {
  if (!url) return 'generic';
  const u = url.toLowerCase();
  if (u.includes('mock-recruiter') || u.includes('localhost')) return 'mock_portal';
  if (u.includes('jobs.lever.co') || u.includes('lever.co/')) return 'lever';
  if (u.includes('boards.greenhouse.io') || u.includes('greenhouse.io')) return 'greenhouse';
  if (u.includes('ashbyhq.com') || u.includes('jobs.ashbyhq.com')) return 'ashby';
  if (u.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (u.includes('workday.com') || u.includes('myworkdayjobs.com')) return 'workday';
  return 'generic';
}

export async function runAutomation(applicationId, io) {
  const startTime = Date.now();
  let browser = null;
  let page = null;
  let retryCount = 0;

  console.log(`Starting automation for Application ID: ${applicationId}`);

  const app = await queryOne(`
    SELECT a.*,
      r.candidate_name, r.skills, r.resume_text,
      r.email, r.phone, r.location,
      r.linkedin_url, r.portfolio_url, r.github_url,
      r.preferred_salary, r.notice_period, r.visa_status,
      r.languages, r.years_of_experience,
      j.title as job_title, j.company, j.url as job_url, j.ats_platform, j.description as job_description
    FROM applications a
    JOIN resumes r ON a.resume_id = r.id
    JOIN jobs j ON a.job_id = j.id
    WHERE a.id = $1
  `, [applicationId]);

  if (!app) {
    console.error(`Application not found: ${applicationId}`);
    return;
  }

  await query('UPDATE applications SET status=$1 WHERE id=$2', ['running', applicationId]);
  await query('UPDATE jobs SET status=$1 WHERE id=$2', ['applying', app.job_id]);
  io.emit('application_update', { id: applicationId, status: 'running' });

  const createLog = async (action, message, status = 'info', screenshotPath = null) => {
    const duration = Date.now() - startTime;
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await query(`
      INSERT INTO logs (id, application_id, action, message, status, screenshot_path, duration, retry_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [logId, applicationId, action, message, status, screenshotPath, duration, retryCount]);
    io.emit('automation_log', {
      application_id: applicationId, action, message, status,
      screenshot_path: screenshotPath, duration, created_at: new Date().toISOString()
    });
  };

  const logger = {
    info:       (msg)         => createLog('STEP_UPDATE',  msg,                       'info'),
    success:    (msg)         => createLog('STEP_SUCCESS', msg,                       'success'),
    warning:    (msg)         => createLog('STEP_WARNING', msg,                       'warning'),
    error:      (msg, detail) => createLog('STEP_ERROR',   `${msg} ${detail||''}`.trim(), 'error'),
    screenshot: (name, fp)    => createLog('SCREENSHOT',   `Screenshot: ${name}`,     'info', fp),
  };

  try {
    const uploadsDir = path.resolve(__dirname, '../public/uploads');
    const screenshotsDir = path.resolve(__dirname, '../public/screenshots');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    const safeName = (app.candidate_name || 'candidate').replace(/\s+/g, '_');
    let resumeFilePath = null;
    if (app.resume_pdf) {
      const pdfAbs = path.resolve(__dirname, '../public', app.resume_pdf.replace(/^\//, ''));
      if (fs.existsSync(pdfAbs)) resumeFilePath = pdfAbs;
    }
    if (!resumeFilePath && app.resume_docx) {
      const docxAbs = path.resolve(__dirname, '../public', app.resume_docx.replace(/^\//, ''));
      if (fs.existsSync(docxAbs)) resumeFilePath = docxAbs;
    }
    if (!resumeFilePath) {
      resumeFilePath = path.join(uploadsDir, `resume_${safeName}_${applicationId}.pdf`);
      fs.writeFileSync(resumeFilePath, app.tailored_resume_text || app.resume_text || 'Resume Content');
    }

    const isHeadless = process.env.HEADLESS === 'true';
    const maxRetries = 3;
    let result = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      retryCount = attempt - 1;
      try {
        if (browser) await browser.close().catch(() => {});
        browser = await chromium.launch({
          headless: isHeadless,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars',
            '--window-size=1280,800'
          ]
        });

        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        page = await context.newPage();
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const jobUrl = app.job_url || '';
        const detectedATS = detectATSFromUrl(jobUrl) || app.ats_platform || app.website || 'generic';

        if (attempt === 1) {
          await logger.info(`ATS detected: ${detectedATS.toUpperCase()}`);
        } else {
          await logger.warning(`Retry Attempt ${attempt}/${maxRetries} for ${app.candidate_name}...`);
        }

        let pluginInstance;
        switch (detectedATS) {
          case 'lever':
            pluginInstance = new LeverPlugin(page, logger, {});
            break;
          case 'greenhouse':
            pluginInstance = new GreenhousePlugin(page, logger, {});
            break;
          case 'mock_portal':
            pluginInstance = new MockPortalPlugin(page, logger, {});
            break;
          default:
            pluginInstance = new GenericPlugin(page, logger, { gemini: geminiClient });
            break;
        }

        const appWithUrl = { ...app, url: jobUrl };
        result = await pluginInstance.run(appWithUrl, resumeFilePath);

        if (result && result.success) break;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        await logger.warning(`Attempt ${attempt} notice: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const screenshotPath = path.join(screenshotsDir, `final_${applicationId}.png`);
    if (page) await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    await logger.screenshot('final_state', `/screenshots/final_${applicationId}.png`);

    if (result && result.success) {
      const responseMsg = result.trackingId ? `Submitted (Tracking ID: ${result.trackingId})` : (result.message || 'Submitted');
      await query(
        "UPDATE applications SET status='success', submitted_at=$1, response=$2 WHERE id=$3",
        [new Date().toISOString(), responseMsg, applicationId]
      );
      await query('UPDATE jobs SET status=$1 WHERE id=$2', ['applied', app.job_id]);
      await logger.success(`Application submitted for ${app.candidate_name} → ${app.job_title}`);
      io.emit('application_update', { id: applicationId, status: 'success' });
    } else {
      throw new Error(result?.message || 'Plugin returned failure');
    }

  } catch (error) {
    console.error('Automation error:', error.message);
    await logger.error('Automation failed:', error.message);
    await query(
      "UPDATE applications SET status='failed', response=$1 WHERE id=$2",
      [error.message, applicationId]
    );
    await query('UPDATE jobs SET status=$1 WHERE id=$2', ['failed', app.job_id]);
    io.emit('application_update', { id: applicationId, status: 'failed' });
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
}
