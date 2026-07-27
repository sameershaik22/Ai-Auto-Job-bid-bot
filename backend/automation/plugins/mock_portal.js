import BasePlugin from '../BasePlugin.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class MockPortalPlugin extends BasePlugin {
  async run(application, resumeFilePath) {
    this.logger.info('Initializing visual application workflow on LeverageHQ...');

    const targetUrl = 'http://localhost:5000/mock-recruiter/index.html';
    this.logger.info(`Browser navigating to local portal: ${targetUrl}`);
    await this.page.goto(targetUrl);
    await this.page.waitForTimeout(1000);
    await this.takeScreenshot('1_navigation_success');

    this.logger.info(`Entering candidate profile name: ${application.candidate_name}`);
    await this.humanType('#fullName', application.candidate_name);
    await this.takeScreenshot('2_form_name_entered');

    const email = application.email || `${application.candidate_name.toLowerCase().replace(/\s+/g, '')}@example.com`;
    this.logger.info(`Entering contact email address: ${email}`);
    await this.humanType('#email', email);

    this.logger.info('Injecting extracted matching technical skills...');
    const skillsText = Array.isArray(application.skills) ? application.skills.join(', ') : application.skills;
    await this.humanType('#skills', skillsText);

    this.logger.info('Injecting custom tailored cover letter (500 words)...');
    await this.humanType('#coverLetter', application.cover_letter);
    await this.takeScreenshot('3_inputs_populated');

    this.logger.info(`Uploading physical resume: ${path.basename(resumeFilePath)}`);
    const fileInput = await this.page.$('#resume-file');
    await fileInput.setInputFiles(resumeFilePath);
    await this.page.waitForTimeout(1200); 
    await this.takeScreenshot('4_resume_uploaded');

    this.logger.info('Clicking application submission anchor...');
    await this.humanClick('#submit-btn');
    this.logger.info('Form submitted. Awaiting ATS processing screen...');
    await this.page.waitForTimeout(2500); 

    const successVisible = await this.page.isVisible('#success-card');
    if (successVisible) {
      const trackingId = await this.page.textContent('#tracking-id');
      this.logger.info(`Submission successfully processed by LeverageHQ ATS. Tracking ID: ${trackingId.trim()}`);
      await this.takeScreenshot('5_submission_complete');
      return { success: true, trackingId: trackingId.trim() };
    } else {
      this.logger.error('ATS application submit error: confirmation screen not found.');
      await this.takeScreenshot('5_submission_failed');
      throw new Error('ATS confirmation view not rendered.');
    }
  }

  async takeScreenshot(actionName) {
    const filename = `${Date.now()}_${actionName}.png`;
    const storageDir = path.resolve(__dirname, '../../public/screenshots');
    const filepath = path.join(storageDir, filename);

    await this.page.screenshot({ path: filepath });
    this.logger.screenshot(actionName, `/screenshots/${filename}`);
  }
}
