import { BaseScraper } from './BaseScraper.js';

export class GenericScraper extends BaseScraper {
  canHandle(url) {
    return true; 
  }

  async scrape(url, htmlContent) {
    console.log('[GenericScraper] Parsing generic web page details...');
    if (!htmlContent) return '';
    
    return htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') 
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   
      .replace(/<[^>]+>/g, ' ')                                           
      .replace(/\s+/g, ' ')                                               
      .trim();
  }
}
