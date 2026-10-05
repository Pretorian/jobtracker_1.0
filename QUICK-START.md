# 🚀 Quick Start Guide

## Your JobTracker is Ready!

All features have been implemented and tested. Here's how to get started:

---

## ✅ What's Already Done

1. ✅ Next.js 15 app with React 19
2. ✅ Express backend with API routes
3. ✅ SQLite database initialized
4. ✅ Playwright installed for web scraping
5. ✅ All dependencies installed
6. ✅ Environment validation on startup
7. ✅ Detailed console logging for all operations
8. ✅ Resume template manager UI
9. ✅ Build verified and working

---

## 🎯 3 Steps to Start

### 1. Add Your API Key

Edit `.env` and add your Anthropic API key:

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

Get your key at: https://console.anthropic.com/

### 2. Upload Your Resume (Optional)

You can do this later through the web UI, or manually place your resume at:
```
data/master-resume-template.docx
```

### 3. Start the App

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:4001

---

## 📱 Using the App

### Main Dashboard (/)

**Add a Job:**
1. Click "+ Add Job"
2. Paste a job URL or full job description
3. AI will parse and extract details
4. Review and save

**Track Progress:**
- Update job status (Saved → Applied → Interview → Offer)
- Add notes, dates, contacts
- Filter by status
- See follow-up alerts for jobs older than 7 days

**Generate Resume:**
1. Select a job
2. Click "📄 Generate Resume"
3. Tailored .docx downloads automatically

### Resume Manager (/resume)

**Click "📄 Resume" button to:**
- Upload your master resume template (.docx)
- Download current template
- View template status and size
- Learn about template variables
- Delete/replace template (auto-backup)

**Template Variables:**
Use these in your resume - they'll be replaced automatically:
- `{targetCompany}` → Company name
- `{targetRole}` → Job title
- `{targetLocation}` → Location
- `{skills}` → Key skills
- `{date}` → Current date

---

## 🎨 What You'll See

### Server Startup
```
══════════════════════════════════════════════════════════════════════
🔍 VALIDATING ENVIRONMENT CONFIGURATION
══════════════════════════════════════════════════════════════════════

📋 Required Environment Variables:
  ✅ ANTHROPIC_API_KEY: sk-ant-api0...xyz

💾 Database:
  ✅ Database found: /path/to/jobs.db
  📊 Size: 36.00 KB

📄 Resume Template:
  ✅ Template found
  📊 Size: 25.43 KB

══════════════════════════════════════════════════════════════════════
✅ All required configurations are valid!
══════════════════════════════════════════════════════════════════════

🚀 SERVER STARTED
  API Server:    http://localhost:4001
  Frontend:      http://localhost:4000
```

### Job Parsing
```
🌐 Starting Playwright scraper for: https://example.com/job
  ✅ Page loaded successfully
  ✅ Content extracted using selector: "main"
  📊 Content length: 2,847 characters

🤖 Calling Claude API to parse job description...
✅ Claude API response received (1,234ms)
📊 Parsed job: Senior Software Engineer at Google (Fit: 87/100)
```

### Resume Generation
```
📝 Generating resume for: Senior Engineer at Stripe
  ✅ Template found, reading file...
  📋 Template data:
     Company: Stripe
     Role: Senior Engineer
     Skills: Python, FastAPI, PostgreSQL
  ✅ Resume saved: resume_Stripe_Senior_Engineer_1234567890.docx
```

---

## 📊 Daily Notifications

Run manually:
```bash
npm run notify
```

Output:
```
═══════════════════════════════════════════════════════════════
⚡ FOLLOW-UP REMINDER - March 10, 2026
═══════════════════════════════════════════════════════════════

You have 3 jobs that need follow-up:

1. Senior Engineer at Stripe
   Status: APPLIED
   Applied: 2026-03-01 (9 days ago)
   URL: https://stripe.com/jobs/123

2. Staff Engineer at Google
   Status: SCREENING
   Applied: 2026-02-28 (10 days ago)

3. Principal Engineer at Netflix
   Status: APPLIED
   Applied: 2026-02-25 (13 days ago)
   URL: https://netflix.com/jobs/456

═══════════════════════════════════════════════════════════════
💡 TIP: Update "Last Contact" date after following up
═══════════════════════════════════════════════════════════════
```

**Schedule Daily (Optional):**

Mac/Linux - Add to crontab:
```bash
0 9 * * * cd /path/to/job-tracker && npm run notify
```

Windows - Task Scheduler:
- Program: `node`
- Arguments: `C:\path\to\job-tracker\scripts\daily-followup.js`
- Schedule: Daily at 9:00 AM

---

## 🔧 Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend + backend |
| `npm run dev:next` | Start Next.js only |
| `npm run dev:server` | Start Express API only |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run db:init` | Reset database |
| `npm run notify` | Check follow-ups |

---

## 🐛 Troubleshooting

### Missing API Key
```
❌ ANTHROPIC_API_KEY is not set or invalid!
💡 Add your API key to .env file
```
**Fix:** Edit `.env` and add your key

### Scraping Fails
```
❌ Scraping failed: timeout
💡 The page took too long to load
```
**Fix:** Paste the job description text directly instead

### Resume Generation Fails
```
❌ Master resume template not found!
💡 Expected location: data/master-resume-template.docx
```
**Fix:** Upload template at http://localhost:4000/resume

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Fix:** Stop other processes on port 3001, or change PORT in `.env`

---

## 📚 API Endpoints

All available at `http://localhost:4001/api`

**Jobs:**
- `GET /jobs` - List all jobs
- `POST /jobs` - Create job
- `POST /jobs/parse` - Parse job URL/text
- `GET /jobs/:id` - Get job details
- `PUT /jobs/:id` - Update job
- `DELETE /jobs/:id` - Delete job
- `POST /jobs/:id/resume` - Generate resume
- `GET /jobs/follow-ups` - Get jobs needing follow-up

**Resume:**
- `GET /resume/template` - Get template info
- `GET /resume/template/download` - Download template
- `POST /resume/template/upload` - Upload template
- `DELETE /resume/template` - Delete template

**Health:**
- `GET /health` - Check system status

---

## 💡 Pro Tips

1. **Environment Validation**: Watch the startup logs to catch configuration issues early

2. **Console Monitoring**: Keep an eye on the console for detailed operation logs

3. **Resume Backups**: The system automatically backs up your template before replacing it

4. **Fit Scores**: Customize the fit score prompts in `server/scraper/parser.js` to match your background

5. **Scraping Issues**: Some job boards block automation. When scraping fails, copy/paste the job description directly

6. **Template Variables**: Use variables strategically in cover letter sections, not in your core experience

7. **Status Workflow**: Move jobs through the pipeline: Saved → Applied → Screening → Interview → Offer

8. **Follow-ups**: Update "Last Contact" date to reset the 7-day follow-up timer

---

## 🎉 You're Ready!

Everything is set up and working. Just add your API key and start tracking!

```bash
npm run dev
```

Then visit: **http://localhost:4000**

Questions? Check:
- `README.md` - Full documentation
- `NEW-FEATURES.md` - Latest features added
- `SETUP-COMPLETE.md` - Setup details

Happy job hunting! 🚀
