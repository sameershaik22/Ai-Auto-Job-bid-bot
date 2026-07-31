import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

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
You are a professional job board parser. Extract the job details from the provided text.
Identify the Job Title, Company Name, Full Job Description, Required Skills (as a comma-separated list), Location, and Salary.
Return ONLY a valid JSON object matching this schema:
{
  "title": "Job Title",
  "company": "Company Name",
  "description": "Full details description...",
  "skills_required": ["skill1", "skill2"],
  "location": "Location (e.g. Remote, New York)",
  "salary": "Salary (e.g. $120k - $150k or TBD)"
}
Do not write markdown ticks. JSON only.
`;

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

function runScraperSimulation(text) {
  const lowercaseText = text.toLowerCase();
  
  let title = 'Software Engineer';
  if (lowercaseText.includes('frontend')) title = 'Staff Frontend Engineer';
  else if (lowercaseText.includes('backend')) title = 'Senior Backend Engineer';
  else if (lowercaseText.includes('fullstack') || lowercaseText.includes('full stack')) title = 'Staff Full Stack Engineer (React/Node)';
  
  let company = 'Innovate TechCorp';
  if (lowercaseText.includes('vercel')) company = 'Vercel Inc.';
  else if (lowercaseText.includes('google')) company = 'Google LLC';
  else if (lowercaseText.includes('techcorp')) company = 'TechCorp International';
  
  const skillsList = ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Playwright', 'Express', 'Tailwind CSS', 'Docker'];
  const matchedSkills = skillsList.filter(skill => lowercaseText.includes(skill.toLowerCase()));

  return JSON.stringify({
    title,
    company,
    description: text.substring(0, 1000) || `We are looking for a ${title} to join our growing tech team. You will lead technical design systems and deploy highly scalable backend nodes.`,
    skills_required: matchedSkills.length > 0 ? matchedSkills : ['React', 'Node.js', 'PostgreSQL', 'Playwright'],
    location: lowercaseText.includes('remote') ? 'Remote (US/Global)' : 'New York, NY',
    salary: '$140,000 - $180,000'
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
  if (scraper.constructor.name !== 'MockPortalScraper') {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000) 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load page. Server returned status: ${response.status}`);
      }
      
      htmlText = await response.text();
    } catch (err) {
      console.error(`Page fetch error: ${err.message}. Running fallback parser.`);
      return JSON.parse(runScraperSimulation(url));
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
    return JSON.parse(sanitized);
  } catch (err) {
    console.error('Failed to parse scraped page content with AI:', err);
    return JSON.parse(runScraperSimulation(cleanText));
  }
}
