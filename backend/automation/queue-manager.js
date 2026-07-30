import { query, queryOne, logActivity } from '../database/db.js';
import { runAutomation } from './runner.js';
import * as aiService from '../services/aiService.js';
import { v4 as uuidv4 } from 'uuid';

let activeQueueRunId = null;
let shouldStop = false;

export function stopQueue() {
  shouldStop = true;
}

export function getActiveQueueRunId() {
  return activeQueueRunId;
}

export async function processQueue(queueRunId, io) {
  activeQueueRunId = queueRunId;
  shouldStop = false;

  const items = await query(
    "SELECT * FROM queue_items WHERE queue_run_id = $1 AND status = 'queued' ORDER BY position ASC",
    [queueRunId]
  );

  const total = items.length;
  let completed = 0;
  let failed = 0;

  io.emit('queue_progress', { queueRunId, total, completed, failed, status: 'running' });

  for (const item of items) {
    if (shouldStop) {
      await query("UPDATE queue_items SET status='skipped' WHERE queue_run_id=$1 AND status='queued'", [queueRunId]);
      break;
    }

    await query(
      "UPDATE queue_items SET status='running', started_at=CURRENT_TIMESTAMP WHERE id=$1",
      [item.id]
    );

    io.emit('queue_item_update', {
      queueRunId, itemId: item.id,
      candidateId: item.candidate_id, jobId: item.job_id,
      status: 'running', position: item.position
    });

    try {
      const candidate = await queryOne('SELECT * FROM resumes WHERE id=$1', [item.candidate_id]);
      const job = await queryOne('SELECT * FROM jobs WHERE id=$1', [item.job_id]);

      if (!candidate || !job) throw new Error('Candidate or job not found');

      io.emit('queue_item_log', {
        itemId: item.id, message: `Tailoring resume for ${candidate.candidate_name} → ${job.title} at ${job.company}`
      });

      let tailored = null;
      try {
        tailored = await aiService.tailorResume({
          resumeText: candidate.resume_text,
          jobDescription: job.description,
          jobTitle: job.title,
          company: job.company,
          tone: 'Professional',
          budget: candidate.preferred_salary || '',
          timeline: candidate.notice_period || '',
          portfolioLinks: `${candidate.linkedin_url || ''} ${candidate.portfolio_url || ''}`.trim(),
        });
      } catch (tailorErr) {
        io.emit('queue_item_log', { itemId: item.id, message: `AI tailor warning: ${tailorErr.message}` });
      }

      const appId = `app_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      const website = job.ats_platform || job.url || 'generic';

      await query(`
        INSERT INTO applications (
          id, resume_id, job_id, queue_item_id, status,
          tailored_resume_text, cover_letter, proposal,
          score, original_score, ats_score,
          matched_skills, missing_skills, match_recommendations,
          website
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `, [
        appId, item.candidate_id, item.job_id, item.id, 'pending',
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

      await query("UPDATE queue_items SET application_id=$1 WHERE id=$2", [appId, item.id]);

      logActivity({
        action: 'automation_started',
        message: `Queue: Automation started for ${candidate.candidate_name} → ${job.title}`,
        entityType: 'application', entityId: appId, status: 'info',
      });

      await runAutomation(appId, io);

      const result = await queryOne("SELECT status FROM applications WHERE id=$1", [appId]);
      const success = result?.status === 'success';

      if (success) {
        completed++;
        await query(
          "UPDATE queue_items SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=$1",
          [item.id]
        );
        logActivity({
          action: 'automation_success',
          message: `Queue: ${candidate.candidate_name} applied to ${job.title} at ${job.company}`,
          entityType: 'application', entityId: appId, status: 'success',
        });
      } else {
        failed++;
        await query(
          "UPDATE queue_items SET status='failed', completed_at=CURRENT_TIMESTAMP, error_message=$1 WHERE id=$2",
          [result?.status || 'unknown failure', item.id]
        );
      }

    } catch (err) {
      failed++;
      await query(
        "UPDATE queue_items SET status='failed', completed_at=CURRENT_TIMESTAMP, error_message=$1 WHERE id=$2",
        [err.message, item.id]
      );
      io.emit('queue_item_log', { itemId: item.id, message: `Error: ${err.message}` });
    }

    await query(
      "UPDATE queue_runs SET completed=$1, failed=$2 WHERE id=$3",
      [completed, failed, queueRunId]
    );

    io.emit('queue_progress', {
      queueRunId, total, completed, failed,
      status: shouldStop ? 'stopped' : 'running',
      currentItemId: item.id
    });
  }

  const finalStatus = shouldStop ? 'stopped' : 'done';
  await query(
    "UPDATE queue_runs SET status=$1, completed_at=CURRENT_TIMESTAMP WHERE id=$2",
    [finalStatus, queueRunId]
  );

  io.emit('queue_progress', { queueRunId, total, completed, failed, status: finalStatus });
  activeQueueRunId = null;

  logActivity({
    action: 'queue_completed',
    message: `Queue run complete: ${completed}/${total} succeeded, ${failed} failed`,
    entityType: 'system', status: completed === total ? 'success' : 'warning',
  });
}
