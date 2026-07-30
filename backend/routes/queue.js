import express from 'express';
import { query, queryOne } from '../database/db.js';
import { processQueue, stopQueue, getActiveQueueRunId } from '../automation/queue-manager.js';
import { getIO } from '../socket.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post('/start', async (req, res) => {
  try {
    const { candidate_ids, job_ids } = req.body;

    if (!candidate_ids?.length || !job_ids?.length) {
      return res.status(400).json({ error: 'candidate_ids and job_ids are required' });
    }

    if (getActiveQueueRunId()) {
      return res.status(409).json({ error: 'A queue is already running. Stop it first.' });
    }

    const runId = `run_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const pairs = [];

    for (const candidateId of candidate_ids) {
      for (const jobId of job_ids) {
        pairs.push({ candidateId, jobId });
      }
    }

    await query(
      'INSERT INTO queue_runs (id, total, status) VALUES ($1,$2,$3)',
      [runId, pairs.length, 'running']
    );

    for (let i = 0; i < pairs.length; i++) {
      const itemId = `qi_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      await query(
        'INSERT INTO queue_items (id, queue_run_id, candidate_id, job_id, position) VALUES ($1,$2,$3,$4,$5)',
        [itemId, runId, pairs[i].candidateId, pairs[i].jobId, i]
      );
    }

    const io = getIO();
    processQueue(runId, io).catch(err => {
      console.error('Queue manager error:', err);
    });

    res.status(202).json({
      success: true,
      queue_run_id: runId,
      total: pairs.length,
      message: `Queue started with ${pairs.length} application(s)`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', async (req, res) => {
  try {
    stopQueue();
    res.json({ success: true, message: 'Stop signal sent. Current job will complete then queue will halt.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const activeId = getActiveQueueRunId();
    if (!activeId) {
      return res.json({ active: false, queueRunId: null });
    }

    const run = await queryOne('SELECT * FROM queue_runs WHERE id=$1', [activeId]);
    const items = await query(`
      SELECT qi.*, r.candidate_name, j.title as job_title, j.company
      FROM queue_items qi
      JOIN resumes r ON qi.candidate_id = r.id
      JOIN jobs j ON qi.job_id = j.id
      WHERE qi.queue_run_id = $1
      ORDER BY qi.position ASC
    `, [activeId]);

    res.json({ active: true, run, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const runs = await query('SELECT * FROM queue_runs ORDER BY started_at DESC LIMIT 20');
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:runId/items', async (req, res) => {
  try {
    const items = await query(`
      SELECT qi.*, r.candidate_name, j.title as job_title, j.company, j.url as job_url
      FROM queue_items qi
      JOIN resumes r ON qi.candidate_id = r.id
      JOIN jobs j ON qi.job_id = j.id
      WHERE qi.queue_run_id = $1
      ORDER BY qi.position ASC
    `, [req.params.runId]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
