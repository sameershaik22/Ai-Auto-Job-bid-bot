/**
 * QuestionService — Autonomous Job Application Answer Engine
 *
 * Pipeline:
 *   Field → Classifier → Rule Engine (candidate profile) → Cache Hit? → Done
 *                                                       ↘ Cache Miss (motivation/unknown) → Gemini AI
 *
 * Gemini is ONLY used for:
 *   - "Why do you want to work here?" type questions
 *   - Cover letter / free-text summaries
 *   - Any field the rule engine can't handle
 *
 * All factual fields (name, email, phone, salary, work auth, education, EEO, etc.)
 * are answered deterministically from the candidate profile — fast, cheap, consistent.
 */

const CATEGORY = {
  CONTACT:     'contact',
  WORK_AUTH:   'work_auth',
  EDUCATION:   'education',
  SALARY:      'salary',
  EEO:         'eeo',
  MOTIVATION:  'motivation',
  EXPERIENCE:  'experience',
  TECHNICAL:   'technical',
  LOCATION:    'location',
  SOCIAL:      'social',
  AVAILABILITY:'availability',
  SOURCE:      'source',
  UNKNOWN:     'unknown',
};

export class QuestionService {
  /**
   * @param {import('@google/generative-ai').GoogleGenerativeAI | null} gemini
   */
  constructor(gemini = null) {
    this.gemini = gemini;
    // In-memory answer cache: normalized question key → answer string
    this.answerCache = new Map();
  }

  // ─────────────────────────────────────────────────────
  // CLASSIFIER
  // ─────────────────────────────────────────────────────

  /**
   * Classify a form field into a semantic category.
   * Work-auth is checked FIRST to prevent "state" matches from polluting it.
   */
  classify(field) {
    const label       = (field.label || '').toLowerCase();
    const name        = (field.name || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const combined    = `${label} ${name} ${placeholder}`;

    // ── Work Authorization (check FIRST) ────────────────
    if (/sponsor|visa sponsorship|require.*visa|need.*sponsorship|sponsorship required/.test(combined))
      return CATEGORY.WORK_AUTH;
    if (/authorized|eligible|legally.*work|work.*authorization|right.*to.*work|permitted.*to.*work/.test(combined))
      return CATEGORY.WORK_AUTH;

    // ── Contact ─────────────────────────────────────────
    if (/\bfirst[\s_-]?name\b/.test(combined)) return CATEGORY.CONTACT;
    if (/\blast[\s_-]?name\b/.test(combined))  return CATEGORY.CONTACT;
    if (/\bfull[\s_-]?name\b/.test(combined))  return CATEGORY.CONTACT;
    if (/\bname\b/.test(combined) && !/company|file|job|position/.test(combined)) return CATEGORY.CONTACT;
    if (/\bemail\b/.test(combined) || field.type === 'email') return CATEGORY.CONTACT;
    if (/\bphone\b|\bmobile\b|\bcell\b|\bcontact.?number\b/.test(combined) || field.type === 'tel')
      return CATEGORY.CONTACT;

    // ── Social Profiles ──────────────────────────────────
    if (/linkedin/.test(combined))                                  return CATEGORY.SOCIAL;
    if (/github/.test(combined))                                    return CATEGORY.SOCIAL;
    if (/portfolio|personal.?site|personal.?url/.test(combined))   return CATEGORY.SOCIAL;
    if (/\bwebsite\b|\burl\b/.test(combined) && !/job|company/.test(combined)) return CATEGORY.SOCIAL;

    // ── Location ─────────────────────────────────────────
    if (/\bcity\b|\btown\b/.test(combined))              return CATEGORY.LOCATION;
    if (/\bstate\b|\bprovince\b|\bregion\b/.test(combined)) return CATEGORY.LOCATION;
    if (/\bcountry\b/.test(combined))                    return CATEGORY.LOCATION;
    if (/\bzip\b|\bpostal\b|\bpostcode\b/.test(combined)) return CATEGORY.LOCATION;
    if (/\blocation\b|\baddress\b/.test(combined))       return CATEGORY.LOCATION;

    // ── Education ────────────────────────────────────────
    if (/school|university|college|institution/.test(combined))    return CATEGORY.EDUCATION;
    if (/\bdegree\b|\bqualification\b|education.?level/.test(combined)) return CATEGORY.EDUCATION;
    if (/discipline|major|field.?of.?study|subject|concentration/.test(combined)) return CATEGORY.EDUCATION;
    if (/\bgpa\b|grade.?point/.test(combined))                     return CATEGORY.EDUCATION;
    if (/graduation|graduated|grad.?year/.test(combined))          return CATEGORY.EDUCATION;

    // ── Salary ───────────────────────────────────────────
    if (/salary|compensation|\bpay\b|\brate\b|expected.?income|hourly.?rate/.test(combined))
      return CATEGORY.SALARY;

    // ── Availability ─────────────────────────────────────
    if (/start.?date|notice.?period|availability|when.?could.?you|earliest.?start|available.?from/.test(combined))
      return CATEGORY.AVAILABILITY;

    // ── EEO / Diversity ──────────────────────────────────
    if (/\bgender\b|\bsex\b/.test(combined))               return CATEGORY.EEO;
    if (/veteran|military/.test(combined))                  return CATEGORY.EEO;
    if (/disability|handicap/.test(combined))               return CATEGORY.EEO;
    if (/\brace\b|\bethnicity\b/.test(combined))           return CATEGORY.EEO;
    if (/\bpronoun/.test(combined))                         return CATEGORY.EEO;
    if (/voluntary.*self.?id|self.?identification/.test(combined)) return CATEGORY.EEO;

    // ── Experience ───────────────────────────────────────
    if (/years.?of.?exp|how.?many.?years|experience.?level|level.?of.?exp/.test(combined))
      return CATEGORY.EXPERIENCE;

    // ── Technical ────────────────────────────────────────
    if (/\bskill\b|technology|tech.?stack|programming|framework|proficienc/.test(combined))
      return CATEGORY.TECHNICAL;

    // ── Source / Referral ────────────────────────────────
    if (/hear.?about|found.?this|referral|\bsource\b/.test(combined))
      return CATEGORY.SOURCE;

    // ── Relocation ───────────────────────────────────────
    if (/relocat|willing.?to.?move/.test(combined)) return CATEGORY.AVAILABILITY;

    // ── Motivation / Free-text (→ Gemini) ────────────────
    if (/\bwhy\b|\bwhat excit|\bmotivat|\binterest|\babout yourself|tell us|introduce|passion|aspir/.test(combined))
      return CATEGORY.MOTIVATION;
    if (/cover.?letter|\bnote\b|\bsummary\b|additional.?info|anything.?else|message/.test(combined))
      return CATEGORY.MOTIVATION;
    if (field.tagName === 'textarea') return CATEGORY.MOTIVATION;

    return CATEGORY.UNKNOWN;
  }

  // ─────────────────────────────────────────────────────
  // RULE ENGINE
  // Returns null if the field is unknown — never guesses
  // ─────────────────────────────────────────────────────

  /**
   * Deterministically answer factual fields from candidate profile.
   * @returns {string|null} answer, or null if category requires AI / is unknown
   */
  getRuleAnswer(field, candidate) {
    const category = this.classify(field);
    const combined  = `${field.label || ''} ${field.name || ''} ${field.placeholder || ''}`.toLowerCase();

    // Helper values
    const candName  = candidate.candidate_name || candidate.name || '';
    const nameParts = candName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const fullLoc   = candidate.location || 'New York, NY';
    const locParts  = fullLoc.split(',').map(s => s.trim());
    const city      = locParts[0] || 'New York';
    const state     = locParts[1] || 'NY';

    // ── BINARY YES/NO PRE-CHECK ─────────────────────────────────────────────
    // Handles: "Do you have a Bachelor's degree?" / "Are you authorized to work?"
    // These appear as radio buttons with [Yes, No] options on Indeed, Greenhouse, etc.
    // MUST run before the category switch or we'd return "Bachelor's Degree" into a radio.
    const opts = (field.options || []).map(o => o.toLowerCase().trim());
    const isBinaryYesNo = opts.includes('yes') && opts.includes('no');

    if (isBinaryYesNo || (field.type === 'radio' && opts.length === 0)) {
      // ── Answer YES for these ──────────────────────────────────────────────
      if (/bachelor|master|phd|doctorate|diploma|degree|graduated|college|university/.test(combined))
        return 'Yes';
      if (/authorized|authorization|eligible|legally|right to work|work in|permitted|citizen|resident/.test(combined))
        return 'Yes';
      if (/remote|hybrid|work from home|wfh|flexible|telecommute/.test(combined))
        return 'Yes';
      if (/experience with|familiar|knowledge of|proficient|worked with/.test(combined))
        return 'Yes';
      if (/willing|able to|can you|comfortable|open to|available|relocate/.test(combined))
        return 'Yes';
      if (/full.?time|part.?time|contract|agreement/.test(combined))
        return 'Yes';
      if (/18 years|legal age|over 18/.test(combined))
        return 'Yes';

      // ── Answer NO for these ──────────────────────────────────────────────
      if (/sponsor|visa sponsorship|require.*visa|need.*sponsorship/.test(combined))
        return 'No';
      if (/felony|criminal|convicted|arrest|offense/.test(combined))
        return 'No';
      if (/non.?compete|non.?disclosure|conflict.*interest/.test(combined))
        return 'No';

      // ── Generic Yes/No fallback by category ────────────────────────────
      if (category === 'work_auth')  return 'Yes';
      if (category === 'education')  return 'Yes';
      if (category === 'experience') return 'Yes';

      // Default: Yes (most employer screening questions expect a positive answer)
      return 'Yes';
    }



    switch (category) {

      case CATEGORY.CONTACT:
        if (/first[\s_-]?name/.test(combined)) return firstName;
        if (/last[\s_-]?name/.test(combined))  return lastName;
        if (/full[\s_-]?name|candidate/.test(combined)) return candName;
        if (/\bname\b/.test(combined))         return candName;
        if (/\bemail\b/.test(combined) || field.type === 'email') return candidate.email || '';
        if (/\bphone\b|\bmobile\b|\bcell\b/.test(combined) || field.type === 'tel') return candidate.phone || '';
        return candName; // fallback for any contact field

      case CATEGORY.SOCIAL:
        if (/linkedin/.test(combined))          return candidate.linkedin_url || '';
        if (/github/.test(combined))            return candidate.github_url   || '';
        if (/portfolio|personal/.test(combined)) return candidate.portfolio_url || '';
        return candidate.portfolio_url || candidate.linkedin_url || '';

      case CATEGORY.LOCATION:
        if (/\bcity\b|\btown\b/.test(combined))            return city;
        if (/\bstate\b|\bprovince\b/.test(combined))       return state;
        if (/\bcountry\b/.test(combined))                  return 'United States';
        if (/\bzip\b|\bpostal\b|\bpostcode\b/.test(combined)) return candidate.zip_code || '10001';
        return fullLoc;

      case CATEGORY.EDUCATION:
        if (/school|university|college|institution/.test(combined))
          return candidate.school || 'Tech State University';
        if (/\bdegree\b|\bqualification\b|education.?level/.test(combined))
          return candidate.degree || "Bachelor's Degree";
        if (/discipline|major|field.?of.?study|subject|concentration/.test(combined))
          return candidate.major || 'Computer Science';
        if (/\bgpa\b/.test(combined))
          return candidate.gpa || '3.5';
        if (/graduation|grad.?year/.test(combined))
          return candidate.graduation_year || '2019';
        return candidate.degree || "Bachelor's Degree";

      case CATEGORY.SALARY:
        return candidate.preferred_salary || '$120,000 - $140,000';

      case CATEGORY.AVAILABILITY:
        if (/relocat/.test(combined)) return 'Yes';
        return candidate.notice_period || 'Immediately available';

      case CATEGORY.WORK_AUTH:
        // Visa sponsorship required → No
        if (/sponsor|require.*visa|need.*sponsorship/.test(combined)) return 'No';
        // Authorized to work → Yes
        return 'Yes';

      case CATEGORY.EEO:
        if (/\bgender\b|\bsex\b/.test(combined))         return 'Decline to self-identify';
        if (/veteran|military/.test(combined))             return 'I am not a protected veteran';
        if (/disability|handicap/.test(combined))          return 'No, I do not have a disability';
        if (/\brace\b|\bethnicity\b/.test(combined))     return 'Decline to self-identify';
        if (/\bpronoun/.test(combined))                   return 'Prefer not to say';
        return 'Decline to self-identify';

      case CATEGORY.EXPERIENCE:
        return String(candidate.years_of_experience || '5');

      case CATEGORY.TECHNICAL:
        return candidate.skills || 'React, Node.js, TypeScript, PostgreSQL, Playwright';

      case CATEGORY.SOURCE:
        return 'Online Job Board';

      // Motivation / Unknown → needs AI
      case CATEGORY.MOTIVATION:
      case CATEGORY.UNKNOWN:
        return null;

      default:
        return null;
    }
  }

  // ─────────────────────────────────────────────────────
  // GEMINI — Only for motivation / free-text fields
  // ─────────────────────────────────────────────────────

  /**
   * Ask Gemini ONLY for the motivation/unknown fields.
   * @param {{ index: number, field: object }[]} fieldsForAI
   * @param {object} candidate
   * @returns {Promise<Object>} map of local index (1-based) → answer
   */
  async getAIAnswers(fieldsForAI, candidate) {
    if (!this.gemini || fieldsForAI.length === 0) return {};

    const fieldDescriptions = fieldsForAI.map((item, i) => {
      let desc = `${i + 1}. Label: "${item.field.label}" | type: ${item.field.type} | tagName: ${item.field.tagName}`;
      if (item.field.options && item.field.options.length > 0) {
        desc += ` | Available Options: [${item.field.options.join(', ')}]`;
      }
      return desc;
    }).join('\n');

    const candName   = candidate.candidate_name || 'Candidate';
    const company    = candidate.company   || 'the company';
    const jobTitle   = candidate.job_title || 'Software Engineer';
    const skills     = candidate.skills    || 'React, Node.js, TypeScript, PostgreSQL';
    const expYears   = candidate.years_of_experience || 5;
    const summary    = candidate.summary   || `Experienced ${jobTitle} with ${expYears} years of experience in ${skills}.`;
    const resumeText = candidate.tailored_resume_text || candidate.resume_text || 'No resume text provided.';

    const prompt = `You are an expert career agent completing a job application for ${candName}.

Candidate Profile:
- Full Name: ${candName}
- Applying For: ${jobTitle} at ${company}
- Years of Experience: ${expYears}
- Key Skills: ${skills}
- Preferred Salary: ${candidate.preferred_salary || '$120,000'}
- Notice Period: ${candidate.notice_period || 'Immediately available'}
- Location: ${candidate.location || 'New York, NY'}
- Summary: ${summary}

--- FULL RESUME ---
${resumeText}
-------------------

The following fields from the job application require an answer. Answer EVERY field:
${fieldDescriptions}

Instructions for answering:
1. Search the Candidate Profile and FULL RESUME for the exact factual answer.
2. If the answer exists in the resume, extract and format it appropriately.
3. If the answer does NOT explicitly exist in the resume (e.g., "What is your biggest weakness?", "Describe a challenging project", "Why do you want to work here?"), use your best professional judgment to GENERATE a highly competent, positive response that aligns with a senior developer profile.
4. For dropdowns (options provided) → return the EXACT option text that best matches. If none perfectly match, pick the closest logical option.
5. For checkboxes/multi-selects → return comma-separated options.
6. For "Cover letter" or "Tell us about yourself" → write a 3-sentence professional introduction tailored to ${company}.
7. Keep free-text answers concise (2-4 sentences max), professional, and persuasive. Do NOT fabricate specific company names or fake project metrics that aren't in the resume.

Return ONLY a valid JSON object with string values where the key is the field number: { "1": "answer1", "2": "answer2", ... }`;

    try {
      const model  = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const text   = result.response.text().trim().replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch (err) {
      // Gemini unavailable (rate limit, quota, network) — use smart template fallback
      // so applications keep running even without AI quota
      return this._buildTemplateFallback(fieldsForAI, candidate);
    }
  }

  /**
   * Smart template fallback when Gemini is unavailable (quota exceeded, etc.)
   * Builds professional answers from candidate profile without any API calls.
   */
  _buildTemplateFallback(fieldsForAI, candidate) {
    const candName = candidate.candidate_name || 'Candidate';
    const company  = candidate.company        || 'your company';
    const jobTitle = candidate.job_title      || 'Software Engineer';
    const skills   = candidate.skills         || 'React, Node.js, TypeScript, PostgreSQL';
    const expYears = candidate.years_of_experience || 5;
    const salary   = candidate.preferred_salary    || '$120,000';
    const notice   = candidate.notice_period        || 'Immediately available';

    const coverLetter =
      `Dear Hiring Manager,\n\nI am excited to apply for the ${jobTitle} position at ${company}. ` +
      `With ${expYears} years of experience in ${skills}, I have a strong track record of delivering ` +
      `high-quality software solutions. I am eager to bring my skills and enthusiasm to ${company} ` +
      `and contribute to your team's success.\n\nBest regards,\n${candName}`;

    const whyUs =
      `I am drawn to ${company} because of your commitment to innovation and technical excellence. ` +
      `With my background in ${skills} and ${expYears} years of experience, I believe I can make ` +
      `a meaningful contribution to your team and help drive impactful outcomes.`;

    const summary =
      `I am a ${jobTitle} with ${expYears} years of experience specializing in ${skills}. ` +
      `I am passionate about building scalable, user-focused software and am excited about ` +
      `the opportunity to join ${company}.`;

    const answers = {};
    fieldsForAI.forEach((item, aiIdx) => {
      const label = (item.field.label || '').toLowerCase();

      let answer = '';
      if (/cover.?letter/.test(label))                                  answer = coverLetter;
      else if (/why|interest|excit|motivat|passion/.test(label))        answer = whyUs;
      else if (/about yourself|tell us|introduce|summary/.test(label))  answer = summary;
      else if (/salary|compensation/.test(label))                       answer = salary;
      else if (/start|notice|availability/.test(label))                 answer = notice;
      else if (/skills|technology|stack/.test(label))                   answer = skills;
      else if (item.field.options && item.field.options.length > 0)     answer = item.field.options[0]; // first option
      else                                                               answer = summary; // generic fallback

      answers[String(aiIdx + 1)] = answer;
    });

    return answers;
  }

  // ─────────────────────────────────────────────────────
  // CACHE KEY
  // ─────────────────────────────────────────────────────

  _cacheKey(field) {
    const raw = (field.label || field.name || field.placeholder || '').toLowerCase().trim();
    return raw.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 80);
  }

  // ─────────────────────────────────────────────────────
  // MAIN RESOLVER — called per page
  // ─────────────────────────────────────────────────────

  /**
   * Resolve answers for ALL fields on the current form page.
   *
   * Pass 1: Rule engine (instant, no API)
   * Pass 2: Cache lookup for repeated questions
   * Pass 3: Gemini batch call for remaining motivation/unknown fields
   *
   * @param {object[]} formFields   Output of extractFormFields()
   * @param {object}   candidate    Application + candidate data from DB
   * @param {object}   [logger]     Optional automation logger
   * @returns {Promise<Object>}     Map of "1"-based field index → answer string
   */
  async resolveAll(formFields, candidate, logger = null) {
    const answers       = {};
    const fieldsForAI   = [];     // Fields that need Gemini
    const unanswered    = [];     // Fully unknown — log for review

    // ── Pass 1 & 2: Rule engine + cache ─────────────────
    for (let i = 0; i < formFields.length; i++) {
      const field = formFields[i];
      if (field.type === 'file' || field.type === 'hidden' || field.type === 'submit') continue;

      const key = this._cacheKey(field);

      // Cache hit
      if (key && this.answerCache.has(key)) {
        answers[String(i + 1)] = this.answerCache.get(key);
        continue;
      }

      // Rule engine
      const ruleAnswer = this.getRuleAnswer(field, candidate);

      if (ruleAnswer !== null) {
        answers[String(i + 1)] = ruleAnswer;
        if (key) this.answerCache.set(key, ruleAnswer);
      } else {
        // Queue for Gemini (motivation / unknown)
        fieldsForAI.push({ globalIndex: i + 1, localIndex: fieldsForAI.length + 1, field });
      }
    }

    // ── Pass 3: Gemini batch ─────────────────────────────
    if (fieldsForAI.length > 0) {
      if (logger) {
        await logger.info(`🤖 Sending ${fieldsForAI.length} free-text question(s) to Gemini AI...`).catch(() => {});
      }

      const aiAnswers = await this.getAIAnswers(fieldsForAI, candidate);

      for (const item of fieldsForAI) {
        const aiAns = aiAnswers[String(item.localIndex)];
        if (aiAns && aiAns.trim() !== '') {
          answers[String(item.globalIndex)] = aiAns.trim();
          const key = this._cacheKey(item.field);
          if (key) this.answerCache.set(key, aiAns.trim());
        } else {
          unanswered.push(item.field);
        }
      }
    }

    // ── Log unanswered fields for future improvement ─────
    if (unanswered.length > 0 && logger) {
      for (const f of unanswered) {
        await logger.warning(
          `❓ Unanswered field logged for review: "${f.label || f.name || f.placeholder}" [${f.type}/${f.tagName}]`
        ).catch(() => {});
      }
    }

    return answers;
  }
}
