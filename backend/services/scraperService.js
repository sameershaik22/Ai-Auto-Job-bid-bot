import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { chromium } from 'playwright';

import { MockPortalScraper } from '../automation/scrapers/MockPortalScraper.js';
import { GreenhouseScraper } from '../automation/scrapers/GreenhouseScraper.js';
import { LeverScraper } from '../automation/scrapers/LeverScraper.js';
import { GenericScraper } from '../automation/scrapers/GenericScraper.js';

dotenv.config();

let geminiClient = null;
let openaiClient = null;

if (process.env.GEMINI_API_KEY) {
  geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const scrapersRegistry = [
  new MockPortalScraper(),
  new GreenhouseScraper(),
  new LeverScraper(),
  new GenericScraper() 
];

const SCRAPE_SYSTEM_PROMPT = `
You are a professional job board parser. Extract the job details from the provided text or HTML page.
Identify the Job Title, Company Name, Full Job Description, Required Skills (as a comma-separated list), Location, and Salary.
Return ONLY a valid JSON object matching this schema:
{
  "title": "Job Title",
  "company": "Company Name",
  "description": "Full details description...",
  "skills_required": ["skill1", "skill2"],
  "location": "Location (e.g. Remote, New York, Bangalore - Onsite)",
  "salary": "Salary (e.g. $120k - $150k or Competitive)"
}
Do not write markdown ticks. JSON only.
`;

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

function extractJsonLdMetadata(htmlText) {
  if (!htmlText) return null;
  try {
    const matches = htmlText.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (!matches) return null;

    for (const match of matches) {
      const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        const parsed = JSON.parse(jsonStr);
        const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
        for (const item of items) {
          if (item && (item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting')) {
            let company = '';
            if (item.hiringOrganization) {
              company = typeof item.hiringOrganization === 'string' ? item.hiringOrganization : (item.hiringOrganization.name || '');
            }
            let location = '';
            if (item.jobLocation) {
              const locs = Array.isArray(item.jobLocation) ? item.jobLocation : [item.jobLocation];
              const places = locs.map(l => {
                if (!l) return '';
                if (typeof l === 'string') return l;
                if (l.address) {
                  const addr = l.address;
                  const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry?.name || addr.addressCountry].filter(Boolean);
                  return parts.join(', ');
                }
                return l.name || '';
              }).filter(Boolean);
              if (places.length > 0) location = places[0];
            }
            if (item.applicantLocationRequirements) {
              location = location ? `${location} (Remote)` : 'Remote';
            }

            let cleanDesc = item.description || '';
            cleanDesc = decodeHTMLEntities(cleanDesc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            return {
              title: item.title || '',
              company,
              description: cleanDesc,
              location: location || '',
              employmentType: item.employmentType || ''
            };
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function fetchPageWithPlaywright(url) {
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    const cleanUrl = url.replace(/\/register(?:\?.*)?$/, '');
    await page.goto(cleanUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    });
    await page.waitForTimeout(3000);

    const extracted = await page.evaluate(() => {
      const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      let ldData = null;
      for (const s of ldScripts) {
        try {
          const parsed = JSON.parse(s.innerText);
          const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
          const jp = items.find(i => i && (i['@type'] === 'JobPosting' || i['@type'] === 'http://schema.org/JobPosting'));
          if (jp) { ldData = jp; break; }
        } catch {}
      }

      const noiseWords = ['application form', 'cookies', 'careers', 'view all', 'global', 'single position', 'sign in', 'join talent network', 'locations', 'professions', 'life at'];
      const h1s = Array.from(document.querySelectorAll('h1, h2, [class*="job-title"], [class*="title"], [data-automation-id="jobTitle"]'))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 3 && !noiseWords.some(w => t.toLowerCase().includes(w)));
      
      const companyEl = document.querySelector('[class*="company"], [class*="org"], [class*="employer"]');
      const locationEl = document.querySelector('[class*="location"], [class*="Location"], [data-automation-id="jobLocation"]');
      
      return {
        mainTitle: h1s[0] || '',
        companyName: companyEl ? companyEl.innerText.trim() : '',
        locationText: locationEl ? locationEl.innerText.trim() : '',
        ldData
      };
    });

    const title = await page.title();
    const content = await page.content();
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
    
    return {
      title: extracted.mainTitle || title,
      company: extracted.companyName || '',
      location: extracted.locationText || '',
      content,
      bodyText,
      ldData: extracted.ldData
    };
  } catch (err) {
    console.warn(`Playwright fetch error for ${url}: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function parseMetadataFromTitleAndUrl(text, url = '', extraMeta = {}) {
  let title = extraMeta.title || '';
  let company = extraMeta.company || '';
  let location = extraMeta.location || '';

  const isDisclaimer = (str) => !str || str.length > 50 || /fee|notify|disclaimer|terms|privacy|copyright|cookie|register|application|benefits/i.test(str);

  if (isDisclaimer(company)) company = '';
  const invalidGenericTitles = ['example domain', 'register', 'apply', 'careers', 'global', 'home', 'jobs'];
  if (invalidGenericTitles.includes(title.toLowerCase())) title = '';

  const ogTitleMatch = text.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const titleTagMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);

  const rawTitle = (ogTitleMatch ? ogTitleMatch[1] : (titleTagMatch ? titleTagMatch[1] : '')).trim();

  if (rawTitle) {
    const cleaned = rawTitle
      .replace(/\s*\|\s*(?:Unstop|LinkedIn|Indeed|Glassdoor|ZipRecruiter|Monster|Naukri|SimplyHired|Microsoft Careers)$/i, '')
      .replace(/\s*-\s*(?:Unstop|LinkedIn|Indeed|Glassdoor|ZipRecruiter|Monster|Naukri|SimplyHired|Microsoft Careers)$/i, '')
      .replace(/^Register for\s+/i, '')
      .replace(/^Apply for\s+/i, '')
      .trim();

    if (cleaned.includes(' at ')) {
      const parts = cleaned.split(' at ');
      if (!title) title = parts[0].trim();
      if (!company || isDisclaimer(company)) company = parts[1].split('|')[0].split('-')[0].trim();
    } else if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ');
      if (!title) title = parts[0].trim();
      if (!company || isDisclaimer(company)) company = parts[1].split('|')[0].trim();
    } else if (cleaned.includes(' | ')) {
      const parts = cleaned.split(' | ');
      if (!title) title = parts[0].trim();
      if (!company || isDisclaimer(company)) company = parts[1].trim();
    } else if (!title) {
      title = cleaned;
    }
  }

  if (!company || isDisclaimer(company)) {
    if (url.includes('microsoft.com')) company = 'Microsoft';
    else if (url.includes('google.com')) company = 'Google';
    else if (url.includes('amazon.com')) company = 'Amazon';
    else if (url.includes('apple.com')) company = 'Apple';
    else if (url.includes('meta.com')) company = 'Meta';
  }

  if (!company || isDisclaimer(company)) {
    const atMatch = text.match(/(?:at|by|company:?)\s+([A-Z][A-Za-z0-9\s&]{2,30}(?:Technologies|Tech|Inc|LLC|Corp|Software|Labs|Solutions|Global|Services|Group|Studio)?)/i);
    if (atMatch && !isDisclaimer(atMatch[1])) {
      company = atMatch[1].replace(/\s+(?:is|was|has|are|a|an|the)\b.*/i, '').trim();
    }
  }

  if (!company && url) {
    try {
      const parsedUrl = new URL(url);
      const hostParts = parsedUrl.hostname.replace('www.', '').split('.');
      if (hostParts.length >= 2) {
        const brand = hostParts[hostParts.length - 2];
        if (!['unstop', 'com', 'org', 'net', 'co', 'io', 'careers', 'jobs', 'apply', 'example'].includes(brand.toLowerCase())) {
          company = brand.charAt(0).toUpperCase() + brand.slice(1);
        }
      }
    } catch {}
  }

  if (url && (!title || !company || isDisclaimer(company))) {
    try {
      const parsedUrl = new URL(url);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const last = segments.filter(s => !['register', 'apply', 'job', 'jobs', 'careers', 'index.html'].includes(s.toLowerCase()) && !/^\d+$/.test(s)).pop();
      if (last) {
        if (last.includes('-')) {
          const parts = last.split('-');
          const lastPart = parts[parts.length - 1];
          if (lastPart && !['engineer', 'developer', 'manager', 'lead', 'designer', 'role'].includes(lastPart.toLowerCase())) {
            if (!company || isDisclaimer(company)) {
              company = lastPart.charAt(0).toUpperCase() + lastPart.slice(1) + ' Inc.';
            }
            if (!title) {
              title = parts.slice(0, parts.length - 1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
          }
        }
        if (!title) {
          title = last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
      }
    } catch {}
  }

  // Determine Onsite / Hybrid vs Remote location
  const lower = text.toLowerCase();
  if (!location) {
    if (lower.includes('in-office') || lower.includes('3 days / week') || lower.includes('onsite') || lower.includes('on-site')) {
      const cityMatch = text.match(/(?:Bangalore|Bengaluru|Hyderabad|Noida|Seattle|Redmond|San Francisco|New York|Austin|London|Toronto)/i);
      location = cityMatch ? `${cityMatch[0]} (On-site / Hybrid)` : 'On-site / Hybrid';
    } else if (lower.includes('remote')) {
      location = 'Remote';
    } else {
      const cityMatch = text.match(/(?:Bangalore|Bengaluru|Hyderabad|Noida|Seattle|Redmond|San Francisco|New York|Austin|London|Toronto)/i);
      location = cityMatch ? cityMatch[0] : 'On-site / Hybrid';
    }
  }

  return {
    title: title || 'Software Engineer',
    company: company || 'Recruiting Company',
    location: location || 'On-site / Hybrid'
  };
}

async function callScraperLLM(text) {
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${SCRAPE_SYSTEM_PROMPT}\n\nPage Text:\n${text}` }] }]
      });
      return result.response.text().trim();
    } catch (err) {
      console.warn(`[Scraper Service] Gemini LLM fallback (${err.message || 'Error'}). Using local heuristic scraper simulation.`);
    }
  }
  
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SCRAPE_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.2
      });
      return response.choices[0].message.content.trim();
    } catch (err) {
      console.warn(`[Scraper Service] OpenAI LLM fallback (${err.message || 'Error'}).`);
    }
  }

  return runScraperSimulation(text);
}

function runScraperSimulation(text, url = '', extraMeta = {}) {
  const lowercaseText = text.toLowerCase();
  const parsedMeta = parseMetadataFromTitleAndUrl(text, url, extraMeta);
  
  let title = parsedMeta.title;
  let company = parsedMeta.company;
  let location = parsedMeta.location;

  if (!title || title === 'Software Engineer' || title === 'Register' || title === 'Careers') {
    if (lowercaseText.includes('ai/ml') || lowercaseText.includes('machine learning')) title = 'AI/ML Developer Internship';
    else if (lowercaseText.includes('frontend')) title = 'Frontend Engineer';
    else if (lowercaseText.includes('backend')) title = 'Backend Engineer';
    else if (lowercaseText.includes('fullstack') || lowercaseText.includes('full stack')) title = 'Full Stack Engineer';
    else title = 'Software Engineer';
  }

  const skillsList = ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Playwright', 'Python', 'Machine Learning', 'Express', 'Tailwind CSS', 'Docker', 'AWS', 'Java', 'C++', 'C#', 'Git'];
  const matchedSkills = skillsList.filter(skill => lowercaseText.includes(skill.toLowerCase()));

  const cleanDescription = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/Cookies Disabled.*Safari\./gi, '')
    .trim()
    .substring(0, 1200);

  return JSON.stringify({
    title,
    company,
    description: cleanDescription.length > 50 ? cleanDescription : `Job vacancy position for ${title} at ${company}. Skills required: ${matchedSkills.join(', ') || 'Software Engineering'}.`,
    skills_required: matchedSkills.length > 0 ? matchedSkills : ['React', 'Node.js', 'PostgreSQL', 'Python'],
    location,
    salary: 'Competitive'
  });
}

export async function scrapeJobUrl(url) {
  console.log(`Scraping target job URL: ${url}`);

  const scraper = scrapersRegistry.find(s => s.canHandle(url));
  if (!scraper) {
    throw new Error('No compatible scraper plugin found.');
  }
  console.log(`Selected scraper plugin: ${scraper.constructor.name}`);

  let htmlText = '';
  let extraMeta = {};
  let jsonLdMeta = null;

  if (scraper.constructor.name !== 'MockPortalScraper') {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000) 
      });
      
      if (response.ok) {
        htmlText = await response.text();
        jsonLdMeta = extractJsonLdMetadata(htmlText);
      }
    } catch (err) {
      console.warn(`Standard page fetch notice: ${err.message}. Trying Playwright render.`);
    }

    const isSPA = url.includes('careers.microsoft.com') ||
                  url.includes('workday.com') ||
                  url.includes('myworkdayjobs.com') ||
                  url.includes('ashbyhq.com') ||
                  url.includes('eightfold.ai') ||
                  url.includes('phenom') ||
                  url.includes('linkedin.com') ||
                  htmlText.includes('&#34;\\5c') ||
                  htmlText.includes('primary-color-') ||
                  htmlText.includes('Cookies Disabled') ||
                  htmlText.includes('JavaScript!') ||
                  htmlText.length < 500;

    if (isSPA || !htmlText) {
      console.log('Detected JS/SPA/Cookie protected page. Using Playwright browser scraper...');
      const pwResult = await fetchPageWithPlaywright(url);
      if (pwResult) {
        htmlText = pwResult.content;
        extraMeta = { title: pwResult.title, company: pwResult.company, location: pwResult.location };
        if (pwResult.ldData) {
          jsonLdMeta = {
            title: pwResult.ldData.title,
            company: pwResult.ldData.hiringOrganization?.name || pwResult.company,
            description: decodeHTMLEntities(pwResult.ldData.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
            location: pwResult.location || 'On-site / Hybrid'
          };
        }
        if (pwResult.bodyText && pwResult.bodyText.length > 200) {
          htmlText = `<title>${pwResult.title}</title>\n${pwResult.bodyText}`;
        }
      }
    }
  }

  const cleanText = await scraper.scrape(url, htmlText);

  if (scraper.constructor.name === 'MockPortalScraper') {
    return {
      title: 'Staff Full Stack Engineer (React/Node)',
      company: 'TechCorp International',
      description: 'We are looking for a Staff Full Stack Developer with expert-level proficiency in React, Node.js, and browser-automation engines. You will lead design systems engineering and build autonomous workflows.\n\nRequirements:\n- 6+ years of production experience in JavaScript/TypeScript stacks\n- In-depth familiarity with relational database tuning (Postgres)\n- Proven experience setting up continuous testing flows (Playwright/Puppeteer)',
      skills_required: ['React', 'Node.js', 'Postgres', 'Playwright', 'TypeScript'],
      location: 'Remote (Global)',
      salary: '$180,000 - $220,000'
    };
  }

  try {
    const rawJson = await callScraperLLM(cleanText);
    const sanitized = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(sanitized);

    const meta = parseMetadataFromTitleAndUrl(cleanText, url, extraMeta);

    if (jsonLdMeta) {
      if (jsonLdMeta.title && jsonLdMeta.title !== 'Global' && jsonLdMeta.title !== 'Careers') parsed.title = jsonLdMeta.title;
      if (jsonLdMeta.company) parsed.company = jsonLdMeta.company;
      if (jsonLdMeta.location) parsed.location = jsonLdMeta.location;
      if (jsonLdMeta.description && jsonLdMeta.description.length > 100) parsed.description = jsonLdMeta.description;
    }

    const invalidTitles = ['Global', 'Careers', 'Register', 'Apply', 'Overview', 'Single Position', 'View All Jobs'];
    if (!parsed.title || invalidTitles.some(t => parsed.title.toLowerCase() === t.toLowerCase()) || (parsed.title === 'Software Engineer' && meta.title && meta.title !== 'Software Engineer')) {
      parsed.title = (jsonLdMeta && jsonLdMeta.title) ? jsonLdMeta.title : (meta.title || 'Software Engineer');
    }

    const invalidCompanies = ['Innovate TechCorp', 'Tech Corporation', 'Recruiting Company', 'Company Name'];
    if (!parsed.company || invalidCompanies.some(c => parsed.company.toLowerCase() === c.toLowerCase()) || parsed.company.includes('benefits')) {
      parsed.company = (jsonLdMeta && jsonLdMeta.company) ? jsonLdMeta.company : meta.company;
    }

    if (!parsed.location || parsed.location === 'Remote') {
      parsed.location = (jsonLdMeta && jsonLdMeta.location) ? jsonLdMeta.location : meta.location;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to parse scraped page content with AI:', err);
    const fallback = JSON.parse(runScraperSimulation(cleanText, url, extraMeta));
    if (jsonLdMeta) {
      if (jsonLdMeta.title) fallback.title = jsonLdMeta.title;
      if (jsonLdMeta.company) fallback.company = jsonLdMeta.company;
      if (jsonLdMeta.location) fallback.location = jsonLdMeta.location;
      if (jsonLdMeta.description) fallback.description = jsonLdMeta.description;
    }
    return fallback;
  }
}

