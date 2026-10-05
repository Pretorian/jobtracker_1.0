const express = require('express')
const router = express.Router()
const path = require('path')
const { body, param, query, validationResult } = require('express-validator')
const {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getJobsNeedingFollowUp,
  createGapItem,
  getGapItemsByJob,
  getAllGapItems,
  updateGapItem,
  deleteGapItem,
  createActionPlan,
  getActionPlansByJob,
  getGapAnalysisCache,
  saveGapAnalysisCache,
  getApplicationAnalytics,
  getStatusHistory,
  getAllStatusHistory,
  getTopCompanies,
  getTopSkills,
  getApplicationTrends,
  exportApplicationData,
  // Document management
  getResumeGenerations,
  getCoverLetterGenerations,
  getLatestResume,
  getLatestCoverLetter,
  deleteResumeVersion,
  deleteCoverLetterVersion,
  getDocumentStats,
  // Settings management
  getSettings,
  updateSettings,
} = require('../db/database')
const { scrapeJobUrl } = require('../scraper/scraper')
const { parseWithClaude } = require('../scraper/parser')
const { generateResumeForJob } = require('../resume/generator')
const { generateOptimizedResume } = require('../resume/optimized-generator')
const { generateCoverLetter } = require('../cover-letter/generator')
const { diffLines } = require('../utils/line-diff')

const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')

// Extract and parse the first balanced JSON object from an LLM response.
// Models sometimes wrap JSON in prose that contains stray braces (e.g.
// "Here's the analysis {below}: { ...real json... }"), which breaks a naive
// first-'{'-to-last-'}' regex. This scans for each '{', walks a brace counter
// that respects string literals/escapes to find the matching '}', and tries to
// JSON.parse that candidate. Returns the parsed object, or null if none parse.
function extractJsonObject(text) {
  if (!text) return null
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') {
        inString = true
      } else if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) {
          const candidate = text.slice(start, i + 1)
          try {
            return JSON.parse(candidate)
          } catch (e) {
            break // unbalanced/invalid; advance to the next '{'
          }
        }
      }
    }
  }
  return null
}

// Normalize a stored document path to an absolute path inside public/, guarding
// against traversal. Stored paths come in several shapes — a web path
// ("/resumes/x.docx"), a public-relative path ("resumes/x.docx"), or an
// absolute path containing ".../public/...". Returns { fullPath } on success or
// { error: { status, message } } on rejection.
function resolvePublicPath(filePath) {
  if (!filePath) return { error: { status: 400, message: 'File path is required' } }
  if (filePath.includes('..') || filePath.includes('\0')) {
    console.warn(`⚠️  Path traversal attempt detected: ${filePath}`)
    return { error: { status: 400, message: 'Invalid file path' } }
  }

  const publicDir = path.resolve(path.join(__dirname, '../../public'))
  let relativePath = filePath.replace(/\\/g, '/')
  const publicMarker = relativePath.indexOf('/public/')
  if (publicMarker !== -1) {
    relativePath = relativePath.slice(publicMarker + '/public/'.length)
  }
  relativePath = relativePath.replace(/^\/+/, '')

  const fullPath = path.resolve(publicDir, relativePath)
  if (fullPath !== publicDir && !fullPath.startsWith(publicDir + path.sep)) {
    console.warn(`⚠️  Path traversal blocked: ${filePath} -> ${fullPath}`)
    return { error: { status: 403, message: 'Access denied' } }
  }
  return { fullPath }
}

// Render the master template with the baseline (non-tailored) content and return
// its plain text — the "before" side of a master-vs-generated resume diff.
async function renderMasterBaselineText() {
  const fs = require('fs')
  const PizZip = require('pizzip')
  const Docxtemplater = require('docxtemplater')
  const mammoth = require('mammoth')

  let masterContent = {}
  try {
    masterContent = require('../../data/master-content.json')
  } catch (e) {
    /* no baseline content; tags render empty */
  }

  const zip = new PizZip(fs.readFileSync(templatePath, 'binary'))
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  doc.render({
    targetCompany: 'Master Template',
    targetRole: 'Baseline',
    targetLocation: 'Any',
    date: '',
    ...masterContent,
  })
  const buf = doc.getZip().generate({ type: 'nodebuffer' })
  return (await mammoth.extractRawText({ buffer: buf })).value
}

// Rate limiters
const rateLimit = require('express-rate-limit')

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many AI requests, please try again later.' }
})

const bulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many bulk operations, please try again later.' }
})

// Validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() })
  }
  next()
}

// GET /api/jobs - Get all jobs
router.get('/', (req, res) => {
  try {
    const userId = req.session.userId
    const jobs = getAllJobs(userId)
    res.json(jobs)
  } catch (error) {
    console.error('Error fetching jobs:', error)
    res.status(500).json({ error: 'Failed to fetch jobs' })
  }
})

// GET /api/jobs/follow-ups - Get jobs needing follow-up
router.get('/follow-ups', (req, res) => {
  try {
    const jobs = getJobsNeedingFollowUp()
    res.json(jobs)
  } catch (error) {
    console.error('Error fetching follow-ups:', error)
    res.status(500).json({ error: 'Failed to fetch follow-ups' })
  }
})

// POST /api/jobs/parse - Parse a job URL or text
router.post('/parse',
  aiLimiter,
  [
    body('input').trim().notEmpty().withMessage('Input is required')
      .isLength({ max: 50000 }).withMessage('Input too long'),
  ],
  validateInput,
  async (req, res) => {
    try {
      const { input } = req.body
      const isUrl = input.trim().startsWith('http')
      let content = input

      // If it's a URL, validate it
      if (isUrl) {
        try {
          new URL(input.trim()) // Validate URL format
          const scraped = await scrapeJobUrl(input.trim())
          if (scraped) {
            content = scraped
          }
        } catch (scrapeError) {
          console.warn('Scraping failed, falling back to Claude with URL:', scrapeError.message)
        }
      }

      // Parse with Claude
      const parsed = await parseWithClaude(content, isUrl)
      res.json(parsed)
    } catch (error) {
      console.error('Error parsing job:', error)
      res.status(500).json({ error: 'Failed to parse job' })
    }
  }
)

// GET /api/jobs/preview?path=... - Preview a document as HTML
router.get('/preview', async (req, res) => {
  try {
    const mammoth = require('mammoth')
    const fs = require('fs')

    const { fullPath, error } = resolvePublicPath(req.query.path)
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Check if it's a .docx file
    if (fullPath.endsWith('.docx')) {
      const buffer = fs.readFileSync(fullPath)
      const result = await mammoth.convertToHtml({ buffer })

      res.json({
        success: true,
        html: result.value,
        messages: result.messages
      })
    } else if (fullPath.endsWith('.txt')) {
      // For plain text files - escape HTML to prevent XSS
      const content = fs.readFileSync(fullPath, 'utf-8')
      const escapedContent = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

      res.json({
        success: true,
        html: `<pre style="white-space: pre-wrap; font-family: system-ui;">${escapedContent}</pre>`,
        messages: []
      })
    } else {
      res.status(400).json({ error: 'Unsupported file type. Only .docx and .txt files can be previewed.' })
    }
  } catch (error) {
    console.error('Error previewing document:', error)
    res.status(500).json({ error: 'Failed to preview document' })
  }
})

// GET /api/jobs/diff?path=... - Diff a generated resume against the master template
router.get('/diff', async (req, res) => {
  try {
    const mammoth = require('mammoth')
    const fs = require('fs')

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Master resume template not found' })
    }

    const { fullPath, error } = resolvePublicPath(req.query.path)
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Generated resume not found' })
    }
    if (!fullPath.endsWith('.docx')) {
      return res.status(400).json({ error: 'Only .docx resumes can be diffed' })
    }

    // The master template holds raw {tags}, so diffing its literal text would
    // just show tag-substitution noise. Render it with the baseline master
    // content first so the diff reflects real content changes the AI made.
    const masterText = await renderMasterBaselineText()
    const generatedText = await mammoth
      .extractRawText({ buffer: fs.readFileSync(fullPath) })
      .then((r) => r.value)

    const diff = diffLines(masterText, generatedText)
    const added = diff.filter((d) => d.type === 'added').length
    const removed = diff.filter((d) => d.type === 'removed').length

    res.json({
      success: true,
      diff,
      stats: { added, removed, unchanged: diff.length - added - removed },
      identical: added === 0 && removed === 0,
    })
  } catch (error) {
    console.error('Error diffing document:', error)
    res.status(500).json({ error: `Failed to diff document: ${error.message}` })
  }
})

// GET /api/jobs/:id - Get a specific job
router.get('/:id', (req, res) => {
  try {
    const userId = req.session.userId
    const job = getJobById(parseInt(req.params.id), userId)
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    res.json(job)
  } catch (error) {
    console.error('Error fetching job:', error)
    res.status(500).json({ error: 'Failed to fetch job' })
  }
})

// POST /api/jobs - Create a new job
router.post('/', (req, res) => {
  try {
    const userId = req.session.userId
    const job = createJob(req.body, userId)
    res.status(201).json(job)
  } catch (error) {
    console.error('Error creating job:', error)
    res.status(500).json({ error: 'Failed to create job' })
  }
})

// PUT /api/jobs/:id - Update a job
router.put('/:id', (req, res) => {
  try {
    const userId = req.session.userId
    const job = updateJob(parseInt(req.params.id), req.body, userId)
    res.json(job)
  } catch (error) {
    console.error('Error updating job:', error)
    res.status(500).json({ error: error.message || 'Failed to update job' })
  }
})

// DELETE /api/jobs/:id - Delete a job
router.delete('/:id', (req, res) => {
  try {
    const userId = req.session.userId
    const deleted = deleteJob(parseInt(req.params.id), userId)
    if (!deleted) {
      return res.status(404).json({ error: 'Job not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    res.status(500).json({ error: 'Failed to delete job' })
  }
})

// POST /api/jobs/:id/resume - Generate resume for a job
router.post('/:id/resume',
  aiLimiter,
  [param('id').isInt().withMessage('Invalid job ID')],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)
      if (!job) {
        return res.status(404).json({ error: 'Job not found' })
      }

      const result = await generateResumeForJob(job)
      res.json(result)
    } catch (error) {
      console.error('Error generating resume:', error)
      res.status(500).json({ error: `Failed to generate resume: ${error.message}` })
    }
  }
)

// POST /api/jobs/:id/resume/optimized - Generate 100% match optimized resume
router.post('/:id/resume/optimized',
  aiLimiter,
  [param('id').isInt().withMessage('Invalid job ID')],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)
      if (!job) {
        return res.status(404).json({ error: 'Job not found' })
      }

      const result = await generateOptimizedResume(job)
      res.json(result)
    } catch (error) {
      console.error('Error generating optimized resume:', error)
      res.status(500).json({ error: `Failed to generate optimized resume: ${error.message}` })
    }
  }
)

// POST /api/jobs/:id/cover-letter - Generate cover letter for a job
router.post('/:id/cover-letter',
  aiLimiter,
  [param('id').isInt().withMessage('Invalid job ID')],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)
      if (!job) {
        return res.status(404).json({ error: 'Job not found' })
      }

      const result = await generateCoverLetter(job)
      res.json(result)
    } catch (error) {
      console.error('Error generating cover letter:', error)
      res.status(500).json({ error: 'Failed to generate cover letter' })
    }
  }
)

// POST /api/jobs/compare-resumes - Compare two job resumes head-to-head
router.post('/compare-resumes',
  aiLimiter,
  [
    body('jobId1').isInt().withMessage('Invalid jobId1'),
    body('jobId2').isInt().withMessage('Invalid jobId2')
  ],
  validateInput,
  async (req, res) => {
    try {
      const { jobId1, jobId2 } = req.body
      const userId = req.session.userId

    const job1 = getJobById(parseInt(jobId1), userId)
    const job2 = getJobById(parseInt(jobId2), userId)

    if (!job1 || !job2) {
      return res.status(404).json({ error: 'One or both jobs not found' })
    }

    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    console.log(`🔍 Comparing resumes for: ${job1.title} at ${job1.company} vs ${job2.title} at ${job2.company}`)

    const prompt = `You are a career advisor comparing two job opportunities and their tailored resumes. Analyze these two positions and provide a detailed comparison.

JOB 1:
Title: ${job1.title}
Company: ${job1.company}
Location: ${job1.location || 'Not specified'}
Type: ${job1.type || 'Not specified'}
Salary: ${job1.salary || 'Not specified'}
Summary: ${job1.summary || 'Not provided'}
Key Skills: ${job1.keySkills?.join(', ') || 'Not specified'}
Fit Score: ${job1.fitScore || 0}/100
Fit Reason: ${job1.fitReason || 'Not provided'}

JOB 2:
Title: ${job2.title}
Company: ${job2.company}
Location: ${job2.location || 'Not specified'}
Type: ${job2.type || 'Not specified'}
Salary: ${job2.salary || 'Not specified'}
Summary: ${job2.summary || 'Not provided'}
Key Skills: ${job2.keySkills?.join(', ') || 'Not specified'}
Fit Score: ${job2.fitScore || 0}/100
Fit Reason: ${job2.fitReason || 'Not provided'}

Provide your comparison in this JSON format:
{
  "overview": "<2-3 sentence overview of key differences>",
  "job1Strengths": ["strength1", "strength2", "strength3"],
  "job2Strengths": ["strength1", "strength2", "strength3"],
  "job1Weaknesses": ["weakness1", "weakness2"],
  "job2Weaknesses": ["weakness1", "weakness2"],
  "skillsComparison": {
    "uniqueToJob1": ["skill1", "skill2"],
    "uniqueToJob2": ["skill1", "skill2"],
    "shared": ["skill1", "skill2", "skill3"]
  },
  "careerImpact": {
    "job1": "<how this role impacts career trajectory>",
    "job2": "<how this role impacts career trajectory>"
  },
  "resumeStrategy": {
    "job1": "<what to emphasize in resume for this role>",
    "job2": "<what to emphasize in resume for this role>"
  },
  "recommendation": "<which job seems like better fit and why, or if it depends on priorities>",
  "priority": "<high/medium/low - how critical is the decision>"
}

Be thorough, objective, and actionable. Return ONLY the JSON, no other text.`

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })
    const elapsed = Date.now() - startTime

    console.log(`✅ Comparison complete (${elapsed}ms)`)

    const responseText = message.content[0].text.trim()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Failed to parse comparison response')
    }

    const comparison = JSON.parse(jsonMatch[0])
    comparison.job1 = { id: job1.id, title: job1.title, company: job1.company, fitScore: job1.fitScore }
    comparison.job2 = { id: job2.id, title: job2.title, company: job2.company, fitScore: job2.fitScore }

    res.json(comparison)
  } catch (error) {
    console.error('Error comparing resumes:', error)
    res.status(500).json({ error: error.message || 'Failed to compare resumes' })
  }
})

// POST /api/jobs/:id/reevaluate - Re-evaluate fit score against resume
router.post('/:id/reevaluate',
  aiLimiter,
  [param('id').isInt().withMessage('Invalid job ID')],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)
      if (!job) {
        return res.status(404).json({ error: 'Job not found' })
      }

    const Anthropic = require('@anthropic-ai/sdk')
    const mammoth = require('mammoth')
    const fs = require('fs')
    const path = require('path')

    // Check for and read resume template
    const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')
    let resumeContext = ''

    if (fs.existsSync(templatePath)) {
      try {
        const buffer = fs.readFileSync(templatePath)
        const result = await mammoth.extractRawText({ buffer })
        const resumeText = result.value.trim()

        if (resumeText.length > 0) {
          console.log(`  ✅ Loaded resume content for evaluation (${resumeText.length} characters)`)
          resumeContext = `\n\nCandidate Resume:\n${resumeText}\n\nEvaluate this job against the candidate's actual resume above.`
        }
      } catch (error) {
        console.error('  ⚠️  Failed to read resume:', error.message)
      }
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const jobDescription = `
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Type: ${job.type || 'Not specified'}
Salary: ${job.salary || 'Not specified'}
Summary: ${job.summary || 'Not provided'}
Key Skills: ${job.keySkills?.join(', ') || 'Not specified'}
    `.trim()

    console.log(`🔍 Re-evaluating fit score for: ${job.title} at ${job.company}...`)

    const prompt = `You are a career advisor analyzing job fit. Re-evaluate this job posting and provide an updated fit score and reason.

Job Description:
${jobDescription}
${resumeContext}

Provide your analysis in this JSON format:
{
  "fitScore": <number 0-100>,
  "fitReason": "<1-2 sentence explanation of the fit score>"
}

Be objective and specific in your scoring. Consider:
- Skills match
- Experience level alignment
- Role responsibilities fit
- Career growth potential

Return ONLY the JSON, no other text.`

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
    const elapsed = Date.now() - startTime

    console.log(`✅ Claude API response received (${elapsed}ms)`)

    const responseText = message.content[0].text.trim()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Failed to parse fit evaluation response')
    }

    const evaluation = JSON.parse(jsonMatch[0])

    console.log(`📊 Updated fit score: ${evaluation.fitScore}/100`)

    // Update job with new fit score and reason
    const updated = updateJob(job.id, {
      fitScore: evaluation.fitScore,
      fitReason: evaluation.fitReason
    })

    res.json(updated)
  } catch (error) {
    console.error('Error re-evaluating fit:', error)
    res.status(500).json({ error: error.message || 'Failed to re-evaluate fit' })
  }
})

// POST /api/jobs/:id/gap-analysis - Analyze gaps for 100% fit
router.post('/:id/gap-analysis',
  aiLimiter,
  [param('id').isInt().withMessage('Invalid job ID')],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)
      if (!job) {
        return res.status(404).json({ error: 'Job not found' })
      }

    const Anthropic = require('@anthropic-ai/sdk')
    const mammoth = require('mammoth')
    const fs = require('fs')
    const path = require('path')

    // Check for resume template and extract content
    const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')
    const hasResume = fs.existsSync(templatePath)

    let resumeContent = ''
    if (hasResume) {
      console.log('  📄 Extracting master resume content...')
      const buffer = fs.readFileSync(templatePath)
      const result = await mammoth.extractRawText({ buffer })
      resumeContent = result.value
      console.log(`  ✅ Resume extracted (${resumeContent.length} characters)`)
    }

    // Build a signature over every input that affects the analysis: the position
    // fields and the candidate's resume/skills. If any of these change, the
    // signature changes and the cached analysis is treated as stale.
    const crypto = require('crypto')
    const signature = crypto.createHash('sha256').update(JSON.stringify({
      title: job.title,
      company: job.company,
      location: job.location,
      type: job.type,
      salary: job.salary,
      summary: job.summary,
      keySkills: job.keySkills || [],
      description: job.description,
      fitScore: job.fitScore || 0,
      resume: resumeContent,
    })).digest('hex')

    // Serve from cache unless the caller forced a rerun (?refresh=true) or the
    // inputs changed since the cached analysis was generated.
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1'
    const cached = getGapAnalysisCache(job.id, userId)
    if (!forceRefresh && cached && cached.signature === signature) {
      console.log(`📦 Returning cached gap analysis for job ${job.id} (generated ${cached.createdAt})`)
      return res.json({
        ...cached.analysis,
        _meta: { cached: true, generatedAt: cached.createdAt, stale: false },
      })
    }

    if (cached && cached.signature !== signature) {
      console.log(`♻️  Inputs changed for job ${job.id} — regenerating gap analysis`)
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const jobDescription = `
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Type: ${job.type || 'Not specified'}
Salary: ${job.salary || 'Not specified'}
Summary: ${job.summary || 'Not provided'}
Key Skills: ${job.keySkills?.join(', ') || 'Not specified'}
Description: ${job.description || 'Not provided'}
Current Fit Score: ${job.fitScore || 0}/100
    `.trim()

    console.log(`🔍 Generating gap analysis for: ${job.title} at ${job.company}...`)

    const prompt = hasResume
      ? `You are a career advisor performing a detailed gap analysis. Compare the candidate's resume against the job requirements.

JOB POSTING:
${jobDescription}

CANDIDATE'S MASTER RESUME:
${resumeContent}

Provide your analysis in this JSON format:
{
  "currentScore": ${job.fitScore || 0},
  "targetScore": 100,
  "matchingQualifications": [
    {"requirement": "job requirement 1", "match": "how resume demonstrates this", "strength": "high/medium/low"}
  ],
  "missingSkills": [
    {"skill": "skill name", "importance": "critical/important/nice-to-have", "canLearn": true/false}
  ],
  "experienceGaps": [
    {"gap": "experience gap description", "severity": "high/medium/low", "workaround": "how to address this"}
  ],
  "certifications": ["cert1", "cert2"],
  "recommendations": [
    {"action": "specific action", "impact": "expected improvement", "timeframe": "how long"}
  ],
  "timeline": "<realistic time to close critical gaps>",
  "priority": "high/medium/low",
  "overallAssessment": "<brief summary of candidacy strength>"
}

Be specific and actionable. Focus on:
1. MATCHING QUALIFICATIONS: What from the resume clearly matches the job requirements
2. MISSING SKILLS: What technical/domain skills are required but not evident in the resume
3. EXPERIENCE GAPS: What experience level or domain expertise gaps exist
4. CERTIFICATIONS: Any certifications or qualifications that would strengthen the application
5. RECOMMENDATIONS: Concrete steps to improve match percentage

Return ONLY the JSON, no other text.`
      : `You are a career advisor performing a gap analysis. Since no resume is available, provide a general analysis of what would be needed to match this job.

JOB POSTING:
${jobDescription}

Provide your analysis in this JSON format:
{
  "currentScore": ${job.fitScore || 0},
  "targetScore": 100,
  "matchingQualifications": [],
  "missingSkills": [
    {"skill": "skill name", "importance": "critical/important/nice-to-have", "canLearn": true/false}
  ],
  "experienceGaps": [
    {"gap": "experience gap description", "severity": "high/medium/low", "workaround": "how to address this"}
  ],
  "certifications": ["cert1", "cert2"],
  "recommendations": [
    {"action": "specific action", "impact": "expected improvement", "timeframe": "how long"}
  ],
  "timeline": "<realistic time to close critical gaps>",
  "priority": "high/medium/low",
  "overallAssessment": "No resume available for detailed matching analysis."
}

Return ONLY the JSON, no other text.`

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
    const elapsed = Date.now() - startTime

    console.log(`✅ Claude API response received (${elapsed}ms)`)

    let responseText = message.content[0].text.trim()

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenceMatch) {
      responseText = fenceMatch[1].trim()
    }

    const analysis = extractJsonObject(responseText)

    if (!analysis) {
      console.error('Gap analysis: could not extract valid JSON. Raw response:\n', responseText)
      throw new Error('Failed to parse gap analysis response')
    }

    console.log(`📊 Gap analysis complete:`)
    console.log(`   ✓ Matching qualifications: ${analysis.matchingQualifications?.length || 0}`)
    console.log(`   ✗ Missing skills: ${analysis.missingSkills?.length || 0}`)
    console.log(`   ⚠ Experience gaps: ${analysis.experienceGaps?.length || 0}`)

    // Cache the fresh analysis against the current input signature.
    saveGapAnalysisCache(job.id, userId, signature, analysis)

    res.json({
      ...analysis,
      _meta: { cached: false, generatedAt: new Date().toISOString(), stale: false },
    })
  } catch (error) {
    console.error('Error generating gap analysis:', error)
    res.status(500).json({ error: error.message || 'Failed to generate gap analysis' })
  }
})

// POST /api/jobs/bulk - Bulk process job URLs
router.post('/bulk',
  bulkLimiter,
  [
    body('urls').isArray({ min: 1, max: 50 }).withMessage('URLs must be an array with 1-50 items')
  ],
  validateInput,
  async (req, res) => {
    try {
      const { urls } = req.body
      const userId = req.session.userId

      console.log(`📦 Bulk processing ${urls.length} job URLs...`)

    const results = []
    const errors = []

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim()

      if (!url) continue

      try {
        console.log(`  [${i + 1}/${urls.length}] Processing: ${url}`)

        let content = url
        const isUrl = url.startsWith('http')

        if (isUrl) {
          try {
            const scraped = await scrapeJobUrl(url)
            if (scraped) content = scraped
          } catch (scrapeError) {
            console.warn(`    ⚠️  Scraping failed, using URL only`)
          }
        }

        const parsed = await parseWithClaude(content, isUrl)
        const jobData = {
          ...parsed,
          url: isUrl ? url : null
        }

        const job = createJob(jobData, userId)
        results.push(job)

        console.log(`    ✅ Created: ${job.title} at ${job.company} (Fit: ${job.fitScore})`)

      } catch (error) {
        console.error(`    ❌ Failed: ${error.message}`)
        errors.push({ url, error: error.message })
      }
    }

    console.log(`📊 Bulk processing complete: ${results.length} success, ${errors.length} failed`)

    res.json({
      success: results.length,
      failed: errors.length,
      jobs: results,
      errors
    })
  } catch (error) {
    console.error('Error in bulk processing:', error)
    res.status(500).json({ error: error.message || 'Failed to process bulk URLs' })
  }
})

// GET /api/gap-items - Get all gap items
router.get('/gap-items', (req, res) => {
  try {
    const items = getAllGapItems()
    res.json(items)
  } catch (error) {
    console.error('Error fetching gap items:', error)
    res.status(500).json({ error: 'Failed to fetch gap items' })
  }
})

// GET /api/gap-items/:jobId - Get gap items for a job
router.get('/gap-items/:jobId', (req, res) => {
  try {
    const items = getGapItemsByJob(parseInt(req.params.jobId))
    res.json(items)
  } catch (error) {
    console.error('Error fetching gap items:', error)
    res.status(500).json({ error: 'Failed to fetch gap items' })
  }
})

// POST /api/gap-items - Create gap item
router.post('/gap-items', (req, res) => {
  try {
    const item = createGapItem(req.body)
    res.status(201).json(item)
  } catch (error) {
    console.error('Error creating gap item:', error)
    res.status(500).json({ error: 'Failed to create gap item' })
  }
})

// PUT /api/gap-items/:id - Update gap item
router.put('/gap-items/:id', (req, res) => {
  try {
    const item = updateGapItem(parseInt(req.params.id), req.body)
    res.json(item)
  } catch (error) {
    console.error('Error updating gap item:', error)
    res.status(500).json({ error: 'Failed to update gap item' })
  }
})

// DELETE /api/gap-items/:id - Delete gap item
router.delete('/gap-items/:id', (req, res) => {
  try {
    const deleted = deleteGapItem(parseInt(req.params.id))
    if (!deleted) {
      return res.status(404).json({ error: 'Gap item not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting gap item:', error)
    res.status(500).json({ error: 'Failed to delete gap item' })
  }
})

// POST /api/jobs/:id/action-plan - Generate action plan for gap
router.post('/:id/action-plan', async (req, res) => {
  try {
    const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const { gapDescription, gapType } = req.body

    if (!gapDescription) {
      return res.status(400).json({ error: 'Gap description is required' })
    }

    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    console.log(`💡 Generating action plan for: ${gapDescription}`)

    const prompt = `You are a career development advisor. Create a detailed, actionable plan to close this career gap:

Gap Type: ${gapType || 'skill'}
Gap Description: ${gapDescription}
Target Role: ${job.title} at ${job.company}

Provide a comprehensive action plan in JSON format:
{
  "overview": "<1-2 sentence summary of the approach>",
  "steps": [
    {
      "title": "<step title>",
      "description": "<detailed description>",
      "duration": "<estimated time>",
      "resources": ["<resource 1>", "<resource 2>"]
    }
  ],
  "milestones": [
    {
      "title": "<milestone title>",
      "criteria": "<how to know you've achieved it>"
    }
  ],
  "estimatedTimeline": "<total estimated time>",
  "successMetrics": ["<metric 1>", "<metric 2>"]
}

Be specific, practical, and include real resources (courses, certifications, projects, communities).

Return ONLY the JSON, no other text.`

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })
    const elapsed = Date.now() - startTime

    console.log(`✅ Action plan generated (${elapsed}ms)`)

    const responseText = message.content[0].text.trim()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Failed to parse action plan response')
    }

    const actionPlan = JSON.parse(jsonMatch[0])

    // Save action plan to database
    const saved = createActionPlan({
      jobId: job.id,
      gapItemId: req.body.gapItemId || null,
      prompt: gapDescription,
      response: JSON.stringify(actionPlan)
    })

    res.json({
      ...actionPlan,
      id: saved.id,
      createdAt: saved.createdAt
    })
  } catch (error) {
    console.error('Error generating action plan:', error)
    res.status(500).json({ error: error.message || 'Failed to generate action plan' })
  }
})

// GET /api/jobs/:id/action-plans - Get action plans for a job
router.get('/:id/action-plans', (req, res) => {
  try {
    const plans = getActionPlansByJob(parseInt(req.params.id))
    const parsedPlans = plans.map(p => ({
      ...p,
      response: JSON.parse(p.response)
    }))
    res.json(parsedPlans)
  } catch (error) {
    console.error('Error fetching action plans:', error)
    res.status(500).json({ error: 'Failed to fetch action plans' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS & STATUS TRACKING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/jobs/analytics/overview - Get comprehensive analytics
router.get('/analytics/overview', (req, res) => {
  try {
    const analytics = getApplicationAnalytics()
    res.json(analytics)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// GET /api/jobs/analytics/history - Get all status history
router.get('/analytics/history', (req, res) => {
  try {
    const history = getAllStatusHistory()
    res.json(history)
  } catch (error) {
    console.error('Error fetching status history:', error)
    res.status(500).json({ error: 'Failed to fetch status history' })
  }
})

// GET /api/jobs/analytics/companies - Get top companies
router.get('/analytics/companies', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const companies = getTopCompanies(limit)
    res.json(companies)
  } catch (error) {
    console.error('Error fetching top companies:', error)
    res.status(500).json({ error: 'Failed to fetch top companies' })
  }
})

// GET /api/jobs/analytics/skills - Get top skills
router.get('/analytics/skills', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const skills = getTopSkills(limit)
    res.json(skills)
  } catch (error) {
    console.error('Error fetching top skills:', error)
    res.status(500).json({ error: 'Failed to fetch top skills' })
  }
})

// GET /api/jobs/analytics/trends - Get application trends
router.get('/analytics/trends', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    const trends = getApplicationTrends(days)
    res.json(trends)
  } catch (error) {
    console.error('Error fetching trends:', error)
    res.status(500).json({ error: 'Failed to fetch trends' })
  }
})

// GET /api/jobs/analytics/export - Export all application data
router.get('/analytics/export', (req, res) => {
  try {
    const data = exportApplicationData()

    // Return as JSON by default
    if (req.query.format === 'csv') {
      // Convert to CSV
      const headers = ['ID', 'Company', 'Title', 'Location', 'Type', 'Salary', 'Status', 'Fit Score', 'Skills', 'Saved Date', 'Applied Date', 'Last Contact', 'Created At']
      const rows = data.map(job => [
        job.id,
        job.company,
        job.title,
        job.location || '',
        job.type || '',
        job.salary || '',
        job.status,
        job.fitScore,
        job.skills || '',
        job.savedDate || '',
        job.appliedDate || '',
        job.lastContact || '',
        job.createdAt
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=job-applications.csv')
      res.send(csv)
    } else {
      res.json(data)
    }
  } catch (error) {
    console.error('Error exporting data:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
})

// GET /api/jobs/:id/status-history - Get status history for specific job
router.get('/:id/status-history', (req, res) => {
  try {
    const history = getStatusHistory(parseInt(req.params.id))
    res.json(history)
  } catch (error) {
    console.error('Error fetching job status history:', error)
    res.status(500).json({ error: 'Failed to fetch job status history' })
  }
})

// POST /api/jobs/:id/auto-apply - Auto-apply to job (generate docs, analyze form, fill application)
router.post('/:id/auto-apply', async (req, res) => {
  try {
    const { autoApplyToJob, getDefaultUserData } = require('../auto-apply/auto-applier')
    const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    if (!job.url) {
      return res.status(400).json({ error: 'Job URL is required for auto-apply' })
    }

    console.log(`\n📬 Auto-apply request for: ${job.title} at ${job.company}`)

    // Get user data from request or use defaults
    const userData = req.body.userData || getDefaultUserData()
    const options = {
      autoSubmit: req.body.autoSubmit || false,
      dryRun: req.body.dryRun || false,
      headless: req.body.headless || false,
      fieldMappingOverride: req.body.fieldMapping || null
    }

    // Run auto-apply
    const result = await autoApplyToJob(job, userData, options)

    if (result.success) {
      res.json({
        success: true,
        message: 'Auto-apply completed successfully',
        files: {
          resume: result.files.resume,
          coverLetter: result.files.coverLetter
        },
        formData: result.formData,
        fieldMapping: result.fieldMapping,
        steps: result.steps
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        steps: result.steps
      })
    }
  } catch (error) {
    console.error('Error in auto-apply:', error)
    res.status(500).json({
      error: error.message || 'Failed to auto-apply',
      details: error.stack
    })
  }
})

// POST /api/jobs/:id/auto-apply/preview - Preview auto-apply (generate docs and analyze form only)
router.post('/:id/auto-apply/preview', async (req, res) => {
  try {
    const { autoApplyToJob, getDefaultUserData } = require('../auto-apply/auto-applier')
    const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    if (!job.url) {
      return res.status(400).json({ error: 'Job URL is required for auto-apply preview' })
    }

    const userData = req.body.userData || getDefaultUserData()

    // Run in dry-run mode
    const result = await autoApplyToJob(job, userData, { dryRun: true })

    if (result.success) {
      res.json({
        success: true,
        message: 'Auto-apply preview generated',
        files: {
          resume: result.files.resume,
          coverLetter: result.files.coverLetter
        },
        formData: result.formData,
        fieldMapping: result.fieldMapping,
        estimatedFields: Object.keys(result.fieldMapping || {}).length
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      })
    }
  } catch (error) {
    console.error('Error in auto-apply preview:', error)
    res.status(500).json({
      error: error.message || 'Failed to generate auto-apply preview'
    })
  }
})

// POST /api/jobs/batch-auto-apply - Batch auto-apply to multiple jobs
router.post('/batch-auto-apply', async (req, res) => {
  try {
    const { batchAutoApply } = require('../auto-apply/batch-processor')
    const { getDefaultUserData } = require('../auto-apply/auto-applier')

    const { jobIds, autoSubmit = false, userData } = req.body

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'jobIds array is required' })
    }

    console.log(`\n📬 Batch auto-apply request for ${jobIds.length} jobs`)
    console.log(`  Auto-submit: ${autoSubmit ? '⚠️  ENABLED' : 'Disabled'}`)

    // Run batch processing (this will take a while)
    const result = await batchAutoApply(jobIds, {
      autoSubmit,
      headless: true, // Always headless for batch
      userData: userData || getDefaultUserData()
    })

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error in batch auto-apply:', error)
    res.status(500).json({
      error: error.message || 'Failed to run batch auto-apply',
      details: error.stack
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// Intelligent Agent Auto-Apply Endpoints
// ═══════════════════════════════════════════════════════════════

// POST /api/jobs/:id/agent-apply - Use intelligent agent to auto-apply
router.post('/:id/agent-apply', async (req, res) => {
  try {
    const { AutoApplyAgent } = require('../auto-apply/intelligent-agent')
    const {
      getApplicationAttemptById,
      getApplicationLogs
    } = require('../db/database')
    const { getDefaultUserData } = require('../auto-apply/auto-applier')

    const userId = req.session.userId
      const job = getJobById(parseInt(req.params.id), userId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    if (!job.url) {
      return res.status(400).json({ error: 'Job URL is required for agent auto-apply' })
    }

    // Get settings to use as defaults
    const settings = getSettings()

    const userData = req.body.userData || getDefaultUserData()
    const options = {
      testMode: req.body.testMode !== undefined ? req.body.testMode : (settings.autoApplyMode === 'test'),
      dryRun: req.body.dryRun || false,
      headless: req.body.headless !== undefined ? req.body.headless : (settings.autoApplyHeadless === 1),
      autoSubmit: req.body.autoSubmit !== undefined ? req.body.autoSubmit : (settings.autoApplyAutoSubmit === 1),
      recordVideo: req.body.recordVideo !== undefined ? req.body.recordVideo : (settings.autoApplyRecordVideo === 1)
    }

    console.log(`\n🤖 Intelligent Agent Apply: ${job.title} at ${job.company}`)
    console.log(`  Mode: ${options.testMode ? 'TEST MODE' : options.dryRun ? 'DRY RUN' : options.autoSubmit ? 'AUTO-SUBMIT' : 'REVIEW'}`)
    console.log(`  Video Recording: ${options.recordVideo ? 'ENABLED' : 'DISABLED'}`)
    console.log(`  Headless: ${options.headless ? 'ENABLED' : 'DISABLED'}`)

    // Create and run agent
    const agent = new AutoApplyAgent(job, userData, options)
    const result = await agent.execute()

    // Return comprehensive report
    res.json({
      success: true,
      ...result
    })

  } catch (error) {
    console.error('Error in agent auto-apply:', error)
    res.status(500).json({
      error: error.message || 'Agent auto-apply failed',
      details: error.stack
    })
  }
})

// GET /api/jobs/:id/application-attempts - Get all application attempts for a job
router.get('/:id/application-attempts', (req, res) => {
  try {
    const { getApplicationAttempts } = require('../db/database')
    const jobId = parseInt(req.params.id)
    const attempts = getApplicationAttempts(jobId)

    // Parse JSON fields
    attempts.forEach(attempt => {
      if (attempt.formAnalysis) attempt.formAnalysis = JSON.parse(attempt.formAnalysis)
      if (attempt.logs) attempt.logs = JSON.parse(attempt.logs)
      if (attempt.metadata) attempt.metadata = JSON.parse(attempt.metadata)
    })

    res.json({ attempts })
  } catch (error) {
    console.error('Error fetching application attempts:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/jobs/application-attempts/:attemptId - Get specific application attempt details
router.get('/application-attempts/:attemptId', (req, res) => {
  try {
    const {
      getApplicationAttemptById,
      getApplicationLogs
    } = require('../db/database')

    const attemptId = parseInt(req.params.attemptId)
    const attempt = getApplicationAttemptById(attemptId)

    if (!attempt) {
      return res.status(404).json({ error: 'Application attempt not found' })
    }

    // Parse JSON fields
    if (attempt.formAnalysis) attempt.formAnalysis = JSON.parse(attempt.formAnalysis)
    if (attempt.logs) attempt.logs = JSON.parse(attempt.logs)
    if (attempt.metadata) attempt.metadata = JSON.parse(attempt.metadata)

    // Get detailed logs
    const logs = getApplicationLogs(attemptId)
    logs.forEach(log => {
      if (log.data) log.data = JSON.parse(log.data)
    })

    res.json({
      attempt,
      logs
    })
  } catch (error) {
    console.error('Error fetching application attempt:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/jobs/agent-sessions/active - Get all active agent sessions
router.get('/agent-sessions/active', (req, res) => {
  try {
    const { getActiveAgentSessions } = require('../db/database')
    const sessions = getActiveAgentSessions()

    // Parse JSON fields
    sessions.forEach(session => {
      if (session.context) session.context = JSON.parse(session.context)
      if (session.decisions) session.decisions = JSON.parse(session.decisions)
    })

    res.json({ sessions })
  } catch (error) {
    console.error('Error fetching active sessions:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/jobs/application-stats - Get application statistics
router.get('/application-stats', (req, res) => {
  try {
    const { getApplicationStats, getRecentApplicationAttempts } = require('../db/database')

    const stats = getApplicationStats()
    const recentAttempts = getRecentApplicationAttempts(5)

    // Parse JSON fields in recent attempts
    recentAttempts.forEach(attempt => {
      if (attempt.metadata) attempt.metadata = JSON.parse(attempt.metadata)
    })

    res.json({
      stats,
      recentAttempts
    })
  } catch (error) {
    console.error('Error fetching application stats:', error)
    res.status(500).json({ error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// Document Management Endpoints
// ═══════════════════════════════════════════════════════════════

// GET /api/jobs/:id/documents - Get all documents for a job
router.get('/:id/documents', (req, res) => {
  try {
    const userId = req.session.userId
    const jobId = parseInt(req.params.id)
    const job = getJobById(jobId, userId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const stats = getDocumentStats(jobId)
    const resumes = getResumeGenerations(jobId)
    const coverLetters = getCoverLetterGenerations(jobId)

    res.json({
      job: {
        id: job.id,
        title: job.title,
        company: job.company
      },
      stats,
      resumes,
      coverLetters
    })
  } catch (error) {
    console.error('Error getting documents:', error)
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/jobs/:id/documents/resume/:versionId - Delete a resume version
router.delete('/:id/documents/resume/:versionId', (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId)
    const deleted = deleteResumeVersion(versionId)

    if (!deleted) {
      return res.status(404).json({ error: 'Resume version not found' })
    }

    res.json({ success: true, message: 'Resume version deleted' })
  } catch (error) {
    console.error('Error deleting resume version:', error)
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/jobs/:id/documents/cover-letter/:versionId - Delete a cover letter version
router.delete('/:id/documents/cover-letter/:versionId', (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId)
    const deleted = deleteCoverLetterVersion(versionId)

    if (!deleted) {
      return res.status(404).json({ error: 'Cover letter version not found' })
    }

    res.json({ success: true, message: 'Cover letter version deleted' })
  } catch (error) {
    console.error('Error deleting cover letter version:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/documents/preview?path=... - Preview a document as HTML

// POST /api/documents/locate - Reveal file in Finder/Explorer
router.post('/documents/locate', (req, res) => {
  try {
    const { filePath } = req.body
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' })
    }

    const { spawn } = require('child_process')
    const fs = require('fs')

    // Prevent path traversal attacks
    if (filePath.includes('..') || filePath.includes('\0') || path.isAbsolute(filePath)) {
      console.warn(`⚠️  Path traversal attempt in locate: ${filePath}`)
      return res.status(400).json({ error: 'Invalid file path' })
    }

    // Construct full path from public directory and validate
    const publicDir = path.resolve(path.join(__dirname, '../../public'))
    const fullPath = path.resolve(path.join(publicDir, filePath))

    // Ensure the resolved path is still within the public directory
    if (!fullPath.startsWith(publicDir)) {
      console.warn(`⚠️  Path traversal blocked in locate: ${filePath}`)
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Open file location based on platform using spawn (prevents command injection)
    const platform = process.platform
    let command, args

    if (platform === 'darwin') {
      // macOS - reveal in Finder
      command = 'open'
      args = ['-R', fullPath]
    } else if (platform === 'win32') {
      // Windows - reveal in Explorer
      command = 'explorer'
      args = ['/select,', fullPath]
    } else {
      // Linux - open parent directory
      command = 'xdg-open'
      args = [path.dirname(fullPath)]
    }

    const child = spawn(command, args)

    child.on('error', (error) => {
      console.error('Error locating file:', error)
      return res.status(500).json({ error: 'Failed to locate file' })
    })

    child.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, message: 'File revealed in system explorer' })
      } else {
        console.error(`Locate command exited with code ${code}`)
        res.status(500).json({ error: 'Failed to locate file' })
      }
    })
  } catch (error) {
    console.error('Error in locate endpoint:', error)
    res.status(500).json({ error: 'Failed to locate file' })
  }
})

// ═══════════════════════════════════════════════════════════════
// Settings Management Endpoints
// ═══════════════════════════════════════════════════════════════

// GET /api/settings - Get application settings
router.get('/settings', (req, res) => {
  try {
    const settings = getSettings()
    res.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/settings - Update application settings
router.put('/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body)
    console.log('✅ Settings updated:')
    console.log(`  Auto-apply mode: ${updated.autoApplyMode.toUpperCase()}`)
    console.log(`  Video recording: ${updated.autoApplyRecordVideo ? 'ENABLED' : 'DISABLED'}`)
    console.log(`  Headless mode: ${updated.autoApplyHeadless ? 'ENABLED' : 'DISABLED'}`)
    console.log(`  Auto-submit: ${updated.autoApplyAutoSubmit ? 'ENABLED' : 'DISABLED'}`)

    res.json({
      success: true,
      settings: updated
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
