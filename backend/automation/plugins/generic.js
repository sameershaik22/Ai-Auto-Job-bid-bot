import BasePlugin from '../BasePlugin.js';
import path from 'path';
import fs from 'fs';
import { QuestionService } from '../../services/questionService.js';

export default class GenericPlugin extends BasePlugin {
  constructor(page, logger, config = {}) {
    super(page, logger, config);
    this.gemini          = config.gemini || null;
    this.questionService = new QuestionService(this.gemini);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIELD EXTRACTION — handles dynamic content, React, aria, comboboxes
  // ─────────────────────────────────────────────────────────────────────────

  async extractFormFields() {
    // Wait for any pending JS rendering
    await this.page.waitForTimeout(800);

    return await this.page.evaluate(() => {
      const fields = [];
      const seen   = new Set();

      const allInputs = document.querySelectorAll([
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
        'textarea',
        'select',
        '[role="combobox"]:not(input)',
        '[contenteditable="true"]',
      ].join(', '));

      allInputs.forEach((el, i) => {
        // Dedup by id or name+type
        const dedupeKey = el.id || `${el.tagName}_${el.name || ''}_${el.type || ''}_${i}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        // ── Label resolution (6 strategies) ─────────────
        let label = '';

        // 1. <label for="id">
        if (!label && el.id) {
          try {
            const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (labelEl) label = labelEl.innerText.trim();
          } catch {}
        }

        // 2. aria-label
        if (!label) label = el.getAttribute('aria-label') || '';

        // 3. aria-labelledby
        if (!label) {
          const lbId = el.getAttribute('aria-labelledby');
          if (lbId) {
            const lbEl = document.getElementById(lbId);
            if (lbEl) label = lbEl.innerText.trim();
          }
        }

        // 4. Closest <label> wrapper
        if (!label) {
          const wrapper = el.closest('label');
          if (wrapper) {
            const clone = wrapper.cloneNode(true);
            // Remove child inputs so we get only the text
            clone.querySelectorAll('input,select,textarea').forEach(c => c.remove());
            label = clone.innerText.trim();
          }
        }

        // 5. Parent container label/legend/question element
        if (!label) {
          const parent = el.closest('div[class*="field"], div[class*="question"], div[class*="form"], fieldset, li, p, td, section');
          if (parent) {
            const labelEl = parent.querySelector(
              'label, legend, [class*="label"], [class*="question"], [class*="title"], p:first-child, h3, h4, strong, span:first-child'
            );
            if (labelEl && !labelEl.contains(el)) {
              label = labelEl.innerText.trim().substring(0, 150);
            }
          }
        }

        // 6. Preceding sibling text or placeholder
        if (!label) {
          let prev = el.previousElementSibling;
          let maxSteps = 3;
          while (prev && maxSteps-- > 0) {
            const t = prev.innerText?.trim();
            if (t && t.length > 0 && t.length < 200) { label = t; break; }
            prev = prev.previousElementSibling;
          }
        }

        if (!label) label = el.placeholder || el.name || el.id || `field_${i}`;

        // ── Selector ─────────────────────────────────────
        let selector;
        if (el.id) {
          try { selector = `[id="${CSS.escape(el.id)}"]`; } catch { selector = `#${el.id}`; }
        } else if (el.name) {
          selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
        } else {
          const role = el.getAttribute('role');
          const ariaLabel = el.getAttribute('aria-label');
          if (role && ariaLabel) {
            selector = `[role="${role}"][aria-label="${ariaLabel}"]`;
          } else if (role) {
            selector = `[role="${role}"]`;
          } else {
            selector = `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`;
          }
        }

        // ── Options ──────────────────────────────────────
        let options = [];
        const tagLower = el.tagName.toLowerCase();
        const role     = el.getAttribute('role') || '';
        const elType   = el.type || tagLower;

        if (tagLower === 'select') {
          options = Array.from(el.options)
            .map(o => o.text.trim())
            .filter(t => t && !/^select/i.test(t) && t !== '—' && t !== '');
        } else if (elType === 'radio' && el.name) {
          const rGroup = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
          options = Array.from(rGroup).map(r => {
            if (r.id) {
              const lbl = document.querySelector(`label[for="${r.id}"]`);
              if (lbl) return lbl.innerText.trim();
            }
            const parent = r.closest('label, div, li');
            if (parent) return parent.innerText.trim();
            return r.value;
          }).filter(Boolean);
        } else if (role === 'combobox' || role === 'listbox') {
          const owns = el.getAttribute('aria-owns') || el.getAttribute('aria-controls');
          if (owns) {
            const listEl = document.getElementById(owns);
            if (listEl) {
              options = Array.from(listEl.querySelectorAll('[role="option"]'))
                .map(o => o.innerText.trim()).filter(Boolean);
            }
          }
        }

        // Detect if React controls this element
        const isReact = Object.keys(el).some(k => k.startsWith('__reactFiber') || k.startsWith('_reactFiber'));

        fields.push({
          selector,
          type:           elType,
          label:          label.substring(0, 150),
          name:           el.name || '',
          placeholder:    el.placeholder || '',
          required:       el.required || el.getAttribute('aria-required') === 'true',
          tagName:        tagLower,
          role,
          options,
          isReact,
        });
      });

      return fields;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILL FIELD — supports React, combobox, contenteditable, radio, checkbox
  // ─────────────────────────────────────────────────────────────────────────

  async fillField(field, value) {
    if (value === undefined || value === null || value === '') return;

    try {
      await this.page.waitForSelector(field.selector, { state: 'visible', timeout: 3000 }).catch(() => {});

      const tagName = field.tagName;
      const type    = field.type;
      const role    = field.role;

      if (tagName === 'select') {
        await this.selectOption(field.selector, String(value));

      } else if (role === 'combobox') {
        await this._fillCombobox(field.selector, String(value));

      } else if (type === 'range') {
        await this.page.evaluate(({ sel, val }) => {
          const el = document.querySelector(sel);
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, { sel: field.selector, val: String(value) }).catch(() => {});

      } else if (type === 'radio') {
        await this._fillRadio(field, String(value));

      } else if (type === 'checkbox') {
        const v = String(value).toLowerCase();
        if (v === 'true' || v === 'yes' || v === '1') {
          await this.page.check(field.selector).catch(() => {});
        }

      } else if (tagName === 'div' || tagName === 'span' || tagName === 'p') {
        // contenteditable
        await this.page.evaluate(({ sel, val }) => {
          const el = document.querySelector(sel);
          if (el) {
            el.focus();
            el.innerText = val;
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, { sel: field.selector, val: String(value) }).catch(() => {});

      } else if (field.isReact) {
        // React-controlled input — use native setter to bypass React's synthetic event system
        await this.page.evaluate(({ sel, val }) => {
          const el = document.querySelector(sel);
          if (!el) return;
          const nativeSetter =
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,    'value')?.set ||
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, val);
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, { sel: field.selector, val: String(value) }).catch(() => {});

      } else {
        // Standard text / email / tel / url / number / textarea
        await this.humanType(field.selector, String(value));
      }

    } catch { /* silent — logs already captured at higher level */ }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMBOBOX HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  async _fillCombobox(selector, value) {
    try {
      await this.humanClick(selector);
      await this.page.waitForTimeout(500);

      // Type first few chars to filter the dropdown
      await this.page.keyboard.type(String(value).substring(0, 10));
      await this.page.waitForTimeout(800);

      // Click matching option
      const clicked = await this.page.evaluate((val) => {
        const valLower = val.toLowerCase();
        const opts = document.querySelectorAll('[role="option"], li[role="menuitem"], .dropdown-item, .select-option, [class*="option"]');
        for (const opt of opts) {
          if (opt.innerText.toLowerCase().includes(valLower)) {
            opt.click();
            return true;
          }
        }
        return false;
      }, String(value));

      if (!clicked) {
        await this.page.keyboard.press('ArrowDown');
        await this.page.waitForTimeout(200);
        await this.page.keyboard.press('Enter');
      }

      await this.page.waitForTimeout(300);
    } catch {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RADIO HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  async _fillRadio(field, value) {
    await this.page.evaluate(({ sel, val, name }) => {
      const valLower = String(val).toLowerCase().trim();
      let radios = name
        ? Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`))
        : [];
      if (!radios.length) {
        const el = document.querySelector(sel);
        if (el) radios = [el];
      }

      const score = (r) => {
        let lbl = '';
        if (r.id) {
          const l = document.querySelector(`label[for="${r.id}"]`);
          if (l) lbl = l.innerText;
        }
        if (!lbl) {
          const p = r.closest('label, div, li, p');
          if (p) lbl = p.innerText;
        }
        const combined = `${r.value} ${lbl}`.toLowerCase();
        if (combined === valLower) return 3;
        if (combined.includes(valLower)) return 2;
        if (valLower === 'yes' && (r.value === '1' || combined.includes('yes'))) return 2;
        if (valLower === 'no'  && (r.value === '0' || combined.includes('no')))  return 2;
        return 0;
      };

      const sorted = radios.map(r => ({ r, s: score(r) })).sort((a, b) => b.s - a.s);
      const target = sorted[0]?.s > 0 ? sorted[0].r : radios[0];

      if (target) {
        target.checked = true;
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { sel: field.selector, val: value, name: field.name }).catch(() => {});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  // Detect ATS platform from a URL (used after redirects)
  _detectATSPlatform(url) {
    if (!url) return 'generic';
    const u = url.toLowerCase();
    if (u.includes('jobs.lever.co') || u.includes('lever.co/'))               return 'lever';
    if (u.includes('boards.greenhouse.io') || u.includes('greenhouse.io'))    return 'greenhouse';
    if (u.includes('ashbyhq.com') || u.includes('jobs.ashbyhq.com'))          return 'ashby';
    if (u.includes('smartrecruiters.com'))                                     return 'smartrecruiters';
    if (u.includes('workday.com') || u.includes('myworkdayjobs.com'))         return 'workday';
    if (u.includes('taleo.net'))                                               return 'taleo';
    if (u.includes('icims.com'))                                               return 'icims';
    if (u.includes('bamboohr.com'))                                            return 'bamboohr';
    if (u.includes('indeed.com'))                                              return 'indeed';
    if (u.includes('linkedin.com'))                                            return 'linkedin';
    if (u.includes('glassdoor.com'))                                           return 'glassdoor';
    return 'generic';
  }

  async _clickApplyButton() {
    const currentUrl = this.page.url();
    const platform   = this._detectATSPlatform(currentUrl);

    // Platform-specific selectors checked FIRST for precision
    const platformSelectors = {
      indeed: [
        // Indeed Easy Apply (inline modal)
        '#indeedApplyButton',
        '.ia-IndeedApplyButton',
        'button[data-indeed-apply]',
        '.indeed-apply-button',
        // "Apply on company site" external link
        'a[href*="smartapply"]',
        'a[href*="apply.indeed"]',
        'a.jcs-JobTitle ~ * a',         // apply link near job title
        '.jobsearch-IndeedApplyButton-newDesign',
        '.jobsearch-IndeedApplyButton',
        'button.ia-continueButton',
        // Fallback: any visible apply button on Indeed pages
        'a[data-jk]',
        '[id*="apply"]',
      ],
      linkedin: [
        '.jobs-apply-button',
        'button.jobs-apply-button',
        'button:has-text("Easy Apply")',
        'button:has-text("Apply")',
        '[data-control-name="jobdetails_topcard_inapply"]',
      ],
      glassdoor: [
        'button[data-test="applyButton"]',
        '.apply-button',
        'button:has-text("Easy Apply")',
        'button:has-text("Apply Now")',
        'a[href*="apply"]',
      ],
    };

    // Generic selectors as fallback
    const genericSelectors = [
      'button:has-text("Apply now")',   'a:has-text("Apply now")',
      'button:has-text("Apply Now")',   'a:has-text("Apply Now")',
      'button:has-text("Apply")',       'a:has-text("Apply")',
      'a[href*="apply"]',               'button[aria-label*="Apply"]',
      'button[data-automation*="apply"]', '.apply-button', '#apply-button',
      'button[data-qa="btn-apply"]',    '.job-apply-button',
      '#apply_button', '[data-job-apply]', 'a[data-apply]',
    ];

    const selectors = [
      ...(platformSelectors[platform] || []),
      ...genericSelectors,
    ];

    for (const sel of selectors) {
      try {
        const btn = await this.page.$(sel);
        if (!btn) continue;
        if (!await btn.isVisible().catch(() => false)) continue;

        await this.logger.info(`🖱️  Clicking apply button [${platform.toUpperCase()}] (${sel})...`);

        // Watch for a new tab
        const ctx         = this.page.context();
        const pagePromise = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);

        await btn.click({ force: true }).catch(async () => {
          await this.page.evaluate(b => b.click(), btn).catch(() => {});
        });

        const newPage = await pagePromise;
        if (newPage) {
          await newPage.waitForLoadState('domcontentloaded').catch(() => {});
          const newATS = this._detectATSPlatform(newPage.url());
          await this.logger.info(
            `📂 Apply opened in new tab → ATS: ${newATS.toUpperCase()} (${newPage.url()})`
          );
          this.page = newPage;
        } else {
          // Wait for navigation on same tab
          await this.page.waitForTimeout(3000);
          const afterUrl = this.page.url();
          if (afterUrl !== currentUrl) {
            const newATS = this._detectATSPlatform(afterUrl);
            await this.logger.info(
              `📂 Apply redirected → ATS: ${newATS.toUpperCase()} (${afterUrl})`
            );
          }
        }

        await this.page.waitForTimeout(2000);
        return true;
      } catch {}
    }

    return false;
  }

  async _uploadResume(resumePath) {
    if (!resumePath || !fs.existsSync(resumePath)) return;
    try {
      const fileInputs = await this.page.$$('input[type="file"]');
      let uploaded = false;
      for (const fi of fileInputs) {
        await fi.setInputFiles(path.resolve(resumePath)).catch(() => {});
        uploaded = true;
      }
      if (uploaded) {
        await this.logger.info(`📎 Attached resume: ${path.basename(resumePath)}`);
        await this.page.waitForTimeout(1500);
      }
    } catch {}
  }

  async _findSubmitButton() {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit your application")',
      'button:has-text("Submit Application")',
      'button:has-text("Submit")',
      'button:has-text("Send Application")',
      'button:has-text("Complete Application")',
      'button:has-text("Finish")',
      '[data-qa="btn-submit"]',
      '.submit-btn',
      '#submit-btn',
      'button[class*="submit"]',
    ];
    for (const sel of selectors) {
      try {
        const btn = await this.page.$(sel);
        if (btn && await btn.isVisible().catch(() => false)) return btn;
      } catch {}
    }
    return null;
  }

  async _findNextButton() {
    const selectors = [
      'button:has-text("Next step")',
      'button:has-text("Next Step")',
      'button:has-text("Next")',
      'button:has-text("Continue")',
      'button:has-text("Proceed")',
      '[role="button"]:has-text("Next")',
      '[role="button"]:has-text("Continue")',
      'button[class*="next"]',
      'button[class*="continue"]',
      'button[data-qa="btn-next"]',
      'a:has-text("Next")',
    ];
    for (const sel of selectors) {
      try {
        const btn = await this.page.$(sel);
        if (btn && await btn.isVisible().catch(() => false)) return btn;
      } catch {}
    }
    return null;
  }

  async _verifySubmission() {
    try {
      // 1. Success URL pattern (most reliable)
      const url = this.page.url().toLowerCase();
      if (/thank|confirmation|success|complete|submitted|applied|received|congrat/.test(url))
        return true;

      // 2. Success text on page
      const bodyText = await this.page.evaluate(() => document.body?.innerText || '');
      if (/thank you for applying|application submitted|successfully submitted|application received|we have received your application|your application has been|you have applied|application complete|we'll be in touch|your submission has been|successfully applied|return to job search|one more step/i.test(bodyText))
        return true;

      // NOTE: "no errors on page" is NOT a success signal — a job listing page
      // also has no errors. We only return true on explicit confirmation signals.
      return false;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RUN — Multi-step form loop
  // ─────────────────────────────────────────────────────────────────────────

  async run(appData, resumePath) {
    const appId = appData.id || 'app';
    try {
      const targetUrl = appData.url || appData.job_url;
      await this.logger.info(`🌐 Generic Plugin: Navigating to ${targetUrl}`);
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2500);

      await this.captureStageEvidence('01_loaded', appId);
      await this.detectAndHandleCaptcha();

      // Click "Apply" if on a job listing page
      await this._clickApplyButton();
      await this.captureStageEvidence('02_apply_clicked', appId);

      // Upload resume on landing page
      await this._uploadResume(resumePath);

      // ── Multi-step form loop ────────────────────────────
      let pageNumber   = 1;
      const maxPages   = 15;
      let submitted    = false;
      let applyRetries = 0;     // how many times we've retried finding an apply button
      const maxApplyRetries = 3;

      while (pageNumber <= maxPages && !submitted) {
        await this.logger.info(`📋 Processing form page ${pageNumber}...`);
        await this.page.waitForTimeout(1200);

        // Extract all visible form fields on this page
        const formFields = await this.extractFormFields();
        await this.logger.info(`Found ${formFields.length} field(s) on page ${pageNumber}.`);

        // ── 0 fields: we're on a listing/info page, NOT a form ──────────────
        // This happens when the apply button wasn't clicked yet, or the SPA
        // hasn't rendered the form yet. Never try to submit here.
        if (formFields.length === 0) {
          if (applyRetries < maxApplyRetries) {
            applyRetries++;
            await this.logger.info(
              `⏳ No form fields detected — searching for apply button (attempt ${applyRetries}/${maxApplyRetries})...`
            );

            // Look for apply/start buttons aggressively
            const foundApply = await this._clickApplyButton();
            if (foundApply) {
              await this.logger.info('✅ Found apply button — waiting for form to load...');
              await this.page.waitForTimeout(3000);
              await this._uploadResume(resumePath);
              // Don't increment pageNumber — rescan this "page" as the new form
              continue;
            }

            // Try page-level scroll and wait for dynamic content
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await this.page.waitForTimeout(2000);
            await this.page.evaluate(() => window.scrollTo(0, 0));
            await this.page.waitForTimeout(1000);
            continue;  // rescan after scroll

          } else {
            // Exhausted apply-button retries with 0 fields — give up cleanly
            await this.captureStageEvidence('failed_no_form', appId);
            await this.logger.error(
              'Automation stopped:',
              `Could not find the application form after ${maxApplyRetries} attempts. ` +
              'The page may require login, CAPTCHA, or has a non-standard apply flow. ' +
              'Check screenshots to see what the browser sees.'
            );
            return {
              success: false,
              message: `No application form found after ${maxApplyRetries} attempts. ` +
                       'Screenshots saved — please check the apply URL and login status.',
            };
          }
        }

        // ── We have form fields — fill them ─────────────────────────────────
        applyRetries = 0; // reset since we found a form

        const answers     = await this.questionService.resolveAll(formFields, appData, this.logger);
        const answeredCnt = Object.keys(answers).length;
        await this.logger.info(`✅ Answered ${answeredCnt}/${formFields.length} fields.`);

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
            await this.page.waitForTimeout(200);
          }
        }

        await this.captureStageEvidence(`page_${pageNumber}_filled`, appId);
        await this.detectAndHandleCaptcha();

        // ── STRICT CROSS-CHECK: Ensure all fields are answered before submitting ──
        let unansweredCount = 0;
        for (let i = 0; i < formFields.length; i++) {
          const field = formFields[i];
          if (field.type === 'file' || field.type === 'hidden' || field.type === 'submit' || field.tagName === 'button') continue;
          if (!answers[String(i + 1)]) {
            unansweredCount++;
            await this.logger.warning(`⚠️ Unanswered field detected: ${field.label || field.name || field.placeholder}`);
          }
        }

        if (unansweredCount > 0) {
          await this.logger.error(`Automation stopped: ${unansweredCount} field(s) were left unanswered. Preventing incomplete submission.`);
          return {
            success: false,
            message: `Skipped ${unansweredCount} question(s). Aborted to prevent submitting an incomplete application.`,
          };
        }

        // ── Submit? ──────────────────────────────────────────────────────────
        const submitBtn = await this._findSubmitButton();
        if (submitBtn) {
          await this.logger.info('🚀 Submit button found — submitting application...');
          await submitBtn.click({ force: true }).catch(async () => {
            await this.page.evaluate(b => b.click(), submitBtn).catch(() => {});
          });
          await this.page.waitForTimeout(5000);
          submitted = true;

        } else {
          // ── Next/Continue? ───────────────────────────────────────────────
          const nextBtn = await this._findNextButton();
          if (nextBtn) {
            const prevUrl = this.page.url();
            await this.logger.info(`➡️  Moving to page ${pageNumber + 1}...`);
            await nextBtn.click({ force: true }).catch(async () => {
              await this.page.evaluate(b => b.click(), nextBtn).catch(() => {});
            });
            await this.page.waitForTimeout(2500);

            const newUrl = this.page.url();
            if (newUrl !== prevUrl) {
              await this.logger.info(`📄 Navigated: ${newUrl}`);
            }
            await this._uploadResume(resumePath);
            pageNumber++;

          } else {
            // ── DOM fallback: SAFE — only uses real form submit, never any-button ──
            // This runs ONLY when we have form fields but no visible submit/next button
            await this.logger.info('⚡ No explicit submit button visible — trying form.requestSubmit()...');
            const jsSubmitted = await this.page.evaluate(() => {
              const form = document.querySelector('form');
              if (!form) return false;
              // Only trigger real submit — never click navigation/search buttons
              const submitEl = form.querySelector('input[type="submit"], button[type="submit"]');
              if (submitEl) { submitEl.click(); return true; }
              if (typeof form.requestSubmit === 'function') { form.requestSubmit(); return true; }
              return false;
            });

            if (jsSubmitted) {
              await this.page.waitForTimeout(4000);
              submitted = true;
            } else {
              await this.captureStageEvidence('failed_no_submit', appId);
              await this.logger.warning(
                'No submit button or form.requestSubmit() found. ' +
                'The form may use a non-standard submit trigger. Check screenshots.'
              );
              break;
            }
          }
        }
      }

      // ── Guard: if we exited the loop without submitting ──────────────────
      if (!submitted) {
        await this.captureStageEvidence('failed_no_submit', appId);
        await this.logger.error(
          'Automation stopped:',
          'Loop ended without submitting. Check screenshots — may need login or CAPTCHA.'
        );
        return {
          success: false,
          message: 'Automation loop ended without submitting the application. ' +
                   'Screenshots saved — check apply URL, login state, and CAPTCHA.',
        };
      }

      // ── Verify submission ─────────────────────────────────────────────────
      await this.captureStageEvidence('final_confirmation', appId);
      const confirmed    = await this._verifySubmission();
      const confirmation = await this.extractSubmissionConfirmation();

      if (confirmed) {
        await this.logger.success(`✅ Application confirmed! Tracking ID: ${confirmation.trackingId || 'N/A'}`);
      } else {
        await this.logger.warning(
          '⚠️  Form submitted but no confirmation page detected — ' +
          'screenshots saved. Verify manually that the application went through.'
        );
      }

      return {
        success:         true,
        message:         confirmed
          ? 'Application submitted and confirmed.'
          : 'Form submitted (no confirmation page detected — check screenshots).',
        trackingId:      confirmation.trackingId,
        confirmationUrl: confirmation.confirmationUrl,
        confirmed,
      };

    } catch (error) {
      await this.logger.error('Generic Plugin error:', error.message);
      return { success: false, message: error.message };
    }
  }
}

