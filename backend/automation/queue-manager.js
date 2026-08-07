import { Queue, Worker } from 'bullmq';
import { query, queryOne, logActivity } from '../database/db.js';
import { runAutomation } from './runner.js';
import * as aiService from '../services/aiService.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../socket.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connection = {
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
};

export const jobQueue = new Queue('applicationQueue', { connection });

let activeQueueRunId = null;

export function getActiveQueueRunId() {
  return activeQueueRunId;
}

export function stopQueue() {
  // Future: pause bullmq queue
}

export const worker = new Worker('applicationQueue', async (job) => {
  const { queueRunId, itemId, candidateId, jobId, position } = job.data;
  const io = getIO();
  activeQueueRunId = queueRunId;

  await query("UPDATE queue_items SET status='running', started_at=CURRENT_TIMESTAMP WHERE id=$1", [itemId]);
  if (io) {
    io.emit('queue_item_update', {
      queueRunId, itemId, candidateId, jobId, status: 'running', position
    });
  }

  try {
    const candidate = await queryOne('SELECT * FROM resumes WHERE id=$1', [candidateId]);
    const dbJob = await queryOne('SELECT * FROM jobs WHERE id=$1', [jobId]);

    if (!candidate || !dbJob) throw new Error('Candidate or job not found');

    if (io) io.emit('queue_item_log', { itemId, message: `Tailoring resume for ${candidate.candidate_name} → ${dbJob.title}` });

    let tailored = null;
    try {
      tailored = await aiService.tailorResume({
        resumeText: candidate.resume_text,
        jobDescription: dbJob.description,
        jobTitle: dbJob.title,
        company: dbJob.company,
        tone: 'Professional',
        budget: candidate.preferred_salary || '',
        timeline: candidate.notice_period || '',
        portfolioLinks: `${candidate.linkedin_url || ''} ${candidate.portfolio_url || ''}`.trim(),
      });
    } catch (tailorErr) {
      if(io) io.emit('queue_item_log', { itemId, message: `AI tailor warning: ${tailorErr.message}` });
    }

    const appId = `app_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const website = dbJob.ats_platform || dbJob.url || 'generic';

    await query(`
      INSERT INTO applications (
        id, resume_id, job_id, queue_item_id, status,
        tailored_resume_text, cover_letter, proposal,
        score, original_score, ats_score,
        matched_skills, missing_skills, match_recommendations, website
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      appId, candidateId, jobId, itemId, 'pending',
      tailored?.tailored_resume_text || candidate.resume_text || '',
      tailored?.cover_letter || '',
      tailored?.proposal || '',
      tailored?.score || 0,
      tailored?.original_score || 0,
      tailored?.ats_estimate || 0,
      JSON.stringify(tailored?.matched_skills || []),
      JSON.stringify(tailored?.missing_skills || []),
      JSON.stringify(tailored?.recommendations || []),
      website,
    ]);

    await query("UPDATE queue_items SET application_id=$1 WHERE id=$2", [appId, itemId]);

    logActivity({
      action: 'automation_started',
      message: `Queue: Automation started for ${candidate.candidate_name} → ${dbJob.title}`,
      entityType: 'application', entityId: appId, status: 'info',
    });

    await runAutomation(appId, io);

    const result = await queryOne("SELECT status FROM applications WHERE id=$1", [appId]);
    const success = result?.status === 'success';

    if (success) {
      await query("UPDATE queue_items SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=$1", [itemId]);
      logActivity({
        action: 'automation_success',
        message: `Queue: ${candidate.candidate_name} applied to ${dbJob.title}`,
        entityType: 'application', entityId: appId, status: 'success',
      });
    } else {
      await query("UPDATE queue_items SET status='failed', completed_at=CURRENT_TIMESTAMP, error_message=$1 WHERE id=$2", [result?.status || 'unknown failure', itemId]);
    }
    
    await query("UPDATE queue_runs SET completed = completed + $1, failed = failed + $2 WHERE id=$3", [success ? 1 : 0, success ? 0 : 1, queueRunId]);
    
    const run = await queryOne("SELECT * FROM queue_runs WHERE id=$1", [queueRunId]);
    if(io) {
      io.emit('queue_progress', {
        queueRunId, total: run.total, completed: run.completed, failed: run.failed,
        status: 'running', currentItemId: itemId
      });
    }

  } catch (err) {
    await query("UPDATE queue_items SET status='failed', completed_at=CURRENT_TIMESTAMP, error_message=$1 WHERE id=$2", [err.message, itemId]);
    await query("UPDATE queue_runs SET failed = failed + 1 WHERE id=$1", [queueRunId]);
    if(io) io.emit('queue_item_log', { itemId, message: `Error: ${err.message}` });
    throw err;
  }
}, { 
  connection,
  concurrency: 1 
});

worker.on('completed', async (job) => {
  const run = await queryOne("SELECT * FROM queue_runs WHERE id=$1", [job.data.queueRunId]);
  if (run && (run.completed + run.failed >= run.total)) {
    await query("UPDATE queue_runs SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=$1", [job.data.queueRunId]);
    const io = getIO();
    if(io) io.emit('queue_progress', { queueRunId: run.id, total: run.total, completed: run.completed, failed: run.failed, status: 'done' });
    activeQueueRunId = null;
  }
});
