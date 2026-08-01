import GenericPlugin from './generic.js';
import path from 'path';

export default class GreenhousePlugin extends GenericPlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
  }

  async run(appData, resumePath) {
    try {
      await this.logger.info(`Starting Greenhouse application for ${appData.job_title || 'Job'} at ${appData.company || 'Company'}`);
      await this.page.goto(appData.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2500);

      const applyBtn = await this.page.$('#apply_button, a[href*="#app"]');
      if (applyBtn) {
        await this.humanClick('#apply_button, a[href*="#app"]');
        await this.page.waitForTimeout(1000);
      }

      const fileInput = await this.page.$('input[type="file"][name="resume"], input[type="file"][data-source="resume"], #s3_upload_for_resume input[type="file"], input[type="file"]');
      if (fileInput && resumePath) {
        await fileInput.setInputFiles(path.resolve(resumePath)).catch(() => {});
        await this.page.waitForTimeout(2000);
      }

      const names = (appData.candidate_name || 'Applicant').split(' ');
      const firstName = names[0];
      const lastName = names.length > 1 ? names.slice(1).join(' ') : 'Applicant';

      if (await this.page.$('#first_name')) await this.humanType('#first_name', firstName);
      if (await this.page.$('#last_name')) await this.humanType('#last_name', lastName);
      if (await this.page.$('#email')) await this.humanType('#email', appData.email || appData.user_email || '');
      if (await this.page.$('#phone')) await this.humanType('#phone', appData.phone || '');

      await this.logger.info('Scanning and answering custom questions (School, Degree, Discipline, Visa, Why Work at Company, Salary, Start Date)...');
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

      await this.logger.info('Submitting Greenhouse application...');
      await this.humanClick('input[type="submit"]#submit_app, button#submit_app, button[type="submit"], input[type="submit"]');
      await this.page.waitForTimeout(4000);

      await this.logger.success('Greenhouse Application submitted successfully.');
      return { success: true, message: 'Application submitted on Greenhouse.' };
    } catch (error) {
      await this.logger.error('Greenhouse Plugin error:', error.message);
      return { success: false, message: error.message };
    }
  }
}
