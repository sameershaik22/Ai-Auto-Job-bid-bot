import BasePlugin from '../BasePlugin.js';
import path from 'path';

export default class LeverPlugin extends BasePlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
  }

  async run(appData, resumePath) {
    try {
      await this.logger.info(`Starting Lever application for ${appData.job_title} at ${appData.company}`);
      await this.page.goto(appData.url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(2000); // Wait for scripts to execute

      // Check if the "Apply" button needs to be clicked to show the form
      const applyBtn = await this.page.$('a.postings-btn, button.postings-btn');
      if (applyBtn) {
        await this.humanClick('a.postings-btn, button.postings-btn');
        await this.page.waitForTimeout(1500);
      }

      await this.logger.info('Uploading Resume...');
      // Lever usually uses an input[type="file"] hidden somewhere, sometimes with name="resume"
      const fileInput = await this.page.$('input[type="file"][name="resume"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(resumePath));
        await this.page.waitForTimeout(2500); // Wait for Lever to parse resume
      } else {
        await this.logger.warning('Could not find file upload input on Lever.');
      }

      await this.logger.info('Filling out applicant details...');
      // Lever uses standard name attributes for core fields
      if (await this.page.$('input[name="name"]')) {
        await this.humanType('input[name="name"]', appData.candidate_name);
      }

      if (await this.page.$('input[name="email"]')) {
        await this.humanType('input[name="email"]', appData.user_email || 'candidate@example.com'); // Assume email is passed or mock
      }

      if (await this.page.$('input[name="phone"]')) {
        await this.humanType('input[name="phone"]', '123-456-7890');
      }

      if (await this.page.$('input[name="org"]')) {
        await this.humanType('input[name="org"]', 'Tech Company');
      }

      if (await this.page.$('input[name="urls[LinkedIn]"]')) {
        await this.humanType('input[name="urls[LinkedIn]"]', `https://linkedin.com/in/${appData.candidate_name.replace(/\s+/g, '').toLowerCase()}`);
      }

      if (await this.page.$('input[name="urls[GitHub]"]')) {
        await this.humanType('input[name="urls[GitHub]"]', `https://github.com/${appData.candidate_name.replace(/\s+/g, '').toLowerCase()}`);
      }

      if (appData.cover_letter && await this.page.$('textarea[name="comments"]')) {
        await this.logger.info('Adding AI-generated cover letter...');
        await this.humanType('textarea[name="comments"]', appData.cover_letter);
      }

      // Handle custom Lever questions (Consent checkboxes, etc.)
      const checkboxes = await this.page.$$('input[type="checkbox"]');
      for (const cb of checkboxes) {
        // Just checking mandatory checkboxes randomly or skipping if complex
        try {
          await cb.check({ force: true });
        } catch (e) {
          // Ignore checkbox errors
        }
      }

      await this.logger.info('Submitting application...');
      // Find the submit button
      await this.humanClick('button[type="submit"].postings-btn');
      await this.page.waitForTimeout(5000); // Wait for submission network request

      // Check for success confirmation text
      const content = await this.page.content();
      if (content.toLowerCase().includes('application submitted') || content.toLowerCase().includes('thank you')) {
        await this.logger.success('Lever Application submitted successfully.');
        return { success: true, message: 'Application submitted on Lever.' };
      } else {
        await this.logger.warning('Submission completed but confirmation message not detected.');
        return { success: true, message: 'Application submitted (unconfirmed)' };
      }

    } catch (error) {
      await this.logger.error('Lever Plugin Failed:', error.message);
      return { success: false, message: error.message };
    }
  }
}
