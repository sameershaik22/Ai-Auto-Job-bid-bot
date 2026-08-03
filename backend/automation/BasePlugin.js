import path from 'path';
import fs from 'fs';

function sanitizeSelector(selector) {
  if (!selector) return selector;
  if (typeof selector === 'string' && selector.startsWith('#') && /^\d/.test(selector.substring(1))) {
    return `[id="${selector.substring(1)}"]`;
  }
  return selector;
}

export default class BasePlugin {
  constructor(page, logger, config = {}) {
    this.page = page;
    this.logger = logger;
    this.config = config;
  }

  async humanScrollTo(selector) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
      }, safeSelector).catch(() => {});
      await this.page.waitForTimeout(150 + Math.random() * 100);
    } catch {}
  }

  async humanType(selector, text) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.humanScrollTo(safeSelector);
      await this.page.waitForSelector(safeSelector, { state: 'visible', timeout: 4000 });
      const element = await this.page.$(safeSelector);
      if (!element) return;

      await element.focus();
      await this.page.evaluate(el => el.dispatchEvent(new Event('focus', { bubbles: true })), element).catch(() => {});

      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      
      for (const char of text) {
        await this.page.keyboard.type(char);
        const delay = Math.random() * 40 + 15; 
        await this.page.waitForTimeout(delay);
      }
      
      await this.page.evaluate(el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }, element).catch(() => {});

      await this.page.waitForTimeout(Math.random() * 80 + 30); 
    } catch (error) {
      if (this.logger) this.logger.warning(`Warning typing into selector: ${safeSelector} (${error.message})`);
    }
  }

  async humanClick(selector) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.humanScrollTo(safeSelector);
      await this.page.waitForSelector(safeSelector, { state: 'visible', timeout: 4000 });
      const element = await this.page.$(safeSelector);
      if (!element) return;
      
      const box = await element.boundingBox();
      if (box) {
        const targetX = box.x + box.width / 2 + (Math.random() * 4 - 2);
        const targetY = box.y + box.height / 2 + (Math.random() * 4 - 2);

        // Natural curved mouse movement steps
        await this.page.mouse.move(targetX, targetY, { steps: 10 });
        await this.page.waitForTimeout(80 + Math.random() * 80);
        
        await this.page.mouse.down();
        await this.page.waitForTimeout(40 + Math.random() * 30);
        await this.page.mouse.up();
      } else {
        await element.click();
      }
      
      await this.page.waitForTimeout(180 + Math.random() * 120); 
    } catch (error) {
      if (this.logger) this.logger.warning(`Warning clicking selector: ${safeSelector} (${error.message})`);
    }
  }

  async selectOption(selector, value) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.humanScrollTo(safeSelector);
      await this.page.waitForSelector(safeSelector, { state: 'visible', timeout: 4000 });
      
      // 1. Try label match
      const labelRes = await this.page.selectOption(safeSelector, { label: value }).catch(() => null);
      if (labelRes && labelRes.length > 0) return;

      // 2. Try value match
      const valRes = await this.page.selectOption(safeSelector, { value: value }).catch(() => null);
      if (valRes && valRes.length > 0) return;

      // 3. Inspect options and match by intelligent keyword
      const matchedVal = await this.page.evaluate(({ sel, targetVal }) => {
        const select = document.querySelector(sel);
        if (!select || !select.options) return null;
        const target = String(targetVal).toLowerCase().trim();

        // Yes / No matching
        if (target === 'yes' || target === 'authorized' || target === 'true' || target.includes('legally')) {
          for (let opt of select.options) {
            const txt = opt.text.toLowerCase().trim();
            if (txt.startsWith('yes') || txt.includes('authorized') || txt.includes('eligible')) return opt.value;
          }
        }
        if (target === 'no' || target === 'false' || target.includes('will not')) {
          for (let opt of select.options) {
            const txt = opt.text.toLowerCase().trim();
            if (txt.startsWith('no') || txt.includes('will not') || txt.includes('dont') || txt.includes("don't")) return opt.value;
          }
        }

        // Degree matching
        if (target.includes('bachelor') || target.includes('b.s') || target.includes('bs')) {
          for (let opt of select.options) {
            const txt = opt.text.toLowerCase().trim();
            if (txt.includes('bachelor') || txt.includes('b.s') || txt.includes('bs')) return opt.value;
          }
        }
        if (target.includes('master') || target.includes('m.s') || target.includes('ms')) {
          for (let opt of select.options) {
            const txt = opt.text.toLowerCase().trim();
            if (txt.includes('master') || txt.includes('m.s') || txt.includes('ms')) return opt.value;
          }
        }

        // Generic keyword match
        for (let opt of select.options) {
          const txt = opt.text.toLowerCase().trim();
          if (txt && txt !== 'select...' && txt !== 'select' && (txt.includes(target) || target.includes(txt))) {
            return opt.value;
          }
        }

        // Default to first non-empty option
        for (let opt of select.options) {
          const txt = opt.text.toLowerCase().trim();
          if (txt && txt !== 'select...' && txt !== 'select' && opt.value) {
            return opt.value;
          }
        }

        return null;
      }, { sel: safeSelector, targetVal: String(value) });

      if (matchedVal !== null) {
        await this.page.selectOption(safeSelector, matchedVal).catch(() => {});
      }
    } catch (error) {
      if (this.logger) this.logger.warning(`Warning selecting option: ${value} in selector: ${safeSelector} (${error.message})`);
    }
  }

  async detectAndHandleCaptcha() {
    try {
      const captchaDetected = await this.page.evaluate(() => {
        const frames = Array.from(document.querySelectorAll('iframe'));
        const hasRecaptcha = frames.some(f => (f.src || '').includes('recaptcha') || (f.src || '').includes('hcaptcha') || (f.src || '').includes('turnstile'));
        const hasContainer = !!document.querySelector('.g-recaptcha, .cf-turnstile, #hcaptcha-container, [class*="captcha"]');
        return hasRecaptcha || hasContainer;
      });

      if (captchaDetected) {
        if (this.logger) {
          await this.logger.warning('CAPTCHA Challenge Detected! Pausing automation for human verification...');
        }

        // Attempt clicking reCAPTCHA checkbox frame if present
        const recaptchaFrame = this.page.frames().find(f => f.url().includes('recaptcha/api2/bframe') || f.url().includes('recaptcha/api2/anchor'));
        if (recaptchaFrame) {
          const checkMark = await recaptchaFrame.$('#recaptcha-anchor, .recaptcha-checkbox');
          if (checkMark) {
            await checkMark.click().catch(() => {});
          }
        }

        // Wait for CAPTCHA resolution or page transition (up to 120s)
        await this.page.waitForFunction(() => {
          const remainingCaptcha = document.querySelector('.g-recaptcha-response, [name="g-recaptcha-response"]');
          return remainingCaptcha && remainingCaptcha.value && remainingCaptcha.value.length > 0;
        }, { timeout: 120000 }).catch(() => {});

        if (this.logger) {
          await this.logger.info('CAPTCHA check step complete. Resuming automation pipeline.');
        }
      }
    } catch {}
  }

  async validateFormState(appData, resumePath) {
    const report = { valid: true, warnings: [], missingFields: [] };

    if (!appData.candidate_name || appData.candidate_name === 'Candidate Profile') {
      report.warnings.push('Candidate name is unverified or generic.');
    }
    if (!appData.email) {
      report.missingFields.push('email');
      report.valid = false;
    }
    if (resumePath && !fs.existsSync(resumePath)) {
      report.missingFields.push('physical resume file');
      report.valid = false;
    }

    if (!report.valid && this.logger) {
      await this.logger.warning(`Pre-submit form validation warning: Missing ${report.missingFields.join(', ')}`);
    }
    return report;
  }

  async captureStageEvidence(stageName, appId) {
    try {
      const filename = `${Date.now()}_${stageName}_${appId}.png`;
      const screenshotsDir = path.resolve(process.cwd(), 'backend/public/screenshots');
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

      const filepath = path.join(screenshotsDir, filename);
      await this.page.screenshot({ path: filepath, fullPage: false }).catch(() => {});
      if (this.logger) {
        await this.logger.screenshot(stageName, `/screenshots/${filename}`);
      }
      return `/screenshots/${filename}`;
    } catch {
      return null;
    }
  }

  async extractSubmissionConfirmation() {
    return await this.page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      let trackingId = '';

      const trackingMatch = text.match(/(?:tracking|application|confirmation|reference)\s*(?:id|number|#)?:\s*([A-Za-z0-9-]{4,35})/i);
      if (trackingMatch) trackingId = trackingMatch[1];

      const isSuccess = /thank you for applying|application submitted|successfully submitted|application received|we have received your application/i.test(text);

      return {
        success: isSuccess,
        trackingId: trackingId || null,
        confirmationUrl: window.location.href,
        snippet: text.substring(0, 300)
      };
    });
  }
}

