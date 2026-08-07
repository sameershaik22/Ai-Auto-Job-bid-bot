CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    candidate_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    linkedin_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    github_url VARCHAR(255),
    preferred_salary VARCHAR(100),
    notice_period VARCHAR(100),
    visa_status VARCHAR(100),
    languages TEXT,
    certifications TEXT,
    projects TEXT,
    skills TEXT NOT NULL DEFAULT '',
    experience TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    education TEXT NOT NULL DEFAULT '[]',
    resume_text TEXT NOT NULL DEFAULT '',
    years_of_experience INT DEFAULT 0,
    categories TEXT,
    technologies TEXT,
    resume_pdf TEXT,
    resume_docx TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(50) PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    skills_required TEXT NOT NULL DEFAULT '',
    salary VARCHAR(100),
    location VARCHAR(255),
    employment_type VARCHAR(100),
    ats_platform VARCHAR(100) DEFAULT 'generic',
    match_score INT DEFAULT 0,
    recommended_resume_id VARCHAR(50),
    recommended_resume_name VARCHAR(255),
    match_confidence VARCHAR(50),
    matched_skills TEXT,
    missing_skills TEXT,
    match_recommendations TEXT,
    ats_score INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unapplied',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) PRIMARY KEY,
    resume_id VARCHAR(50) REFERENCES resumes(id) ON DELETE CASCADE,
    job_id VARCHAR(50) REFERENCES jobs(id) ON DELETE CASCADE,
    queue_item_id VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    tailored_resume_text TEXT,
    cover_letter TEXT,
    proposal TEXT,
    score INT DEFAULT 0,
    original_score INT DEFAULT 0,
    ats_score INT DEFAULT 0,
    matched_skills TEXT,
    missing_skills TEXT,
    match_recommendations TEXT,
    interview_prep TEXT,
    website VARCHAR(100) NOT NULL DEFAULT 'generic',
    submitted_at TIMESTAMP,
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
    id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) REFERENCES applications(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    screenshot_path TEXT,
    duration INT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'info',
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(50) DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    action_url VARCHAR(255),
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_runs (
    id VARCHAR(50) PRIMARY KEY,
    total INT NOT NULL DEFAULT 0,
    completed INT DEFAULT 0,
    failed INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'running',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_items (
    id VARCHAR(50) PRIMARY KEY,
    queue_run_id VARCHAR(50) REFERENCES queue_runs(id) ON DELETE CASCADE,
    candidate_id VARCHAR(50) REFERENCES resumes(id) ON DELETE CASCADE,
    job_id VARCHAR(50) REFERENCES jobs(id) ON DELETE CASCADE,
    application_id VARCHAR(50),
    status VARCHAR(50) DEFAULT 'queued',
    position INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_credentials (
    id VARCHAR(50) PRIMARY KEY,
    platform VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    password_enc TEXT,
    extra_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_logs_application ON logs(application_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_queue_items_run ON queue_items(queue_run_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status);
