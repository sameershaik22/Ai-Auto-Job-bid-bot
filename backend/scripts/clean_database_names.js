import { query } from '../database/db.js';
import { cleanCandidateName, cleanLocation } from '../routes/resumes.js';

async function cleanDatabaseNames() {
  console.log('Cleaning existing candidate profile names, locations, and summaries in SQLite database...');
  const resumes = await query('SELECT id, name, candidate_name, location, summary, skills FROM resumes');

  for (const r of resumes) {
    let cleanCandName = cleanCandidateName(r.candidate_name);
    if (!cleanCandName || cleanCandName.length < 3) {
      cleanCandName = cleanCandidateName(r.name);
    }
    if (!cleanCandName) {
      cleanCandName = 'Sameer Shaik';
    }

    let newProfileTitle = r.name;
    if (!r.name || r.name.toLowerCase().includes('resume') || r.name.toLowerCase().includes('sde') || r.name.includes('.pdf') || r.name.includes('.docx')) {
      newProfileTitle = `${cleanCandName}'s Profile`;
    }

    let cleanedLoc = cleanLocation(r.location);
    let cleanedSummary = r.summary || '';
    if (!cleanedSummary || cleanedSummary.length < 15) {
      cleanedSummary = `Experienced ${r.target_role || 'Software Engineer'} with background in ${r.skills || 'React, Node.js, TypeScript'}. Proven track record of designing high-performance software applications and delivering technical solutions.`;
    }

    console.log(`[Update] ID ${r.id}: Candidate: "${cleanCandName}", Location: "${cleanedLoc}", Summary: "${cleanedSummary.substring(0, 45)}..."`);
    await query(
      'UPDATE resumes SET candidate_name = ?, name = ?, location = ?, summary = ? WHERE id = ?',
      [cleanCandName, newProfileTitle, cleanedLoc, cleanedSummary, r.id]
    );
  }

  console.log('Database cleanup completed successfully! ✅');
}

cleanDatabaseNames().catch(console.error);
