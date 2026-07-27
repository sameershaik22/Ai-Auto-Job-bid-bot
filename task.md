# Task List - Phase 1: Resume Management 100%

Track the full implementation of the Resume Management module to production-grade quality.

## Database & Schema Verification
- [x] Add missing fields to PostgreSQL / SQLite table `resumes`: `years_of_experience` (INT), `categories` (TEXT), `technologies` (TEXT), `resume_pdf` (TEXT), `resume_docx` (TEXT).
- [x] Update `backend/database/schema.sql` with these schema additions.

## Backend File Ingestion & Parsing
- [x] Install `multer` and `pdf-parse` dependencies in the backend.
- [x] Implement multer upload middleware for PDF/DOCX files.
- [x] Implement file parser service to extract raw text from PDF files using `pdf-parse`.
- [x] Build fallback parser mock logic for DOCX files (extract text or simulate gracefully).
- [x] Update `POST /api/resumes` to accept multipart/form-data (file upload) or fallback raw text paste.

## Resume Module API Operations
- [x] Implement `PUT /api/resumes/:id` to allow full edits (name, candidate_name, resume_text, skills, experience, categories, etc.).
- [x] Implement `POST /api/resumes/:id/clone` to duplicate a resume with " (Clone)" appended to the name.
- [x] Implement `PATCH /api/resumes/:id/archive` to toggle `status` between 'active' and 'archived'.
- [x] Implement download routes for physical PDF/DOCX/TXT attachments.

## Frontend UI/UX Polish (ResumeVault.jsx)
- [x] Add visual tabs for filtering (All, Active, Archived).
- [x] Implement full-text and skill-tag search input.
- [x] Implement physical file upload widget (drag & drop zone that triggers multipart upload).
- [x] Design and build an **Edit Resume Modal** to modify fields manually (Name, Candidate, Skills tags, categories list).
- [x] Add **Clone** and **Archive** button controls to the card layout.
- [x] Ensure detailed empty states, loading indicators, and error message banners.

## Phase 2 - Job Board Module
- [x] Create `backend/services/scraperService.js` to fetch web content and run AI-based content extraction.
- [x] Update `POST /api/jobs` in `server.js` to accept a URL, run the scraper, compute match metrics against Vault resumes, and register the job.
- [x] Implement `PUT /api/jobs/:id` in `server.js` to edit job details (Title, Company, Location, Description, Skills).
- [x] Create progressive importing loading states on the frontend: Fetching URL -> Extracting Page -> AI Details Analysis -> Saving.
- [x] Design and build an **Import Verification Modal** in `JobBoard.jsx` to let the user review and refine scraped details before saving.
- [x] Build visual match matrices on the job cards (overall match, confidence, matched/missing skills list, selected baseline resume).
- [x] Implement live search and filter tags (All, Applied, Unapplied, Failed).
- [x] Write backend automated integration tests for jobs CRUD and scraping fallbacks in `backend/tests/job.test.js`.

## Phase 3 - AI Matching & ATS Scorer Panel
- [x] Refactor scraper architecture to a registry plugin framework (BaseScraper, greenhouse, lever, generic, mock).
- [x] Support detailed matching schemas (estimated ATS score, star ratings, confidence reasons, structured suggestions).
- [x] Extend SQLite/PostgreSQL schemas with match fields and verify automatic migrations.
- [x] Build the interactive slide-out ATS Scorer drawer with dials, ratings stars, confidence explanation, and prioritized suggestions.
- [x] Write automated tests asserting match scoring values and verify that all master suites pass.

## Phase 4 - Resume Tailoring & Document Generation
- [x] Implement backend tailoring routing support for Tone modifiers.
- [x] Compute score progression matrices (Before vs After, Keywords added, Missing reduced).
- [x] Code the zero-dependency Visual Diff comparison UI component.
- [x] Build professional HTML PDF/DOCX dynamic layout compilers with Playwright Chromium fallbacks.
- [x] Code segment-level Re-Tailor and Regenerators for tailored resume segments.

## Phase 5 - Cover Letter & Proposal Copywriter
- [x] Connect tone inputs and custom context to Cover Letter LLM generators.
- [x] Add structured bidding proposal templates (Intro, Experience, Solution, Timeline, Closing).
- [x] Create segment-level Regenerators for letters and proposals.

## Phase 6 - Stealth Playwright Automation Runner
- [x] Integrate mock recruiters with stealth options (random typing speeds, coordinate human clicks).
- [x] Stream logs, screenshot frames, step durations, and errors using real-time Socket.io channels.
- [x] Formulate a Human Review checkbox Gate to enforce approval checklists before form submission.

## Phase 7 - Analytics Dashboard Counters
- [x] Synchronize global metric cards (Sent, Success Rate, Queue, Fails).
- [x] Build recent activity panels and system operational indicators in `Dashboard.jsx`.
- [x] Verify production-quality compilation bundles and execution logs.

