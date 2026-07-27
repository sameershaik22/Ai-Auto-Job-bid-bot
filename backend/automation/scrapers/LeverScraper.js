import { BaseScraper } from './BaseScraper.js';

export class LeverScraper extends BaseScraper {
  canHandle(url) {
    return url.includes('jobs.lever.co') || url.includes('lever.co');
  }

  async scrape(url, htmlContent) {
    console.log('[LeverScraper] Processing Lever ATS nodes...');
    const bodyText = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return `[LEVER POSTING] ${bodyText}`;
  }
}
