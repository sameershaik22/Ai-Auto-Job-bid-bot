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
        const delay = Math.random() * 50 + 20; 
        await this.page.waitForTimeout(delay);
      }
      
      await this.page.waitForTimeout(Math.random() * 150 + 50); 
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

        await this.page.mouse.move(x, y, { steps: 8 });
        await this.page.waitForTimeout(80 + Math.random() * 40);
        
        await this.page.mouse.down();
        await this.page.waitForTimeout(40 + Math.random() * 20);
        await this.page.mouse.up();
      } else {
        await element.click();
      }
      
      await this.page.waitForTimeout(200 + Math.random() * 150); 
    } catch (error) {
      this.logger.warning(`Warning clicking selector: ${safeSelector} (${error.message})`);
    }
  }

  async selectOption(selector, value) {
    const safeSelector = sanitizeSelector(selector);
    try {
      await this.page.waitForSelector(safeSelector, { state: 'visible', timeout: 4000 });
      await this.page.selectOption(safeSelector, value);
      await this.page.waitForTimeout(200 + Math.random() * 150);
    } catch (error) {
      this.logger.warning(`Warning selecting option: ${value} in selector: ${safeSelector} (${error.message})`);
    }
  }
}
