import { query, queryOne, initializeDatabase } from '../database/db.js';
import assert from 'assert';

async function runTests() {
  console.log('===================================================');
  console.log('   Running Backend Resume Module Integration Tests  ');
  console.log('===================================================');

  process.env.DATABASE_URL = '';
  
  try {
    
    await initializeDatabase();
    console.log('[Test] Database schema initialization: SUCCESS');

    await query('DELETE FROM resumes');

    const testId = `test_res_${Date.now()}`;
    const testText = 'Sameer Ahmed\nSkills: React, Node.js, Express, Postgres\nExperience: 6 years';
    
    await query(`
      INSERT INTO resumes (id, name, candidate_name, skills, experience, summary, education, resume_text, years_of_experience, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [testId, 'Test Ingestion Profile', 'Sameer Ahmed', 'REACT,NODE.JS', '[]', 'Summary Text', '[]', testText, 6, 'active']);
    
    const created = await queryOne('SELECT * FROM resumes WHERE id = ?', [testId]);
    assert.ok(created, 'Resume should exist in database after insert');
    assert.strictEqual(created.candidate_name, 'Sameer Ahmed');
    assert.strictEqual(created.years_of_experience, 6);
    console.log('[Test] Create Resume CRUD operation: SUCCESS');

    await query('UPDATE resumes SET name = ?, years_of_experience = ? WHERE id = ?', ['Updated Ingestion Name', 8, testId]);
    const updated = await queryOne('SELECT * FROM resumes WHERE id = ?', [testId]);
    assert.strictEqual(updated.name, 'Updated Ingestion Name');
    assert.strictEqual(updated.years_of_experience, 8);
    console.log('[Test] Update Resume CRUD operation: SUCCESS');

    await query('UPDATE resumes SET status = ? WHERE id = ?', ['archived', testId]);
    const archived = await queryOne('SELECT status FROM resumes WHERE id = ?', [testId]);
    assert.strictEqual(archived.status, 'archived');
    console.log('[Test] Archive Resume operation: SUCCESS');

    const cloneId = `clone_${Date.now()}`;
    await query(`
      INSERT INTO resumes (id, name, candidate_name, skills, experience, summary, education, resume_text, years_of_experience, status)
      SELECT ?, name || ' (Clone)', candidate_name, skills, experience, summary, education, resume_text, years_of_experience, status 
      FROM resumes WHERE id = ?
    `, [cloneId, testId]);

    const cloned = await queryOne('SELECT * FROM resumes WHERE id = ?', [cloneId]);
    assert.ok(cloned, 'Cloned resume should exist');
    assert.strictEqual(cloned.name, 'Updated Ingestion Name (Clone)');
    console.log('[Test] Clone Resume operation: SUCCESS');

    await query('DELETE FROM resumes WHERE id = ?', [testId]);
    await query('DELETE FROM resumes WHERE id = ?', [cloneId]);
    const checkDeleted = await queryOne('SELECT * FROM resumes WHERE id = ?', [testId]);
    assert.strictEqual(checkDeleted, null, 'Resume should be deleted');
    console.log('[Test] Delete Resume operation: SUCCESS');

    console.log('===================================================');
    console.log('   All Resume Module Integration Tests Passed! ✅   ');
    console.log('===================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Integration Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
