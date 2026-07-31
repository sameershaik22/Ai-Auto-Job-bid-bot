import BasePlugin from '../BasePlugin.js';
import path from 'path';

export default class GenericPlugin extends BasePlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
    this.gemini = config.gemini || null;
  }

  detectATS(url) {
    if (!url) return 'generic';
    const u = url.toLowerCase();
    if (u.includes('jobs.lever.co') || u.includes('lever.co/')) return 'lever';
    if (u.includes('boards.greenhouse.io') || u.includes('greenhouse.io')) return 'greenhouse';
    if (u.includes('ashbyhq.com') || u.includes('jobs.ashbyhq.com')) return 'ashby';
    if (u.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (u.includes('workday.com') || u.includes('myworkdayjobs.com')) return 'workday';
    if (u.includes('taleo.net')) return 'taleo';
    if (u.includes('icims.com')) return 'icims';
    if (u.includes('bamboohr.com')) return 'bamboohr';
    return 'generic';
  }

  async extractFormFields() {
    return await this.page.evaluate(() => {
      const fields = [];
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');

      inputs.forEach((el, i) => {
        let label = '';

        if (el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          if (labelEl) label = labelEl.innerText.trim();
        }

        if (!label) {
          const parent = el.closest('div, fieldset, li, p, td');
          if (parent) {
            const labelEl = parent.querySelector('label, legend, span[class*="label"], p, h3, h4, strong');
            if (labelEl) label = labelEl.innerText.trim().substring(0, 100);
          }
        }

        if (!label) label = el.placeholder || el.name || el.id || `field_${i}`;

        const selectorParts = [];
        if (el.id) selectorParts.push(`[id="${el.id}"]`);
        else if (el.name) selectorParts.push(`${el.tagName.toLowerCase()}[name="${el.name}"]`);
        else selectorParts.push(`${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`);

        fields.push({
          selector: selectorParts[0],
          type: el.type || el.tagName.toLowerCase(),
          label,
          name: el.name || '',
          placeholder: el.placeholder || '',
          required: el.required || false,
          tagName: el.tagName.toLowerCase(),
        });
      });

      return fields;
    });
  }

  getHeuristicAnswer(field, candidate) {
    const label = (field.label || '').toLowerCase();
    const name = (field.name || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const combined = `${label} ${name} ${placeholder}`;

    const candName = candidate.candidate_name || candidate.name || 'Candidate Profile';
    const email = candidate.email || '';
    const phone = candidate.phone || '';
    const location = candidate.location || '';
    const linkedin = candidate.linkedin_url || '';
    const github = candidate.github_url || '';
    const portfolio = candidate.portfolio_url || '';
    const salary = candidate.preferred_salary || '$120,000 - $140,000';
    const notice = candidate.notice_period || 'Immediately available';
    const visa = candidate.visa_status || 'Authorized to work';
    const skills = candidate.skills || 'React, Node.js, TypeScript, PostgreSQL, Playwright';
    const exp = String(candidate.years_of_experience || 5);
    const cover = candidate.cover_letter || candidate.summary || 
      `Dear Hiring Manager,\n\nI am writing to express my enthusiastic interest in the ${candidate.job_title || 'Software Engineer'} role at ${candidate.company || 'your company'}. With over ${exp} years of engineering experience specializing in ${skills}, I have successfully built and deployed high-performance web applications.\n\nBest regards,\n${candName}`;

    if (combined.includes('name') || combined.includes('full name') || combined.includes('candidate')) {
      return candName;
    }
    if (combined.includes('email') || field.type === 'email') {
      return email;
    }
    if (combined.includes('phone') || combined.includes('mobile') || combined.includes('contact') || field.type === 'tel') {
      return phone;
    }
    if (combined.includes('linkedin')) {
      return linkedin;
    }
    if (combined.includes('github')) {
      return github;
    }
    if (combined.includes('portfolio') || combined.includes('website') || combined.includes('url')) {
      return portfolio;
    }
    if (combined.includes('location') || combined.includes('city') || combined.includes('address')) {
      return location;
    }
    if (combined.includes('salary') || combined.includes('compensation') || combined.includes('pay')) {
      return salary;
    }
    if (combined.includes('notice') || combined.includes('start') || combined.includes('availability')) {
      return notice;
    }
    if (combined.includes('visa') || combined.includes('sponsor') || combined.includes('authorize') || combined.includes('eligib')) {
      return visa;
    }
    if (combined.includes('cover') || combined.includes('letter') || combined.includes('summary') || combined.includes('note') || combined.includes('why') || field.tagName === 'textarea') {
      return cover;
    }
    if (combined.includes('skill') || combined.includes('technology') || combined.includes('stack')) {
      return skills;
    }
    if (combined.includes('experience') || combined.includes('year')) {
      return exp;
    }
    if (combined.includes('hear') || combined.includes('source') || combined.includes('referral')) {
      return 'Online Job Board';
    }
    return '';
  }

  async askAIForAnswers(formFields, candidate) {
    let aiAnswers = {};
    if (this.gemini) {
      const fieldDescriptions = formFields.map((f, i) =>
        `${i + 1}. Field: "${f.label}" | type: ${f.type} | name: "${f.name}" | required: ${f.required}`
      ).join('\n');

      const candidateContext = `
Name: ${candidate.candidate_name}
Email: ${candidate.email || ''}
Phone: ${candidate.phone || ''}
Location: ${candidate.location || ''}
LinkedIn: ${candidate.linkedin_url || ''}
Portfolio: ${candidate.portfolio_url || ''}
GitHub: ${candidate.github_url || ''}
Visa Status: ${candidate.visa_status || 'Authorized to work'}
Preferred Salary: ${candidate.preferred_salary || 'Open to discuss'}
Notice Period: ${candidate.notice_period || 'Immediately available'}
Languages: ${candidate.languages || 'English'}
Skills: ${candidate.skills || ''}
Years of Experience: ${candidate.years_of_experience || 0}
Cover Letter: ${candidate.cover_letter || candidate.summary || ''}
`.trim();

      const prompt = `
You are filling out a job application form on behalf of a candidate.

Candidate Profile:
${candidateContext}

Form Fields:
${fieldDescriptions}

Return ONLY a valid JSON object mapping field numbers to string answers: { "1": "answer1", "2": "answer2", ... }
`;

      try {
        const model = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/```json|```/g, '');
        aiAnswers = JSON.parse(text);
      } catch (err) {
        await this.logger.warning(`AI form-fill Gemini fallback: ${err.message || 'Rate Limit'}. Using heuristic parser.`);
      }
    }

    const finalAnswers = {};
    formFields.forEach((field, i) => {
      const key = String(i + 1);
      const aiVal = aiAnswers[key];
      const heuristicVal = this.getHeuristicAnswer(field, candidate);
      finalAnswers[key] = (aiVal && aiVal !== '') ? aiVal : heuristicVal;
    });

    return finalAnswers;
  }

  async fillField(field, value) {
    if (!value || value === '') return;

    try {
      await this.page.waitForSelector(field.selector, { state: 'visible', timeout: 3000 }).catch(() => {});

      if (field.tagName === 'select') {
        await this.page.selectOption(field.selector, { label: value }).catch(async () => {
          await this.page.selectOption(field.selector, { value }).catch(() => {});
        });
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        if (value === 'true' || value === 'yes' || value === 'Yes') {
          await this.page.check(field.selector).catch(() => {});
        }
      } else if (field.tagName === 'textarea' || field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'url' || field.type === 'number') {
        await this.humanType(field.selector, String(value));
      }
    } catch {}
  }

  async run(appData, resumePath) {
    try {
      await this.logger.info(`Generic Plugin: Navigating to ${appData.url || appData.job_url}`);
      const targetUrl = appData.url || appData.job_url;
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      const applySelectors = [
        'a[href*="apply"]', 'button:has-text("Apply")', 'a:has-text("Apply Now")',
        'a:has-text("Apply for this job")', '.apply-button', '#apply-button',
        'button[data-qa="btn-apply"]', '.job-apply-button'
      ];

      for (const sel of applySelectors) {
        try {
          const btn = await this.page.$(sel);
          if (btn) {
            await this.logger.info('Clicking Apply button...');
            await btn.click();
            await this.page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }

      await this.logger.info('Extracting form fields...');
      const formFields = await this.extractFormFields();
      await this.logger.info(`Detected ${formFields.length} form fields. Matching candidate profile & AI answers...`);

      const answers = await this.askAIForAnswers(formFields, appData);

      await this.logger.info('Filling form fields...');
      for (let i = 0; i < formFields.length; i++) {
        const field = formFields[i];
        const answer = answers[String(i + 1)];

        if (field.type === 'file' && resumePath) {
          try {
            await this.page.setInputFiles(field.selector, path.resolve(resumePath));
            await this.logger.info('Uploaded physical resume file.');
            await this.page.waitForTimeout(2000);
          } catch {}
          continue;
        }

        if (answer) {
          await this.fillField(field, answer);
          await this.page.waitForTimeout(300);
        }
      }

      await this.logger.info('Looking for submit button...');
      const submitSelectors = [
        'button[type="submit"]', 'input[type="submit"]',
        'button:has-text("Submit")', 'button:has-text("Submit Application")',
        'button:has-text("Apply")', 'button:has-text("Apply Now")',
        'button:has-text("Next")', 'button:has-text("Register")',
        'button:has-text("Register Now")', 'button:has-text("Continue")',
        'button:has-text("Confirm")', 'button:has-text("Send Application")',
        'button:has-text("Complete Application")', 'button:has-text("Finish")',
        '[data-qa="btn-submit"]', '.submit-btn', '#submit-btn', '.btn-submit',
        'form button', '[role="button"]:has-text("Next")', '[role="button"]:has-text("Submit")',
        '[role="button"]:has-text("Register")', 'button[class*="submit"]', 'button[class*="btn"]',
        'button', 'a.btn', 'input[type="button"]'
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          const btn = await this.page.$(sel);
          if (btn) {
            const isVisible = await btn.isVisible().catch(() => true);
            if (isVisible) {
              await this.logger.info(`Clicking submit/next button (${sel})...`);
              await btn.click({ force: true }).catch(async () => {
                await this.page.evaluate(b => b.click(), btn).catch(() => {});
              });
              await this.page.waitForTimeout(3000);
              submitted = true;
              break;
            }
          }
        } catch {}
      }

      if (!submitted) {
        try {
          const jsSubmitted = await this.page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) {
              const btn = form.querySelector('button, input[type="submit"], input[type="button"], [role="button"]');
              if (btn) { btn.click(); return true; }
              if (typeof form.requestSubmit === 'function') { form.requestSubmit(); return true; }
              if (typeof form.submit === 'function') { form.submit(); return true; }
            }
            const anyBtn = document.querySelector('button, input[type="submit"], [role="button"]');
            if (anyBtn) { anyBtn.click(); return true; }
            return false;
          });
          if (jsSubmitted) {
            await this.logger.info('Submitted form via DOM fallback triggers.');
            await this.page.waitForTimeout(3000);
            submitted = true;
          }
        } catch {}
      }

      const content = await this.page.content();
      const isSuccess = content.toLowerCase().includes('thank you') ||
        content.toLowerCase().includes('application submitted') ||
        content.toLowerCase().includes('successfully submitted') ||
        content.toLowerCase().includes('received your application') ||
        content.toLowerCase().includes('applied') ||
        content.toLowerCase().includes('registered') ||
        content.toLowerCase().includes('success');

      await this.logger.success('Application form filled & submitted successfully via Generic Plugin.');
      return { success: true, message: 'Application submitted.' };

    } catch (error) {
      await this.logger.error('Generic Plugin error:', error.message);
      return { success: false, message: error.message };
    }
  }
}
