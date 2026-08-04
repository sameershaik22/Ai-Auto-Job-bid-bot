import GenericPlugin from './generic.js';
import path from 'path';
import fs from 'fs';

/**
 * GreenhousePlugin — handles boards.greenhouse.io applications.
 *
 * Greenhouse forms are typically multi-page:
 *   Page 1: Personal info (name, email, phone, address, LinkedIn)
 *   Page 2+: Custom questions (work auth, education, "Why us?", EEO)
 *   Final:   Submit
 *
 * Inherits all helpers from GenericPlugin (QuestionService, fillField,
 * humanType, selectOption, captureStageEvidence, etc.)
 */
export default class GreenhousePlugin extends GenericPlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
  }

  async run(appData, resumePath) {
    const appId = appData.id || 'app';
    try {
      await this.logger.info(
        `🌿 Starting Greenhouse application for "${appData.job_title || 'Job'}" at ${appData.company || 'Company'}`
      );

      await this.page.goto(appData.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2500);
      await this.captureStageEvidence('gh_01_loaded', appId);

      // ── Click apply button if on the job listing page ─────
      const applyBtn = await this.page.$(
        '#apply_button, a[href*="#app"], button:has-text("Apply for this job"), a:has-text("Apply")'
      ).catch(() => null);

      if (applyBtn && await applyBtn.isVisible().catch(() => false)) {
        await this.logger.info('Clicking Greenhouse apply button...');
        await applyBtn.click({ force: true }).catch(async () => {
          await this.page.evaluate(b => b.click(), applyBtn).catch(() => {});
        });
        await this.page.waitForTimeout(2000);
      }

      // ── Upload resume ─────────────────────────────────────
      await this._uploadResume(resumePath);
      await this.page.waitForTimeout(1000);
      await this.captureStageEvidence('gh_02_resume', appId);

      // ── Multi-step form loop ──────────────────────────────
      let pageNumber = 1;
      const maxPages = 12;
      let submitted  = false;

      while (pageNumber <= maxPages && !submitted) {
        await this.logger.info(`📋 Greenhouse form page ${pageNumber}...`);
        await this.page.waitForTimeout(1000);

        const formFields = await this.extractFormFields();
        await this.logger.info(`Detected ${formFields.length} field(s).`);

        if (formFields.length > 0) {
          const answers = await this.questionService.resolveAll(formFields, appData, this.logger);
          await this.logger.info(`✅ Resolved ${Object.keys(answers).length}/${formFields.length} answers.`);

          for (let i = 0; i < formFields.length; i++) {
            const field  = formFields[i];
            const answer = answers[String(i + 1)];

            if (field.type === 'file') {
              if (resumePath && fs.existsSync(resumePath)) {
                await this.page.setInputFiles(field.selector, path.resolve(resumePath)).catch(() => {});
                await this.page.waitForTimeout(800);
              }
              continue;
            }

            if (answer) {
              await this.fillField(field, answer);
              await this.page.waitForTimeout(180);
            }
          }
        }

        await this.captureStageEvidence(`gh_0${pageNumber + 2}_page_${pageNumber}`, appId);
        await this.detectAndHandleCaptcha();

        // ── Submit? ────────────────────────────────────────
        // Greenhouse uses: <input type="submit" id="submit_app"> or <button id="submit_app">
        const ghSubmit = await this.page.$(
          'input[type="submit"]#submit_app, button#submit_app, button[type="submit"], input[type="submit"]'
        ).catch(() => null);

        const genericSubmit = await this._findSubmitButton();
        const submitTarget  = ghSubmit || genericSubmit;

        if (submitTarget && await submitTarget.isVisible().catch(() => false)) {
          await this.logger.info('🚀 Submitting Greenhouse application...');
          await submitTarget.click({ force: true }).catch(async () => {
            await this.page.evaluate(b => b.click(), submitTarget).catch(() => {});
          });
          await this.page.waitForTimeout(5000);
          submitted = true;

        } else {
          // ── Next page? ───────────────────────────────────
          const nextBtn = await this._findNextButton();
          if (nextBtn && await nextBtn.isVisible().catch(() => false)) {
            const prevUrl = this.page.url();
            await this.logger.info(`➡️  Moving to Greenhouse page ${pageNumber + 1}...`);
            await nextBtn.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(2500);

            if (this.page.url() !== prevUrl) {
              await this.logger.info(`📄 Navigated: ${this.page.url()}`);
            }
            await this._uploadResume(resumePath);
            pageNumber++;

          } else {
            // No Next, no Submit — DOM fallback
            const jsOk = await this.page.evaluate(() => {
              const form = document.querySelector('form');
              if (!form) return false;
              const btn = form.querySelector('input[type="submit"], button[type="submit"], button');
              if (btn) { btn.click(); return true; }
              if (typeof form.requestSubmit === 'function') { form.requestSubmit(); return true; }
              return false;
            });
            if (jsOk) {
              await this.page.waitForTimeout(4000);
              submitted = true;
            } else {
              await this.logger.warning('No submit or next button found on Greenhouse page — stopping.');
              break;
            }
          }
        }
      }

      // ── Verify & return ───────────────────────────────────
      await this.captureStageEvidence('gh_final', appId);
      const confirmed    = await this._verifySubmission();
      const confirmation = await this.extractSubmissionConfirmation();

      if (confirmed) {
        await this.logger.success(
          `✅ Greenhouse application confirmed! Tracking ID: ${confirmation.trackingId || 'N/A'}`
        );
      } else {
        await this.logger.warning('⚠️  Greenhouse submit done but no confirmation page detected.');
      }

      return {
        success:         true,
        message:         'Application submitted on Greenhouse.',
        trackingId:      confirmation.trackingId,
        confirmationUrl: confirmation.confirmationUrl,
        confirmed,
      };

    } catch (error) {
      await this.logger.error('Greenhouse Plugin error:', error.message);
      return { success: false, message: error.message };
    }
  }
}
