import { BaseScraper } from './BaseScraper.js';

export class MockPortalScraper extends BaseScraper {
  canHandle(url) {
    return url.includes('/mock-recruiter/') || url.includes('mock_portal');
  }

  async scrape(url, htmlContent) {
    console.log('[MockPortalScraper] Parsing LeverageHQ sandbox HTML content.');
    
    return `
      Company: TechCorp International
      Title: Staff Full Stack Engineer (React/Node)
      Location: Remote (Global)
      Salary: $180,000 - $220,000
      Description: We are looking for a Staff Full Stack Developer with expert-level proficiency in React, Node.js, and browser-automation engines. You will lead design systems engineering and build autonomous workflows.
      Requirements:
      - 6+ years of production experience in JavaScript/TypeScript stacks
      - In-depth familiarity with relational database tuning (Postgres)
      - Proven experience setting up continuous testing flows (Playwright/Puppeteer)
      Skills: React, Node.js, Postgres, Playwright, TypeScript, SQL
    `;
  }
}
