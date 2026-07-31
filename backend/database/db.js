import pg from 'pg';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

const dbUrl = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '').replace('?channel_binding=require&', '?');

if (dbUrl) {
  console.log('Database URL detected. Connecting to PostgreSQL/Neon...');
  pgPool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pgPool.on('error', (err, client) => {
    console.error('Unexpected error on idle pg client:', err.message);
  });

  isPostgres = true;
} else {
  console.log('No DATABASE_URL found. Falling back to local SQLite...');
  const dbFile = path.resolve(__dirname, '../db.sqlite');
  sqliteDb = new sqlite3.Database(dbFile, (err) => {
    if (err) {
      console.error('Failed to open SQLite database:', err.message);
    } else {
      console.log('SQLite database opened successfully at:', dbFile);
    }
  });
}

function translateQuery(sql) {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const translatedSql = translateQuery(sql);
    
    if (isPostgres) {
      pgPool.query(translatedSql, params, (err, res) => {
        if (err) {
          console.error(`Postgres error executing: ${sql}`, err);
          return reject(err);
        }
        resolve(res.rows);
      });
    } else {

      const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA');
      if (isSelect) {
        sqliteDb.all(translatedSql, params, (err, rows) => {
          if (err) {
            console.error(`SQLite error executing: ${sql}`, err);
            return reject(err);
          }
          resolve(rows);
        });
      } else {
        sqliteDb.run(translatedSql, params, function (err) {
          if (err) {
            console.error(`SQLite error executing: ${sql}`, err);
            return reject(err);
          }
          
          resolve({ rows: [], lastID: this.lastID, changes: this.changes });
        });
      }
    }
  });
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function runMigrations() {
  const resumeColumns = [
    { name: 'years_of_experience', type: 'INT DEFAULT 0' },
    { name: 'categories', type: 'TEXT' },
    { name: 'technologies', type: 'TEXT' },
    { name: 'resume_pdf', type: 'TEXT' },
    { name: 'resume_docx', type: 'TEXT' }
  ];

  const jobColumns = [
    { name: 'match_score', type: 'INT DEFAULT 0' },
    { name: 'recommended_resume_id', type: 'VARCHAR(50)' },
    { name: 'recommended_resume_name', type: 'VARCHAR(255)' },
    { name: 'match_confidence', type: 'VARCHAR(50)' },
    { name: 'matched_skills', type: 'TEXT' },
    { name: 'missing_skills', type: 'TEXT' },
    { name: 'match_recommendations', type: 'TEXT' },
    { name: 'ats_score', type: 'INT DEFAULT 0' }
  ];

  const applicationColumns = [
    { name: 'original_score', type: 'INT DEFAULT 0' },
    { name: 'ats_score', type: 'INT DEFAULT 0' },
    { name: 'matched_skills', type: 'TEXT' },
    { name: 'missing_skills', type: 'TEXT' },
    { name: 'match_recommendations', type: 'TEXT' },
    { name: 'created_at', type: 'TIMESTAMP' }
  ];

  if (isPostgres) {
    
    for (const col of resumeColumns) {
      try {
        const check = await query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'resumes' AND column_name = $1
        `, [col.name]);
        if (check.length === 0) {
          console.log(`[Migration] Adding column ${col.name} to Postgres resumes table...`);
          await query(`ALTER TABLE resumes ADD COLUMN ${col.name} ${col.type}`);
        }
      } catch (err) {
        console.error(`Postgres migration failed for resumes column ${col.name}:`, err.message);
      }
    }

    for (const col of jobColumns) {
      try {
        const check = await query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'jobs' AND column_name = $1
        `, [col.name]);
        if (check.length === 0) {
          console.log(`[Migration] Adding column ${col.name} to Postgres jobs table...`);
          await query(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type}`);
        }
      } catch (err) {
        console.error(`Postgres migration failed for jobs column ${col.name}:`, err.message);
      }
    }

    for (const col of applicationColumns) {
      try {
        const check = await query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'applications' AND column_name = $1
        `, [col.name]);
        if (check.length === 0) {
          console.log(`[Migration] Adding column ${col.name} to Postgres applications table...`);
          await query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type}`);
        }
      } catch (err) {
        console.error(`Postgres migration failed for applications column ${col.name}:`, err.message);
      }
    }
  } else {
    
    for (const col of resumeColumns) {
      try {
        const info = await query(`PRAGMA table_info(resumes)`);
        const exists = info.some(c => c.name === col.name);
        if (!exists) {
          console.log(`[Migration] Adding column ${col.name} to SQLite resumes table...`);
          await query(`ALTER TABLE resumes ADD COLUMN ${col.name} ${col.type.replace('DEFAULT 0', '')}`);
        }
      } catch (err) {
        console.error(`SQLite migration failed for resumes column ${col.name}:`, err.message);
      }
    }

    for (const col of jobColumns) {
      try {
        const info = await query(`PRAGMA table_info(jobs)`);
        const exists = info.some(c => c.name === col.name);
        if (!exists) {
          console.log(`[Migration] Adding column ${col.name} to SQLite jobs table...`);
          await query(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type.replace('DEFAULT 0', '')}`);
        }
      } catch (err) {
        console.error(`SQLite migration failed for jobs column ${col.name}:`, err.message);
      }
    }

    for (const col of applicationColumns) {
      try {
        const info = await query(`PRAGMA table_info(applications)`);
        const exists = info.some(c => c.name === col.name);
        if (!exists) {
          console.log(`[Migration] Adding column ${col.name} to SQLite applications table...`);
          await query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type.replace('DEFAULT 0', '')}`);
        }
      } catch (err) {
        console.error(`SQLite migration failed for applications column ${col.name}:`, err.message);
      }
    }
  }
}

export async function initializeDatabase() {
  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    if (isPostgres) {
      console.log('Initializing PostgreSQL database schema...');
      await query(schemaSql);
      console.log('PostgreSQL schema initialized successfully.');
    } else {
      console.log('Initializing SQLite database schema...');
      await new Promise((resolve, reject) => {
        sqliteDb.exec(schemaSql, (err) => {
          if (err) {
            console.error('Failed to initialize SQLite schema:', err);
            reject(err);
          } else {
            console.log('SQLite schema initialized successfully.');
            resolve();
          }
        });
      });
    }

    await runMigrations();
  } catch (err) {
    console.error('Critical database initialization error:', err);
    process.exit(1);
  }
}

export async function logActivity({
  action,
  message,
  entityType = null,
  entityId   = null,
  status     = 'info',
  metadata   = null,
  notify     = true,           
  notifTitle = null,
  notifType  = 'info',
  actionUrl  = null,
}) {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const metaStr = metadata ? JSON.stringify(metadata) : null;

    await query(
      `INSERT INTO activity_logs (id, action, message, entity_type, entity_id, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, action, message, entityType, entityId, status, metaStr]
    );

    if (notify) {
      const nid = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await query(
        `INSERT INTO notifications (id, type, title, message, entity_type, entity_id, action_url, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [nid, notifType || entityType || 'info', notifTitle || message, message,
         entityType, entityId, actionUrl]
      );
    }
  } catch (err) {
    
    console.error('[logActivity] Failed to write activity log:', err.message);
  }
}

