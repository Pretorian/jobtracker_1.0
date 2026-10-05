# 🔄 Reparse Job Feature

## Overview

The **Reparse** feature allows you to refresh job data by re-scraping and re-analyzing the job URL with AI. This is especially useful when:

- The initial parse was from a URL without full content
- Job details have been updated on the company website
- You want to get an updated fit score with fresh analysis
- Skills or requirements have changed

## How It Works

### 1. Button Location

The "🔄 Reparse Job" button appears in the job detail view when:
- ✅ The job has an associated URL
- ✅ You're viewing a saved job

**Button appearance:**
- Purple border and text (#8B5CF6)
- Positioned between "Save Changes" and "Generate Resume"
- Only visible for jobs with URLs

### 2. User Flow

```
1. Select a job from your tracker
2. Click "🔄 Reparse Job" button
3. Confirmation dialog shows:
   "Reparse job from URL?

   This will refresh the job details, fit score, and skills
   by re-scraping and analyzing:
   https://example.com/job/123"
4. Click OK to proceed
5. Watch console for scraping/parsing progress
6. Job updates automatically with fresh data
```

### 3. What Gets Updated

**✅ Refreshed by AI:**
- Company name
- Job title
- Location
- Type (Full-time/Contract/etc.)
- Salary range
- Summary
- Fit score (0-100)
- Fit reason/analysis
- Key skills array

**✅ Preserved (Your Data):**
- Status (Saved/Applied/Interview/etc.)
- Applied date
- Last contact date
- Your notes
- Saved date

### 4. Behind the Scenes

When you click Reparse:

1. **Frontend validates**: Checks that job has a URL
2. **Scraping**: Playwright launches to fetch fresh content
   ```
   🌐 Starting Playwright scraper for: https://...
     🚀 Launching headless browser...
     📄 Navigating to page...
     ✅ Page loaded successfully
     ✅ Content extracted
   ```

3. **AI Analysis**: Claude parses the fresh content
   ```
   🤖 Calling Claude API to parse job description...
   ✅ Claude API response received (1,234ms)
   📊 Parsed job: Senior Engineer at Stripe (Fit: 89/100)
   ```

4. **Smart Merge**: Combines new AI data with your existing tracking data
   ```javascript
   {
     // Fresh from AI
     company: "Stripe",
     title: "Senior Backend Engineer",
     fitScore: 89,
     keySkills: ["Python", "FastAPI", "PostgreSQL"],

     // Your preserved data
     status: "applied",
     notes: "Talked to Sarah (recruiter)",
     appliedDate: "2026-03-01"
   }
   ```

5. **Database Update**: Updates job with merged data
6. **Activity Log**: Records "reparsed" action
7. **UI Refresh**: Shows updated job immediately

## Use Cases

### Case 1: URL-Only Jobs
```
Initial save: Just paste URL
  ↓
Quick preview without full scraping
  ↓
Later: Click Reparse for full analysis
```

### Case 2: Stale Data
```
Saved 2 weeks ago
  ↓
Company updated job description
  ↓
Reparse to get latest requirements
```

### Case 3: Fit Score Updates
```
Your skills changed (learned new tech)
  ↓
Customize fit score prompt in parser.js
  ↓
Reparse all jobs for updated fit scores
```

### Case 4: Failed Initial Parse
```
Initial scraping failed or timed out
  ↓
Saved with minimal data
  ↓
Try reparsing when connection is better
```

## Technical Details

### API Flow
```
POST /api/jobs/parse
  ↓
{ input: "https://example.com/job" }
  ↓
Scraper + Claude API
  ↓
{ company, title, fitScore, ... }
  ↓
PUT /api/jobs/:id
  ↓
{
  ...parsedData,
  status: currentJob.status,  // Preserved
  notes: currentJob.notes     // Preserved
}
```

### Database Operations

**Skills Update:**
```sql
-- Delete old skills
DELETE FROM job_skills WHERE jobId = ?

-- Insert new skills
INSERT INTO job_skills (jobId, skill) VALUES (?, ?)
-- Repeat for each skill
```

**Activity Logging:**
```sql
INSERT INTO activity_log (jobId, action, details)
VALUES (123, 'reparsed', 'Job details updated from source')
```

### Console Output

When reparsing, you'll see detailed logs:

```
🔄 Reparse requested for job #123

🌐 Starting Playwright scraper for: https://stripe.com/job
  🚀 Launching headless browser...
  📄 Navigating to page...
  ✅ Page loaded successfully
  ⏳ Waiting for dynamic content...
  🔍 Searching for job content...
  ✅ Content extracted using selector: "main"
  📊 Content length: 3,421 characters
  ✅ Scraping completed in 2,847ms
  🔒 Browser closed

🤖 Calling Claude API to parse job description...
✅ Claude API response received (1,543ms)
📊 Parsed job: Senior Backend Engineer at Stripe (Fit: 89/100)

💾 Updating job #123 with reparsed data
✅ Job updated successfully
```

## Error Handling

### No URL
```
alert("This job has no URL to reparse.
Please add the job description manually.")
```

### Scraping Failed
```
Playwright error → Falls back to Claude with URL only
Shows: "Unable to fetch full job description"
```

### Parse Failed
```
alert("Failed to reparse: [error message]")
Original job data remains unchanged
```

### Network Issues
```
Timeout after 30 seconds
Helpful tip shown in console
Job remains unchanged
```

## Best Practices

### 1. When to Reparse
- ✅ Job posting was updated
- ✅ Initial parse had limited data
- ✅ Want fresh fit score analysis
- ✅ After customizing fit prompts

### 2. When NOT to Reparse
- ❌ Job is closed/expired (URL might be dead)
- ❌ You've made extensive custom notes
- ❌ Just to "try it" (uses API credits)

### 3. Confirmation Dialog
Always shown before reparsing because:
- Consumes API credits (Claude API call)
- Takes time (scraping + parsing)
- Overwrites AI-generated fields

### 4. Data Preservation
Your manual entries are always safe:
- Status tracking
- Application dates
- Contact information
- Personal notes

## Customization

### Adjust Fit Scoring

Edit `server/scraper/parser.js`:

```javascript
fitScore is 0-100 based on fit for a candidate with:
- [Your specific background]
- [Your key skills]
- [Your experience level]
```

Then reparse jobs to get updated scores!

### Add More Fields

1. Update the parse prompt in `parser.js`
2. Add fields to database in `database.js`
3. Update UI in `JobTracker.js`

## Keyboard Shortcuts (Future)

Potential enhancements:
- `Cmd/Ctrl + R` to reparse selected job
- `Shift + R` to reparse all URL jobs
- Bulk reparse with progress bar

## Summary

The Reparse feature gives you the flexibility to:
- 🔄 Keep job data fresh
- 🎯 Update fit scores as you grow
- 🛠️ Recover from failed initial parses
- 📊 Get better analysis with full content

All while preserving your valuable tracking data!
