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
    skills TEXT NOT NULL,                  
    experience TEXT NOT NULL,              
    summary TEXT,
    education TEXT NOT NULL,               
    resume_text TEXT NOT NULL,
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
    description TEXT NOT NULL,
    skills_required TEXT NOT NULL,         
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
    status VARCHAR(50) DEFAULT 'unapplied',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) PRIMARY KEY,
    resume_id VARCHAR(50) REFERENCES resumes(id) ON DELETE CASCADE,
    job_id VARCHAR(50) REFERENCES jobs(id) ON DELETE CASCADE,
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
    website VARCHAR(100) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_logs_application ON logs(application_id);

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

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

