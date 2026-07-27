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
  console.log('✅ Connected!\n');

  const tables = ['resumes', 'jobs', 'applications', 'activity_logs', 'notifications', 'logs', 'settings'];
  for (const table of tables) {
    const { rows } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    const cols = rows.map(r => r.column_name).join(', ');
    console.log(`📋 ${table} (${rows.length} cols): ${cols}`);
  }

  console.log('\n=== Running Comprehensive Migrations ===');
  const migrations = [
    
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    
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
    
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS years_of_experience INT DEFAULT 0`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS categories TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS technologies TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_pdf TEXT`,
    `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_docx TEXT`,
    
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_score INT DEFAULT 0`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_resume_id VARCHAR(50)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_resume_name VARCHAR(255)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_confidence VARCHAR(50)`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS matched_skills TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS missing_skills TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_recommendations TEXT`,
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_score INT DEFAULT 0`,
  ];

  let ok = 0, skip = 0;
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('  ✅', sql.substring(0, 80));
      ok++;
    } catch (e) {
      console.log('  ⚠️  SKIP:', e.message.substring(0, 60));
      skip++;
    }
  }

  console.log(`\n✅ Done: ${ok} applied, ${skip} skipped`);

  const verify = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'created_at'`
  );
  if (verify.rows.length > 0) {
    console.log('✅ applications.created_at column CONFIRMED EXISTS');
  } else {
    console.log('❌ applications.created_at still MISSING - manual intervention needed');
  }

  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
