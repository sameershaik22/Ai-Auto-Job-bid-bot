import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, queryOne } from '../database/db.js';
import MockPortalPlugin from './plugins/mock_portal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runAutomation(applicationId, io) {
  const startTime = Date.now();
  let browser = null;
  let page = null;
  let retryCount = 0;
  const maxRetries = 1;

  console.log(`Starting automation runner for Application ID: ${applicationId}`);

  const app = await queryOne(`
    SELECT a.*, r.candidate_name, r.skills, r.resume_text, j.title as job_title, j.company 
    FROM applications a
    JOIN resumes r ON a.resume_id = r.id
    JOIN jobs j ON a.job_id = j.id
    WHERE a.id = ?
  `, [applicationId]);

  if (!app) {
    console.error(`Application not found: ${applicationId}`);
    return;
  }

  await query('UPDATE applications SET status = ? WHERE id = ?', ['running', applicationId]);
  await query('UPDATE jobs SET status = ? WHERE id = ?', ['applying', app.job_id]);
  io.emit('application_update', { id: applicationId, status: 'running' });

  const createLog = async (action, message, status = 'info', screenshotPath = null) => {
    const duration = Date.now() - startTime;
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    await query(`
      INSERT INTO logs (id, application_id, action, message, status, screenshot_path, duration, retry_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [logId, applicationId, action, message, status, screenshotPath, duration, retryCount]);

    io.emit('automation_log', {
      application_id: applicationId,
      action,
      message,
      status,
      screenshot_path: screenshotPath,
      duration,
      created_at: new Date().toISOString()
    });
  };

  const logger = {
    info: (message) => createLog('STEP_UPDATE', message, 'info'),
    success: (message) => createLog('STEP_SUCCESS', message, 'success'),
    warning: (message) => createLog('STEP_WARNING', message, 'warning'),
    error: (message, details = '') => createLog('STEP_ERROR', `${message} ${details}`.trim(), 'error'),
    screenshot: (actionName, filepath) => createLog('SCREENSHOT', `Captured step screenshot: ${actionName}`, 'info', filepath)
  };

  try {
    
    const uploadsDir = path.resolve(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const screenshotsDir = path.resolve(__dirname, '../public/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const dummyResumePath = path.join(uploadsDir, `resume_${app.candidate_name.replace(/\s+/g, '_')}.pdf`);
    fs.writeFileSync(dummyResumePath, app.tailored_resume_text || app.resume_text || 'Mock PDF Content');

    await logger.info('Launching Chromium instance in headful stealth mode...');

    const isHeadless = process.env.HEADLESS === 'true';
    browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    page = await context.newPage();

    let pluginInstance = null;
    if (app.website === 'mock_portal' || app.website === 'lever' || app.website === 'greenhouse') {
      pluginInstance = new MockPortalPlugin(page, logger, {});
    } else {
      await logger.warning(`Site plugin for "${app.website}" not loaded. Using default demo sandbox plugin.`);
      pluginInstance = new MockPortalPlugin(page, logger, {});
    }

    const result = await pluginInstance.run(app, dummyResumePath);

    if (result && result.success) {
      await query(`
        UPDATE applications 
        SET status = 'success', submitted_at = ?, response = ? 
        WHERE id = ?
      `, [new Date().toISOString(), result.trackingId, applicationId]);
      
      await query('UPDATE jobs SET status = ? WHERE id = ?', ['applied', app.job_id]);
      
      await logger.success(`Automation completed successfully. Tracking ID: ${result.trackingId}`);
      io.emit('application_update', { id: applicationId, status: 'success' });
    }
  } catch (error) {
    console.error('Automation worker execution error:', error);
    await logger.error('Critical execution exception encountered:', error.message);

    await query(`
      UPDATE applications 
      SET status = 'failed', response = ? 
      WHERE id = ?
    `, [error.message, applicationId]);
    
    await query('UPDATE jobs SET status = ? WHERE id = ?', ['failed', app.job_id]);
    io.emit('application_update', { id: applicationId, status: 'failed' });
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed successfully.');
    }
  }
}
