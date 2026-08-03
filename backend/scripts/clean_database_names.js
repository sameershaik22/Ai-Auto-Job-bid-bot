import { query, queryOne } from '../database/db.js';
import { cleanCandidateName } from '../routes/resumes.js';

async function cleanDatabaseNames() {
  console.log('Cleaning existing candidate profile names in SQLite database...');
  const resumes = await query('SELECT id, name, candidate_name, resume_text FROM resumes');

  for (const r of resumes) {
    let cleanCandName = cleanCandidateName(r.candidate_name);
    if (!cleanCandName || cleanCandName.length < 3) {
      cleanCandName = cleanCandidateName(r.name);
    }
    if (!cleanCandName) {
      cleanCandName = 'Sameer Shaik';
    }

    let newProfileTitle = r.name;
    if (r.name.toLowerCase().includes('resume') || r.name.toLowerCase().includes('sde') || r.name.includes('.pdf') || r.name.includes('.docx')) {
      newProfileTitle = `${cleanCandName}'s Profile`;
    }

    console.log(`[Update] ID ${r.id}: "${r.candidate_name}" -> Candidate Name: "${cleanCandName}", Profile Title: "${newProfileTitle}"`);
    await query('UPDATE resumes SET candidate_name = ?, name = ? WHERE id = ?', [cleanCandName, newProfileTitle, r.id]);
  }

  console.log('Database cleanup completed successfully! ✅');
}

cleanDatabaseNames().catch(console.error);
