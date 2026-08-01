import GenericPlugin from './generic.js';
import path from 'path';

export default class LeverPlugin extends GenericPlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
  }

  async run(appData, resumePath) {
    try {
      await this.logger.info(`Starting Lever application for ${appData.job_title || 'Job'} at ${appData.company || 'Company'}`);
      await this.page.goto(appData.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2500);

      const applyBtn = await this.page.$('a.postings-btn, button.postings-btn, a[href*="apply"]');
      if (applyBtn) {
        await this.humanClick('a.postings-btn, button.postings-btn, a[href*="apply"]');
        await this.page.waitForTimeout(1500);
      }

      const fileInput = await this.page.$('input[type="file"][name="resume"], input[type="file"]');
      if (fileInput && resumePath) {
        await fileInput.setInputFiles(path.resolve(resumePath)).catch(() => {});
        await this.page.waitForTimeout(2000);
      }

      if (await this.page.$('input[name="name"]')) {
        await this.humanType('input[name="name"]', appData.candidate_name || '');
      }
      if (await this.page.$('input[name="email"]')) {
        await this.humanType('input[name="email"]', appData.email || appData.user_email || '');
      }
      if (await this.page.$('input[name="phone"]')) {
        await this.humanType('input[name="phone"]', appData.phone || '');
      }

      await this.logger.info('Scanning and answering all custom Lever questions...');
      const formFields = await this.extractFormFields();
      const answers = await this.askAIForAnswers(formFields, appData);

      for (let i = 0; i < formFields.length; i++) {
        const field = formFields[i];
        const answer = answers[String(i + 1)];
        if (answer && field.type !== 'file') {
          await this.fillField(field, answer);
          await this.page.waitForTimeout(150);
        }
      }

      await this.logger.info('Submitting Lever application...');
      await this.humanClick('button[type="submit"].postings-btn, button[type="submit"], input[type="submit"]');
      await this.page.waitForTimeout(4000);

      await this.logger.success('Lever Application submitted successfully.');
      return { success: true, message: 'Application submitted on Lever.' };
    } catch (error) {
      await this.logger.error('Lever Plugin error:', error.message);
      return { success: false, message: error.message };
    }
  }
}
