export default class BasePlugin {
  constructor(page, logger, config) {
    this.page = page;
    this.logger = logger;
    this.config = config;
  }

  async humanType(selector, text) {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      const element = await this.page.$(selector);
      await element.focus();

      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      
      for (const char of text) {
        await this.page.keyboard.type(char);
        const delay = Math.random() * 70 + 40; 
        await this.page.waitForTimeout(delay);
      }
      
      await this.page.waitForTimeout(Math.random() * 200 + 100); 
    } catch (error) {
      this.logger.error(`Error typing into selector: ${selector}`, error.message);
      throw error;
    }
  }

  async humanClick(selector) {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      const element = await this.page.$(selector);
      
      const box = await element.boundingBox();
      if (box) {
        
        const x = box.x + box.width / 2 + (Math.random() * 4 - 2);
        const y = box.y + box.height / 2 + (Math.random() * 4 - 2);

        await this.page.mouse.move(x, y, { steps: 10 });
        await this.page.waitForTimeout(100 + Math.random() * 50);
        
        await this.page.mouse.down();
        await this.page.waitForTimeout(50 + Math.random() * 30);
        await this.page.mouse.up();
      } else {
        await element.click();
      }
      
      await this.page.waitForTimeout(300 + Math.random() * 200); 
    } catch (error) {
      this.logger.error(`Error clicking selector: ${selector}`, error.message);
      throw error;
    }
  }

  async selectOption(selector, value) {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      await this.page.selectOption(selector, value);
      await this.page.waitForTimeout(200 + Math.random() * 150);
    } catch (error) {
      this.logger.error(`Error selecting option: ${value} in selector: ${selector}`, error.message);
      throw error;
    }
  }
}
