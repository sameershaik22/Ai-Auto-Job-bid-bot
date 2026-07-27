import { BaseScraper } from './BaseScraper.js';

export class GreenhouseScraper extends BaseScraper {
  canHandle(url) {
    return url.includes('boards.greenhouse.io') || url.includes('greenhouse.io');
  }

  async scrape(url, htmlContent) {
    console.log('[GreenhouseScraper] Processing Greenhouse ATS nodes...');
    
    const bodyText = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return `[GREENHOUSE POSTING] ${bodyText}`;
  }
}
