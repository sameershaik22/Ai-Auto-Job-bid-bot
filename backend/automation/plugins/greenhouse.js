import BasePlugin from '../BasePlugin.js';
import path from 'path';

export default class GreenhousePlugin extends BasePlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
  }

  async run(appData, resumePath) {
    try {
      await this.logger.info(`Starting Greenhouse application for ${appData.job_title} at ${appData.company}`);
      await this.page.goto(appData.url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(2000); // Wait for scripts to execute

      // Greenhouse sometimes has a button to scroll to the form or open it
      const applyBtn = await this.page.$('#apply_button');
      if (applyBtn) {
        await this.humanClick('#apply_button');
        await this.page.waitForTimeout(1000);
      }

      await this.logger.info('Uploading Resume...');
      // Greenhouse uses a complex upload widget but usually has a hidden input
      // Sometimes it's inside an iframe or uses #resume or input[data-source="resume"]
      const fileInput = await this.page.$('input[type="file"][name="resume"], input[type="file"][data-source="resume"], #s3_upload_for_resume input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(resumePath));
        await this.page.waitForTimeout(3000); // Wait for Greenhouse to upload and parse
      } else {
        await this.logger.warning('Could not find resume upload input on Greenhouse.');
      }

      await this.logger.info('Filling out applicant details...');
      
      // Split name for Greenhouse (first/last)
      const names = appData.candidate_name.split(' ');
      const firstName = names[0];
      const lastName = names.length > 1 ? names.slice(1).join(' ') : 'Applicant';

      if (await this.page.$('#first_name')) {
        await this.humanType('#first_name', firstName);
      }

      if (await this.page.$('#last_name')) {
        await this.humanType('#last_name', lastName);
      }

      if (await this.page.$('#email')) {
        await this.humanType('#email', appData.user_email || 'candidate@example.com');
      }

      if (await this.page.$('#phone')) {
        await this.humanType('#phone', '123-456-7890');
      }

      // Handle Cover Letter (usually another upload widget or a text area)
      const coverLetterInput = await this.page.$('textarea#cover_letter_text, #cover_letter_text_container textarea');
      if (appData.cover_letter && coverLetterInput) {
        await this.logger.info('Adding AI-generated cover letter...');
        await this.humanType(coverLetterInput, appData.cover_letter);
      }

      // Answer common custom questions
      if (await this.page.$('input[name="job_application[answers_attributes][0][text_value]"]')) {
         await this.humanType('input[name="job_application[answers_attributes][0][text_value]"]', 'https://linkedin.com/in/' + appData.candidate_name.replace(/\s+/g, '').toLowerCase());
      }

      await this.logger.info('Submitting application...');
      // Find the submit button
      await this.humanClick('input[type="submit"]#submit_app, button#submit_app');
      await this.page.waitForTimeout(6000); // Wait for submission network request

      // Check for success confirmation text
      const content = await this.page.content();
      if (content.toLowerCase().includes('application submitted') || content.toLowerCase().includes('thank you')) {
        await this.logger.success('Greenhouse Application submitted successfully.');
        return { success: true, message: 'Application submitted on Greenhouse.' };
      } else {
        await this.logger.warning('Submission completed but confirmation message not detected.');
        return { success: true, message: 'Application submitted (unconfirmed)' };
      }

    } catch (error) {
      await this.logger.error('Greenhouse Plugin Failed:', error.message);
      return { success: false, message: error.message };
    }
  }
}
