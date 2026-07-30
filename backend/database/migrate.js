import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('=== Connecting to Neon DB ===');
  await pool.query('SELECT 1');
  console.log('Connected!\n');

  console.log('=== Running Full Schema Migration ===');

  const migrations = [
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS location VARCHAR(255)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(255)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS github_url VARCHAR(255)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS preferred_salary VARCHAR(100)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS notice_period VARCHAR(100)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS visa_status VARCHAR(100)`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS languages TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS certifications TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS projects TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS years_of_experience INT DEFAULT 0`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS categories TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS technologies TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_pdf TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_docx TEXT`,

    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_platform VARCHAR(100) DEFAULT 'generic'`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment_type VARCHAR(100)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_score INT DEFAULT 0`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_resume_id VARCHAR(50)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_resume_name VARCHAR(255)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_confidence VARCHAR(50)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS matched_skills TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS missing_skills TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_recommendations TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_score INT DEFAULT 0`,

    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS queue_item_id VARCHAR(50)`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS tailored_resume_text TEXT`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_letter TEXT`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS proposal TEXT`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS score INT DEFAULT 0`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS original_score INT DEFAULT 0`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS ats_score INT DEFAULT 0`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS matched_skills TEXT`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS missing_skills TEXT`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS match_recommendations TEXT`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS response TEXT`,

    `CREATE TABLE IF NOT EXISTS queue_runs (
      id VARCHAR(50) PRIMARY KEY,
      total INT NOT NULL DEFAULT 0,
      completed INT DEFAULT 0,
      failed INT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'running',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS queue_items (
      id VARCHAR(50) PRIMARY KEY,
      queue_run_id VARCHAR(50) REFERENCES queue_runs(id) ON DELETE CASCADE,
      candidate_id VARCHAR(50) REFERENCES resumes(id) ON DELETE CASCADE,
      job_id VARCHAR(50) REFERENCES jobs(id) ON DELETE CASCADE,
      application_id VARCHAR(50),
      status VARCHAR(50) DEFAULT 'queued',
      position INT NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS platform_credentials (
      id VARCHAR(50) PRIMARY KEY,
      platform VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255),
      password_enc TEXT,
      extra_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS idx_queue_items_run ON queue_items(queue_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_application ON logs(application_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`,
  ];

  let ok = 0, skip = 0;
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      const label = sql.trim().substring(0, 70).replace(/\n/g, ' ');
      console.log('  OK:', label);
      ok++;
    } catch (e) {
      console.log('  SKIP:', e.message.substring(0, 80));
      skip++;
    }
  }

  console.log(`\nDone: ${ok} applied, ${skip} skipped`);
  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
