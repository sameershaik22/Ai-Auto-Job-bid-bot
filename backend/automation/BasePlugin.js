function sanitizeSelector(selector) {
  if (!selector) return selector;
  if (typeof selector === 'string' && selector.startsWith('#') && /^\d/.test(selector.substring(1))) {
    return `[id="${selector.substring(1)}"]`;
  }
  return selector;
}

export default class BasePlugin {
  constructor(page, logger, config) {
    this.page = page;
    this.logger = logger;
    this.config = config;
  }

  async humanType(selector, text) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.page.waitForSelector(safeSelector, { state: 'visible', timeout: 4000 });
      const element = await this.page.$(safeSelector);
      if (!element) return;
      await element.focus();

      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      
      for (const char of text) {
        await this.page.keyboard.type(char);
        const delay = Math.random() * 40 + 15; 
        await this.page.waitForTimeout(delay);
      }
      
      await this.page.waitForTimeout(Math.random() * 100 + 40); 
    } catch (error) {
      this.logger.warning(`Warning typing into selector: ${safeSelector} (${error.message})`);
    }
  }

  async humanClick(selector) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.page.waitForSelector(safeSelector, { state: 'visible', timeout: 4000 });
      const element = await this.page.$(safeSelector);
      if (!element) return;
      
      const box = await element.boundingBox();
      if (box) {
        const x = box.x + box.width / 2 + (Math.random() * 4 - 2);
        const y = box.y + box.height / 2 + (Math.random() * 4 - 2);

        await this.page.mouse.move(x, y, { steps: 6 });
        await this.page.waitForTimeout(60 + Math.random() * 30);
        
        await this.page.mouse.down();
        await this.page.waitForTimeout(30 + Math.random() * 20);
        await this.page.mouse.up();
      } else {
        await element.click();
      }
      
      await this.page.waitForTimeout(150 + Math.random() * 100); 
    } catch (error) {
      this.logger.warning(`Warning clicking selector: ${safeSelector} (${error.message})`);
    }
  }

  async selectOption(selector, value) {
    const safeSelector = sanitizeSelector(selector);
    try {
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

        // Degree matching (Bachelor's / Master's / Ph.D.)
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
      this.logger.warning(`Warning selecting option: ${value} in selector: ${safeSelector} (${error.message})`);
    }
  }
}
