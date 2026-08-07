import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Searches DuckDuckGo for the company's recent news to provide context for AI.
 * @param {string} companyName The name of the company to research
 * @returns {Promise<string>} A summarized string of the latest news/info, or empty if failed
 */
export async function getCompanyContext(companyName) {
  if (!companyName || companyName.trim() === '') return '';

  try {
    const query = encodeURIComponent(`"${companyName}" latest news updates`);
    const url = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('.result__body').each((i, el) => {
      if (i >= 3) return false; // Get top 3
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      results.push(`- ${title}: ${snippet}`);
    });

    if (results.length > 0) {
      return `Recent News/Context for ${companyName}:\n${results.join('\n')}`;
    }
    
    return '';
  } catch (error) {
    console.warn(`[ResearchService] Failed to fetch context for ${companyName}:`, error.message);
    return '';
  }
}
