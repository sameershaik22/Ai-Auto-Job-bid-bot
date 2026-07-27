
export class BaseScraper {
  
  canHandle(url) {
    throw new Error('canHandle(url) must be implemented');
  }

  async scrape(url, htmlContent) {
    throw new Error('scrape(url, htmlContent) must be implemented');
  }
}
