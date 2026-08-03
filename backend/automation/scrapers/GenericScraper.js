import { BaseScraper } from './BaseScraper.js';

function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

export class GenericScraper extends BaseScraper {
  canHandle(url) {
    return true; 
  }

  async scrape(url, htmlContent) {
    console.log('[GenericScraper] Parsing generic web page details...');
    if (!htmlContent) return '';
    
    // First decode entities so encoded scripts/styles get stripped cleanly
    let decoded = decodeHTMLEntities(htmlContent);

    // Remove script and style blocks
    decoded = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    decoded = decoded.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    // Remove CSS variables & inline CSS declarations
    decoded = decoded.replace(/--[a-zA-Z0-9-]+:[^;]+;/g, ' ');
    decoded = decoded.replace(/\{[^}]*primary-color[^}]*\}/gi, ' ');
    decoded = decoded.replace(/\{[^}]*font-family[^}]*\}/gi, ' ');

    // Strip remaining HTML tags
    decoded = decoded.replace(/<[^>]+>/g, ' ');

    // Collapse whitespace
    return decoded.replace(/\s+/g, ' ').trim();
  }
}
