# JobTracker — AI-Powered Job Application Tracker

Track your job search with Claude-powered job description parsing, Playwright web scraping, automatic resume generation, and daily follow-up reminders.

## Features

- **AI Job Parsing** — Paste a URL or full job description; Claude extracts company, title, location, salary, key skills, role summary, and fit score (0–100) tailored to your background
- **Automated Web Scraping** — Playwright automatically extracts job content from URLs
- **Application Pipeline** — Track status: Saved → Applied → Screening → Interview → Offer → Rejected/Withdrawn
- **SQLite Database** — Persistent storage with full CRUD operations
- **Auto Resume Generation** — Generate tailored .docx resumes from your master template
- **🎯 100% Match Resume** — AI-optimized resumes that strategically close gaps and maximize job fit
- **⚖️ Resume Comparison** — Head-to-head analysis of two job opportunities with strengths, weaknesses, and recommendations
- **💼 Ideal Roles Suggestions** — Reverse job search suggesting perfect roles for your profile based on your background
- **Gap Analysis** — AI identifies what's missing for 100% match and suggests how to optimize your resume
- **Daily Follow-up Alerts** — Automated script identifies jobs needing follow-up after 7+ days
- **Activity Logging** — Track all changes and interactions with jobs
- **Notes & Contacts** — Per-job notes for interview prep, recruiter contacts, action items

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 19
- **Backend**: Express.js + Node.js
- **Database**: SQLite with better-sqlite3
- **Scraping**: Playwright (headless Chromium)
- **AI**: Anthropic Claude API (claude-sonnet-4)
- **Resume Generation**: docxtemplater + pizzip

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key and a session secret:
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
SESSION_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

`npm run up` generates `SESSION_SECRET` for you if it's empty.

Get your API key at: https://console.anthropic.com/

### 3. Initialize the database and create your login
```bash
npm run db:init
npm run db:auth
```

This creates `data/jobs.db` with the required schema and an `admin` user. `db:auth` prints a random password once; save it, then change it in Settings after logging in. To choose the password yourself, set `ADMIN_PASSWORD` in `.env` before running `db:auth`.

### 4. Install Playwright browsers
```bash
npx playwright install chromium
```

### 5. Add your master resume template

Create a Word document (.docx) with your resume and save it as:
```
data/master-resume-template.docx
```

You can use template variables in your resume:
- `{targetCompany}` - Replaced with company name
- `{targetRole}` - Replaced with job title
- `{targetLocation}` - Replaced with location
- `{skills}` - Replaced with key skills
- `{date}` - Replaced with current date

**For AI-optimized resumes, additional variables are available:**
- `{objective}` - AI-generated objective tailored to the role
- `{summary}` - AI-generated professional summary highlighting relevant experience
- `{keyAchievements}` - AI-generated list of achievements relevant to the job
- `{relevantExperience}` - AI-generated experience section emphasizing transferable skills

Example:
```
I am excited to apply for the {targetRole} position at {targetCompany}.

OBJECTIVE
{objective}

PROFESSIONAL SUMMARY
{summary}

KEY ACHIEVEMENTS
{keyAchievements}
```

### 6. Start the application
```bash
npm run dev
```

This starts:
- Next.js frontend at http://localhost:4000
- Express API server at http://localhost:4001

---

## Usage

### Adding Jobs

1. Click "+ Add Job" in the UI
2. Paste a job URL or full job description text
3. The system will:
   - Scrape the URL with Playwright (if it's a URL)
   - Parse the content with Claude
   - Extract company, title, skills, and generate a fit score
4. Review and save to your tracker

### Generating Resumes

1. Select a job from your tracker
2. Click "📄 Generate Resume"
3. A tailored resume will be created using your master template
4. The .docx file downloads automatically

### Generating 100% Match Resume

1. Select a job from your tracker
2. Review the Gap Analysis to see what's missing for 100% match
3. Click "🎯 100% Match Resume"
4. The AI will:
   - Analyze gaps between your profile and the job requirements
   - Strategically reframe your experience to emphasize relevant skills
   - Generate an optimized resume that maximizes job fit
5. The optimized .docx file downloads automatically

### Comparing Job Opportunities

1. Click the "⚖️ Compare" button in the header
2. The system will compare your top 2 saved/applied jobs
3. Review the head-to-head analysis:
   - Strengths and weaknesses of each position
   - Unique vs shared skills required
   - Career impact assessment
   - Resume strategy recommendations
   - AI recommendation with priority level
4. Use this to prioritize which roles to focus on

### Finding Ideal Roles

1. Click the "💼 Ideal Roles" button in the header
2. The AI will analyze your background and suggest 5-8 perfect-match roles
3. Review suggestions including:
   - Why each role is a 100% fit for you
   - Key responsibilities and required skills
   - Target companies and industries
   - Salary ranges and growth potential
   - Career paths and market demand
4. Use these insights to guide your job search strategy

### Daily Follow-up Notifications

Run the notification script manually:
```bash
npm run notify
```

Or schedule it to run daily:

**macOS/Linux (crontab)**:
```bash
0 9 * * * cd /path/to/job-tracker && npm run notify
```

**Windows (Task Scheduler)**:
- Program: `node`
- Arguments: `C:\path\to\job-tracker\scripts\daily-followup.js`
- Start in: `C:\path\to\job-tracker`

---

## Project Structure

```
job-tracker/
├── app/                    # Next.js app directory
│   ├── layout.js          # Root layout
│   ├── page.js            # Home page
│   └── globals.css        # Global styles
├── components/             # React components
│   └── JobTracker.js      # Main job tracker UI
├── server/                 # Express backend
│   ├── index.js           # Express server
│   ├── db/
│   │   ├── init.js        # Database initialization
│   │   └── database.js    # Database queries
│   ├── routes/
│   │   ├── jobs.js        # Job API routes
│   │   └── resume.js      # Resume API routes
│   ├── scraper/
│   │   ├── scraper.js     # Playwright scraper
│   │   └── parser.js      # Claude parser
│   └── resume/
│       ├── generator.js   # Standard resume generation
│       └── optimized-generator.js  # AI-optimized resume generation
├── scripts/
│   └── daily-followup.js  # Follow-up notification script
├── data/
│   ├── jobs.db            # SQLite database (created on init)
│   └── master-resume-template.docx  # Your resume template
└── public/
    └── resumes/           # Generated resumes
```

---

## API Endpoints

### Jobs
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get specific job
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/jobs/parse` - Parse job URL or text
- `POST /api/jobs/:id/resume` - Generate resume for job
- `POST /api/jobs/:id/resume/optimized` - Generate AI-optimized 100% match resume
- `POST /api/jobs/compare-resumes` - Compare two jobs head-to-head
- `GET /api/jobs/follow-ups` - Get jobs needing follow-up

### Resume
- `GET /api/resume/template` - Get master resume template info
- `GET /api/resume/template/download` - Download master resume template
- `POST /api/resume/template/upload` - Upload new master resume template
- `DELETE /api/resume/template` - Delete master resume template
- `POST /api/resume/suggest-roles` - Get AI-suggested ideal roles for your profile

---

## Production Deployment

### Build for production
```bash
npm run build
```

### Start production server
```bash
npm start
```

The Express server serves both the API and Next.js static files.

---

## Troubleshooting

### Port 3001 already in use
If you see `Error: listen EADDRINUSE: address already in use :::3001`, the server is already running or another process is using port 3001.

**Solution:**

1. Kill the process using port 3001:
```bash
# macOS/Linux
lsof -ti:3001 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

2. Or change the port in your `.env` file:
```env
PORT=3002
```

3. Restart the development server:
```bash
npm run dev
```

### Git config file locked
If you see `error: could not lock config file .git/config: File exists`, remove the lock file:
```bash
rm -f .git/config.lock
```

### Scraping fails for certain websites
Some job boards (Workday, Greenhouse, Lever) have anti-scraping measures. If scraping fails, paste the job description text directly instead.

### Resume generation fails
Ensure your master resume template exists at `data/master-resume-template.docx` and is a valid .docx file.

### Database errors
Re-initialize the database:
```bash
rm data/jobs.db
npm run db:init
npm run db:auth
```

### API Key not loading
If the server shows `❌ ANTHROPIC_API_KEY: NOT SET`:

1. Ensure you have a `.env` file in the project root
2. Verify the API key is correctly set:
```env
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```
3. Restart the server (kill and run `npm run dev` again)
4. Get your API key at: https://console.anthropic.com/

---

## Customization

### Customize fit scoring
Edit the prompts in `server/scraper/parser.js` to match your background and preferences.

### Add email notifications
Uncomment and configure the email section in `scripts/daily-followup.js`.

### Customize resume templates
Add more template variables in `server/resume/generator.js`.

---

## License

MIT
