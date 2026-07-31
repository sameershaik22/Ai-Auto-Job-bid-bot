import { query, queryOne } from '../database/db.js';

async function updateProfileRoles() {
  console.log('--- Updating Existing Candidate Profile Roles ---');
  try {
    const resumes = await query('SELECT id, name, candidate_name, skills FROM resumes');
    console.log(`Found ${resumes.length} candidate profiles in DB.`);

    const rolesList = [
      'AI/ML Engineer Resume',
      'ML Specialist Profile',
      'Product Manager (PM) Resume',
      'Full Stack Engineer Profile',
      'Backend Developer Resume'
    ];

    for (let idx = 0; idx < resumes.length; idx++) {
      const row = resumes[idx];
      let role = rolesList[idx % rolesList.length];
      const skills = (row.skills || '').toLowerCase();

      if (skills.includes('python') || skills.includes('machine learning') || skills.includes('tensor')) {
        role = 'AI/ML Engineer Resume';
      } else if (skills.includes('react') && skills.includes('node')) {
        role = 'Full Stack Engineer Profile';
      } else if (skills.includes('express') || skills.includes('postgres')) {
        role = 'Backend Developer Resume';
      }

      console.log(`ID ${row.id}: Candidate = "${row.candidate_name}" -> Title: 🎯 "${role}"`);
      await query('UPDATE resumes SET name = ? WHERE id = ?', [role, row.id]);
    }

    console.log('All candidate profiles successfully updated with distinct Role Badges! ✅');
  } catch (err) {
    console.error('Error updating profiles:', err);
  }
}

updateProfileRoles();
