import { query, queryOne, initializeDatabase } from '../database/db.js';
import { scrapeJobUrl } from '../services/scraperService.js';
import assert from 'assert';

async function runTests() {
  console.log('===================================================');
  console.log('   Running Backend Job Board Integration Tests     ');
  console.log('===================================================');

  process.env.DATABASE_URL = '';
  
  try {
    
    await initializeDatabase();
    console.log('[Test] Database schema initialization: SUCCESS');

    await query('DELETE FROM jobs');
    await query('DELETE FROM resumes');

    const resId = `test_res_job_${Date.now()}`;
    await query(`
      INSERT INTO resumes (id, name, candidate_name, skills, experience, summary, education, resume_text, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [resId, 'Node Developer', 'Sameer Ahmed', 'NODE.JS,EXPRESS', '[]', 'Summary', '[]', 'Sameer Node Developer resume.', 'active']);
    console.log('[Test] Baseline active resume ingested: SUCCESS');

    console.log('[Test] Scraping local mock portal...');
    const parsedMock = await scrapeJobUrl('http://localhost:5000/mock-recruiter/index.html');
    assert.strictEqual(parsedMock.company, 'TechCorp International');
    assert.ok(parsedMock.skills_required.includes('React'), 'Skills should contain React');
    console.log('[Test] Mock Recruiter Portal web scraping: SUCCESS');

    console.log('[Test] Scraping fallback request...');
    const parsedFallback = await scrapeJobUrl('https://example.com/jobs/staff-frontend-engineer-vercel');
    assert.strictEqual(parsedFallback.company, 'Vercel Inc.');
    assert.strictEqual(parsedFallback.title, 'Staff Frontend Engineer');
    console.log('[Test] Web scraping offline fallback parser: SUCCESS');

    const jobId = `test_job_${Date.now()}`;
    const matchedSkillsStr = JSON.stringify([{ name: 'React', rating: 5 }]);
    const missingSkillsStr = JSON.stringify(['Docker']);
    const recsStr = JSON.stringify({
      recommendations: [{ title: 'Add Docker', reason: 'Req description', impact: 'High', difficulty: 'Easy' }],
      confidence_reason: 'Overlapping',
      reasoning: 'Good alignment',
      ratings: { resume_strength: 5 }
    });

    await query(`
      INSERT INTO jobs (
        id, url, title, company, description, skills_required, location, salary, 
        match_score, recommended_resume_id, recommended_resume_name, match_confidence,
        matched_skills, missing_skills, match_recommendations, ats_score, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      jobId, 
      'http://localhost:5000/mock-recruiter/index.html',
      'Staff Full Stack Engineer (React/Node)',
      'TechCorp International',
      'We are looking for a Staff Full Stack Developer with React and Node.js skills.',
      'React,Node.js',
      'Remote',
      '$180k - $220k',
      91,
      resId,
      'Node Developer',
      'High',
      matchedSkillsStr,
      missingSkillsStr,
      recsStr,
      94,
      'unapplied'
    ]);

    const created = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);
    assert.ok(created, 'Job posting should exist in database');
    assert.strictEqual(created.match_score, 91);
    assert.strictEqual(created.ats_score, 94);
    assert.strictEqual(created.recommended_resume_name, 'Node Developer');
    assert.strictEqual(created.match_confidence, 'High');
    assert.ok(created.match_recommendations.includes('Add Docker'));
    console.log('[Test] Create Job CRUD & matching scores attachment: SUCCESS');

    await query(`
      UPDATE jobs 
      SET title = ?, match_score = ?
      WHERE id = ?
    `, ['Lead Software Engineer', 95, jobId]);

    const updated = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);
    assert.strictEqual(updated.title, 'Lead Software Engineer');
    assert.strictEqual(updated.match_score, 95);
    console.log('[Test] Update Job CRUD operation: SUCCESS');

    await query('DELETE FROM jobs WHERE id = ?', [jobId]);
    const checkDeleted = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);
    assert.strictEqual(checkDeleted, null, 'Job should be deleted from DB');
    console.log('[Test] Delete Job CRUD operation: SUCCESS');

    console.log('===================================================');
    console.log('   All Job Board Module Integration Tests Passed!  ');
    console.log('===================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Job Board Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
