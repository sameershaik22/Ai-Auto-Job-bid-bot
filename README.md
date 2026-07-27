# 🤖 AutoBid Bot (AI Job Application Assistant)

AutoBid Bot is a cutting-edge, end-to-end platform that leverages AI and browser automation to intelligently manage and submit job applications on your behalf. 

Tired of manually filling out hundreds of applications and tailoring your resume each time? AutoBid Bot acts as your personal AI recruiter. It ingests your base resume, matches it against job descriptions, dynamically tailors your resume using Google Gemini 2.0 Flash, and physically drives a Chromium browser to submit the application for you.

---

## Features

- ** Secure Authentication**: Full JWT-based login/register flow.
- ** Resume Vault**: Upload your PDF resumes. The system uses AI to parse out your skills, experience, and education into a structured format.
- ** Job Board Integration**: Paste job URLs or descriptions. The system scores your resume against the job requirements using an AI matching algorithm.
- ** AI Resume Tailoring**: Automatically rewrite and tailor your resume and cover letter specifically for the job you are applying to.
- ** Headless Automation**: Uses Playwright to spin up a browser in stealth mode, fill out forms, upload your tailored resume, and submit the application for you.
- ** Real-time Dashboard**: Track live automation status, view audit logs, and monitor your application success rates with a sleek, dark-themed UI.

---

## Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS & Lucide Icons
- **Real-time**: Socket.io-client for live automation logs

### Backend
- **Framework**: Node.js & Express.js
- **Database**: PostgreSQL (Neon Serverless DB) & `pg` pool
- **AI Engine**: Google Gemini API (`@google/genai`)
- **Automation**: Playwright (`chromium`)
- **Security**: bcrypt & jsonwebtoken

---

## Getting Started

Follow these instructions to get the platform running on your local machine.

### 1. Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: Local database or a cloud database like Neon.
- **Gemini API Key**: Obtain a free key from Google AI Studio.

### 2. Installation

Clone the repository and install dependencies for both the frontend and backend.

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory (or inside the backend folder) and add the following keys:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@hostname/dbname?sslmode=require"

# AI Service (Google Gemini)
GEMINI_API_KEY="your-gemini-api-key"

# Security
JWT_SECRET="your-super-secret-jwt-key"

# (Optional) Playwright Config
HEADLESS="false" # Set to 'true' to hide the browser during automation
```

### 4. Database Setup

The backend handles database migrations automatically on startup! Just ensure your `DATABASE_URL` is correct, and the server will initialize the schema (Users, Resumes, Jobs, Applications, Logs) automatically.

### 5. Running the Application

You need to run both the frontend and backend servers.

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

---

##  How to Use

1. **Create an Account**: Open `http://localhost:5173` and register a new account.
2. **Add a Resume**: Go to the **Resumes** tab and ingest your resume. The AI will extract your skills and experience.
3. **Find a Job**: Go to the **Jobs** tab and add a job you want to apply for.
4. **Start Automation**: In the **Automation** tab, select your resume and the target job, then click "Run Automation".
5. **Watch the Magic**: A Chromium browser will spawn on your screen, fill out the application details, upload your resume, and click submit. You can track everything live in the **Logs** tab!

---

## Disclaimer

This tool is built for educational and personal use. When using browser automation to apply for jobs on platforms like LinkedIn or Indeed, please ensure you comply with their respective Terms of Service. Be mindful of AI hallucinations when submitting automated cover letters!

---

*Built with passion for seamless job hunting.*
