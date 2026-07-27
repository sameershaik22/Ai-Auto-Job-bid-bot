import assert from 'assert';
import http from 'http';
import { query, queryOne } from '../database/db.js';
import '../server.js';

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===================================================');
  console.log('  Running Backend Resume Tailoring & Copywriting   ');
  console.log('===================================================');

  try {
    
    const resumeId = `test_vault_${Date.now()}`;
    const jobId = `test_job_${Date.now()}`;

    await query(`
      INSERT INTO resumes (id, name, candidate_name, skills, experience, summary, education, resume_text, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      resumeId, 'Tailoring Test Baseline', 'Sameer Ahmed', 'React,Node,SQL', '[]', 'Profile summary', '[]',
      'Experienced engineer specialized in React, Node, and SQL.', 'active'
    ]);

    await query(`
      INSERT INTO jobs (id, url, title, company, description, skills_required, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      jobId, 'https://example.com/jobs/99', 'Senior Engineer', 'Global Tech',
      'We need an engineer experienced with React, Node, SQL and Playwright automation.',
      'React,Node,SQL,Playwright', 'unapplied'
    ]);

    console.log('[Test] Ingestion of baseline resume and job: SUCCESS');

    const tailorRes = await makeRequest('POST', '/api/ai/tailor', {
      resume_id: resumeId,
      job_id: jobId,
      tone: 'Professional',
      budget: '$2,000',
      timeline: '2 weeks',
      portfolio_links: 'github.com/sameer'
    });

    assert.strictEqual(tailorRes.statusCode, 200, 'Tailor request should return 200 OK');
    const tailorData = JSON.parse(tailorRes.body);
    
    assert.ok(tailorData.success, 'Tailoring response should be successful');
    assert.ok(tailorData.application_id, 'Should return an application ID');
    assert.ok(tailorData.tailored_resume_text, 'Should contain tailored resume text');
    assert.ok(tailorData.cover_letter, 'Should contain cover letter text');
    assert.ok(tailorData.proposal, 'Should contain bid proposal text');
    assert.ok(tailorData.score > 0, 'Should return match score');
    assert.ok(tailorData.ats_estimate > 0, 'Should return ATS compatibility estimate');

    console.log('[Test] Trigger AI Tailoring Endpoint: SUCCESS');

    const appId = tailorData.application_id;

    const pdfRes = await makeRequest('GET', `/api/applications/${appId}/download-pdf`);
    assert.strictEqual(pdfRes.statusCode, 200, 'PDF download should return 200');
    const isDoc = pdfRes.headers['content-type'].includes('pdf') || pdfRes.headers['content-type'].includes('html');
    assert.ok(isDoc, 'Content-type should be PDF or HTML fallback');
    console.log('[Test] Compile & Download PDF Document: SUCCESS');

    const docxRes = await makeRequest('GET', `/api/applications/${appId}/download-docx`);
    assert.strictEqual(docxRes.statusCode, 200, 'DOCX download should return 200');
    assert.ok(docxRes.headers['content-type'].includes('msword'), 'Content-type should be msword');
    console.log('[Test] Compile & Download DOCX Document: SUCCESS');

    const regenLetterRes = await makeRequest('POST', `/api/applications/${appId}/regenerate-letter`, { tone: 'Bold' });
    assert.strictEqual(regenLetterRes.statusCode, 200);
    const letterData = JSON.parse(regenLetterRes.body);
    assert.ok(letterData.cover_letter, 'Should return new cover letter');
    console.log('[Test] Regenerate Cover Letter segment: SUCCESS');

    await query('DELETE FROM applications WHERE id = ?', [appId]);
    await query('DELETE FROM resumes WHERE id = ?', [resumeId]);
    await query('DELETE FROM jobs WHERE id = ?', [jobId]);
    console.log('[Test] Database records cleanup: SUCCESS');

    console.log('===================================================');
    console.log('   All Tailoring & Copywriting Tests Passed! ✅   ');
    console.log('===================================================');
    process.exit(0);

  } catch (err) {
    console.error('[TEST FAILURE]:', err);
    process.exit(1);
  }
}

setTimeout(runTests, 1500);

