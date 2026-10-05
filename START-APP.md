# 🚀 Start Your JobTracker App

## Quick Start

```bash
npm run dev
```

This starts both:
- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:4001

---

## What You'll See

### Server Startup (Terminal)

```
══════════════════════════════════════════════════════════════════════
🔍 VALIDATING ENVIRONMENT CONFIGURATION
══════════════════════════════════════════════════════════════════════

📋 Required Environment Variables:
  ✅ ANTHROPIC_API_KEY: sk-ant-api0...xyz  (or ❌ if not set)

💾 Database:
  ✅ Database found: /path/to/jobs.db
  📊 Size: 36.00 KB

📄 Resume Template:
  ⚠️  Template not found (upload at /resume)
  ✅ Resume output directory exists

══════════════════════════════════════════════════════════════════════
✅ All required configurations are valid!
══════════════════════════════════════════════════════════════════════

🚀 SERVER STARTED
═══════════════════════════════════════════════════════════════
  API Server:    http://localhost:4001
  Health Check:  http://localhost:4001/api/health
  Frontend:      http://localhost:4000
═══════════════════════════════════════════════════════════════
📡 API Endpoints:
  GET    /api/jobs                - List all jobs
  POST   /api/jobs                - Create job
  ...
═══════════════════════════════════════════════════════════════
```

### Frontend (Browser)

Open http://localhost:4000 to see:
- Clean, dark-themed UI
- Job tracker dashboard
- "📄 Resume" button in top-right
- "+ Add Job" button

---

## First Time Setup Checklist

### 1. ✅ Environment Variables
Edit `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. ✅ Upload Resume Template
- Click "📄 Resume" button
- Upload your .docx resume
- Use template variables: {targetCompany}, {targetRole}, etc.

### 3. ✅ Add Your First Job
- Click "+ Add Job"
- Paste a job URL or description
- AI will parse and extract details
- Save to tracker

---

## Features to Try

### Job Tracking
```
1. Add job (URL or text)
2. Review AI-parsed details
3. Update status as you progress
4. Set applied date after applying
5. Track follow-ups
```

### Quick Reparse
```
1. Find job with URL in sidebar
2. Click 🔄 button to refresh
3. Get updated data instantly
```

### Resume Generation
```
1. Select a job
2. Click "📄 Generate Resume"
3. Tailored .docx downloads
```

### Follow-up Reminders
```bash
npm run notify
```

---

## Troubleshooting

### Port Already in Use
If you see:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Fix:**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in .env
PORT=3002
```

### Missing API Key
```
❌ ANTHROPIC_API_KEY is not set or invalid!
```

**Fix:** Add your key to `.env` file

### Build Cache Issues
If you see module errors:
```bash
rm -rf .next
npm run dev
```

---

## Development vs Production

### Development (with hot reload)
```bash
npm run dev
```

### Production (optimized)
```bash
npm run build
npm start
```

---

## Keyboard Shortcuts

Current:
- None (mouse-driven UI)

Future possibilities:
- `Cmd/Ctrl + K` - Quick add job
- `R` - Reparse selected job
- `↑↓` - Navigate jobs
- `Enter` - Select job

---

## What's Running

### Frontend (Next.js)
- Port: 3000
- Hot reload enabled
- React DevTools compatible

### Backend (Express)
- Port: 3001
- Auto-restart with nodemon
- SQLite database
- Playwright for scraping
- Claude API integration

### Both Together
```bash
npm run dev  # Starts both with concurrently
```

### Separately (for debugging)
```bash
# Terminal 1
npm run dev:next

# Terminal 2
npm run dev:server
```

---

## Logs & Monitoring

### Console Output
Watch for:
- 🌐 Scraping progress
- 🤖 AI parsing
- 📝 Resume generation
- ✅ Success messages
- ❌ Error messages

### API Health Check
```bash
curl http://localhost:4001/api/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-03-10T17:00:00.000Z",
  "environment": {
    "anthropicApiKey": true,
    "databaseExists": true,
    "resumeTemplateExists": false
  },
  "version": "1.0.0"
}
```

---

## Next Steps

1. **Add API Key** to `.env`
2. **Start the app**: `npm run dev`
3. **Upload resume** at http://localhost:4000/resume
4. **Add a job** and test the features
5. **Generate resume** for a job
6. **Set up notifications**: `npm run notify` (optional)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend + backend |
| `npm run dev:next` | Frontend only |
| `npm run dev:server` | Backend only |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run db:init` | Reset database |
| `npm run notify` | Check follow-ups |

---

## Support

- **Docs**: Check `README.md`, `NEW-FEATURES.md`, `IMPROVEMENTS.md`
- **Issues**: Build cache? Run `rm -rf .next && npm run dev`
- **API**: Visit http://localhost:4001/api/health

---

Ready? Let's go!

```bash
npm run dev
```

Then open: **http://localhost:4000** 🚀
