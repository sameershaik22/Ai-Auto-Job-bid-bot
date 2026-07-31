# 🤖 AutoBid Bot - Autonomous AI Job Application Agent

**AutoBid Bot** is an end-to-end, multi-candidate autonomous job application platform. It uses Google Gemini AI and Playwright stealth browser automation to automatically parse resumes, match candidate profiles to target jobs, dynamically tailor resumes & cover letters, and execute full job applications—including answering custom screening questions and submitting forms on job boards.

---

## ✨ Key Features

### 👤 Multi-Candidate Profile Management
- Store and manage multiple candidate resumes & profiles simultaneously (e.g., *Sameer, Arnav, Olawale, Alok, Craig*).
- Automatic PDF parsing & AI skill extraction (years of experience, category classification, primary tech stack).
- Clone, archive, and edit candidate profiles directly in the visual Resume Vault.

### 🎯 Intelligent Job Import & Scraper
- Import job postings via direct URL or raw text description.
- Built-in ATS detection engine supporting **Lever, Greenhouse, Ashby, SmartRecruiters, Workday, and Generic Web Forms**.
- Automated ATS match scoring and detailed missing skill analysis.

### 📝 AI Resume & Cover Letter Tailoring Engine
- Powered by **Google Gemini API** (`@google/generative-ai`).
- Generates job-specific tailored resumes optimized for ATS parsers.
- Crafts customized cover letters tailored to the target role, candidate background, and tone preferences.

### ⚡ Batch Automation Queue Builder
- Select multiple candidates $\times$ multiple target jobs in the **Queue Builder**.
- Launch automated batch runs with real-time execution tracking.
- Live Socket.io streaming of browser logs, step durations, and submission statuses.

### 🕵️ Stealth Playwright Browser Automation
- Spawns headless/headed Chromium browsers with human-like interactions (randomized typing delay, coordinate clicks).
- Auto-detects input fields (Name, Email, Phone, LinkedIn, Portfolio, Salary expectations, Experience).
- **AI Question Answering**: Dynamically answers custom open-ended screening questions using candidate profile context.
- Automatic tailored resume PDF upload and application submission.

### 📊 Audit Logs & Analytics Dashboard
- Comprehensive metrics: Total Submissions, Success Rates, Active Queues, and Failures.
- Activity feed and detailed audit logs per application attempt.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + Lucide Icons
- **Real-Time**: Socket.io-client for live terminal logs & status updates

### Backend
- **Framework**: Node.js + Express.js
- **Database**: SQLite / PostgreSQL with dual database adapters (`sqlite3` / `pg`)
- **AI Engine**: Google Gemini API (`@google/generative-ai`)
- **Automation**: Playwright Chromium (Stealth Browser Runner)
- **Security**: bcrypt & JWT authentication

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v18.x` or higher
- **Gemini API Key**: Get a key from [Google AI Studio](https://aistudio.google.com/)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/sameershaik22/Ai-Auto-Job-bid-bot.git
cd Ai-Auto-Job-bid-bot

# Install root dependencies
npm install

# Install backend & frontend dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 3. Environment Setup

Create a `.env` file in the root or `backend/` directory:

```env
# Server Config
PORT=5000

# AI Service (Google Gemini API)
GEMINI_API_KEY="your-gemini-api-key"

# Database Configuration (Defaults to SQLite backend/db.sqlite if DATABASE_URL is not set)
# DATABASE_URL="postgresql://user:password@localhost:5432/autobid"

# Security
JWT_SECRET="your-super-secret-jwt-key"

# Automation Config
HEADLESS="false" # Set to 'true' to run Playwright invisibly
```

### 4. Running the Application

Run both backend and frontend concurrently with a single command from the project root:

```bash
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## 📖 How It Works

1. **Add Profiles**: Go to the **Profiles** tab, upload candidate resumes (PDFs), and let AI parse skills and experience.
2. **Import Jobs**: Go to the **Jobs** tab and paste target job links or descriptions.
3. **Build Queue**: Navigate to **Queue**, select candidate profiles and target jobs, then click **Launch Queue**.
4. **Autonomous Execution**: Watch the live logs terminal as the bot tailors resumes, writes cover letters, launches stealth Chromium instances, fills application forms, answers questions, and submits applications automatically.

---

## ⚠️ Disclaimer

This application is created for educational and personal workflow automation purposes. Ensure compliance with the Terms of Service of target job boards when utilizing automated browser tools.

---

*Built with ❤️ for intelligent job search automation.*
