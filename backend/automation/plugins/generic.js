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
          const parent = el.closest('div, fieldset, li');
          if (parent) {
            const labelEl = parent.querySelector('label, legend, span[class*="label"], p');
            if (labelEl) label = labelEl.innerText.trim().substring(0, 100);
          }
        }

        if (!label) label = el.placeholder || el.name || el.id || `field_${i}`;

        const selectorParts = [];
        if (el.id) selectorParts.push(`#${el.id}`);
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

  async askAIForAnswers(formFields, candidate) {
    if (!this.gemini) return {};

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
`.trim();

    const prompt = `
You are filling out a job application form on behalf of a candidate.

Candidate Profile:
${candidateContext}

Form Fields to fill (label | type | name):
${fieldDescriptions}

Instructions:
- For each field number, provide the best answer using the candidate's information
- For yes/no questions about work authorization, answer "Yes"
- For salary fields, use the preferred salary
- For "how did you hear about us" or similar, answer "Online job board"
- For gender/race/veteran status, answer "Prefer not to say" or "I don't wish to answer"
- For cover letter or additional info, use a brief professional statement
- For LinkedIn URL fields, use the linkedin_url
- Skip submit buttons, captchas, and file upload fields (return empty string for those)
- Return ONLY a valid JSON object: { "1": "answer1", "2": "answer2", ... } using the field numbers

Return only the JSON object, no other text.
`;

    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/```json|```/g, '');
      return JSON.parse(text);
    } catch (err) {
      await this.logger.warning(`AI form-fill failed: ${err.message}`);
      return {};
    }
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
    } catch {
    }
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
      await this.logger.info(`Detected ${formFields.length} form fields. Asking AI for answers...`);

      const answers = await this.askAIForAnswers(formFields, appData);

      await this.logger.info('Filling form fields...');
      for (let i = 0; i < formFields.length; i++) {
        const field = formFields[i];
        const answer = answers[String(i + 1)];

        if (field.type === 'file' && resumePath) {
          try {
            await this.page.setInputFiles(field.selector, path.resolve(resumePath));
            await this.logger.info('Uploaded resume file.');
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
        'button:has-text("Apply")', '[data-qa="btn-submit"]'
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          const btn = await this.page.$(sel);
          if (btn) {
            await this.logger.info('Clicking submit...');
            await btn.click();
            await this.page.waitForTimeout(5000);
            submitted = true;
            break;
          }
        } catch {}
      }

      const content = await this.page.content();
      const isSuccess = content.toLowerCase().includes('thank you') ||
        content.toLowerCase().includes('application submitted') ||
        content.toLowerCase().includes('successfully submitted') ||
        content.toLowerCase().includes('received your application');

      if (isSuccess || submitted) {
        await this.logger.success('Application submitted successfully via Generic Plugin.');
        return { success: true, message: 'Application submitted.' };
      } else {
        return { success: false, message: 'Submit button not found or confirmation not detected.' };
      }

    } catch (error) {
      await this.logger.error('Generic Plugin error:', error.message);
      return { success: false, message: error.message };
    }
  }
}
