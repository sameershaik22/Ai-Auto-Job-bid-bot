-- Users Table (Authentication)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',        -- 'free' or 'pro'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resumes Table
CREATE TABLE IF NOT EXISTS resumes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    candidate_name VARCHAR(255) NOT NULL,
    skills TEXT NOT NULL,                  -- Comma-separated or JSON list of parsed skills
    experience TEXT NOT NULL,              -- JSON stringified experience array
    summary TEXT,
    education TEXT NOT NULL,               -- JSON stringified education array
    resume_text TEXT NOT NULL,
    years_of_experience INT DEFAULT 0,
    categories TEXT,                       -- Comma-separated list
    technologies TEXT,                     -- Comma-separated list
    resume_pdf TEXT,                       -- Path to physical file
    resume_docx TEXT,                      -- Path to physical file
    status VARCHAR(50) DEFAULT 'active',   -- 'active' or 'archived'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(50) PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    skills_required TEXT NOT NULL,         -- Comma-separated list of skills
    salary VARCHAR(100),
    location VARCHAR(255),
    match_score INT DEFAULT 0,
    recommended_resume_id VARCHAR(50),
    recommended_resume_name VARCHAR(255),
    match_confidence VARCHAR(50),
    matched_skills TEXT,
    missing_skills TEXT,
    match_recommendations TEXT,
    ats_score INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unapplied',-- 'unapplied', 'tailoring', 'applied', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) PRIMARY KEY,
    resume_id VARCHAR(50) REFERENCES resumes(id) ON DELETE CASCADE,
    job_id VARCHAR(50) REFERENCES jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'running', 'success', 'failed', 'saved'
    tailored_resume_text TEXT,
    cover_letter TEXT,
    proposal TEXT,
    score INT DEFAULT 0,
    original_score INT DEFAULT 0,
    ats_score INT DEFAULT 0,
    matched_skills TEXT,
    missing_skills TEXT,
    match_recommendations TEXT,
    website VARCHAR(100) NOT NULL,
    submitted_at TIMESTAMP,
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs Table
CREATE TABLE IF NOT EXISTS logs (
    id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) REFERENCES applications(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,           -- 'info', 'success', 'warning', 'error'
    screenshot_path TEXT,
    duration INT,                          -- runtime in ms
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings Table (Internal state variables)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Create Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_logs_application ON logs(application_id);

-- Activity Log Table (all system events — not just automation)
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,       -- e.g. 'resume_uploaded', 'job_imported', 'automation_success'
    message TEXT NOT NULL,              -- Human-readable description
    entity_type VARCHAR(50),            -- 'resume' | 'job' | 'application' | 'automation'
    entity_id VARCHAR(50),              -- FK to the relevant entity
    status VARCHAR(20) DEFAULT 'info',  -- 'info' | 'success' | 'warning' | 'error'
    metadata TEXT,                      -- JSON string: { resume, job, company, ... }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table (user-facing inbox)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(50) DEFAULT 'info',    -- 'resume' | 'job' | 'application' | 'automation' | 'ai' | 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    action_url VARCHAR(255),            -- Frontend route to navigate to on click
    is_read INTEGER DEFAULT 0,          -- 0 = unread, 1 = read
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

