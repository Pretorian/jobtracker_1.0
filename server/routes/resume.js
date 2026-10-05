const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const sanitizeFilename = require('sanitize-filename')
const rateLimit = require('express-rate-limit')

const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')

// Rate limiter for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many AI requests, please try again later.' }
})

// Rate limiter for file upload
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many file uploads, please try again later.' }
})

// Configure multer for file upload with enhanced security
const upload = multer({
  dest: path.join(__dirname, '../../data/tmp'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Strict MIME type checking
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Additional check: ensure filename ends with .docx
      if (!file.originalname.toLowerCase().endsWith('.docx')) {
        return cb(new Error('File extension must be .docx'))
      }
      // Sanitize the filename
      file.originalname = sanitizeFilename(file.originalname)
      cb(null, true)
    } else {
      cb(new Error('Only .docx files are allowed'))
    }
  }
})

// GET /api/resume/template - Get master resume template info
router.get('/template', (req, res) => {
  try {
    if (!fs.existsSync(templatePath)) {
      return res.json({
        exists: false,
        message: 'Master resume template not found',
        path: templatePath,
      })
    }

    const stats = fs.statSync(templatePath)
    res.json({
      exists: true,
      path: templatePath,
      size: stats.size,
      sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
      lastModified: stats.mtime,
      downloadUrl: '/api/resume/template/download',
    })
  } catch (error) {
    console.error('Error checking template:', error)
    res.status(500).json({ error: 'Failed to check template' })
  }
})

// GET /api/resume/template/download - Download master resume template
router.get('/template/download', (req, res) => {
  try {
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' })
    }

    console.log(`📥 Downloading master resume template`)
    res.download(templatePath, 'master-resume-template.docx')
  } catch (error) {
    console.error('Error downloading template:', error)
    res.status(500).json({ error: 'Failed to download template' })
  }
})

// POST /api/resume/template/upload - Upload new master resume template
router.post('/template/upload', uploadLimiter, upload.single('template'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    console.log(`\n📤 Uploading new master resume template`)
    console.log(`  📄 Original name: ${req.file.originalname}`)
    console.log(`  📊 Size: ${(req.file.size / 1024).toFixed(2)} KB`)

    // Ensure data directory exists
    const dataDir = path.dirname(templatePath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Backup existing template if it exists
    if (fs.existsSync(templatePath)) {
      const backupPath = templatePath.replace('.docx', `.backup.${Date.now()}.docx`)
      fs.copyFileSync(templatePath, backupPath)
      console.log(`  💾 Backed up existing template to: ${path.basename(backupPath)}`)
    }

    // Move uploaded file to template path
    fs.renameSync(req.file.path, templatePath)
    console.log(`  ✅ Template updated successfully\n`)

    // Clean up tmp directory
    const tmpDir = path.dirname(req.file.path)
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }

    res.json({
      success: true,
      message: 'Template uploaded successfully',
      filename: sanitizeFilename(req.file.originalname),
      size: req.file.size,
    })
  } catch (error) {
    console.error('❌ Error uploading template:', error)
    // Clean up the uploaded file if something went wrong
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ error: 'Failed to upload template' })
  }
})

// DELETE /api/resume/template - Delete master resume template
router.delete('/template', (req, res) => {
  try {
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Backup before deleting
    const backupPath = templatePath.replace('.docx', `.deleted.${Date.now()}.docx`)
    fs.copyFileSync(templatePath, backupPath)
    fs.unlinkSync(templatePath)

    console.log(`🗑️  Template deleted (backup saved: ${path.basename(backupPath)})`)

    res.json({
      success: true,
      message: 'Template deleted',
      backupPath: path.basename(backupPath),
    })
  } catch (error) {
    console.error('Error deleting template:', error)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// POST /api/resume/suggest-roles - Suggest 100% match roles for master resume
router.post('/suggest-roles', aiLimiter, async (req, res) => {
  try {
    // Check for resume template
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Master resume template not found' })
    }

    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    console.log(`🎯 Analyzing master resume to suggest ideal roles...`)

    // For now, we'll analyze based on the jobs in the system
    // In a full implementation, you could parse the actual resume document
    const { getAllJobs } = require('../db/database')
    const jobs = getAllJobs()

    // Aggregate data from existing jobs to understand the user's background
    const allSkills = [...new Set(jobs.flatMap(j => j.keySkills || []))]
    const highFitJobs = jobs.filter(j => (j.fitScore || 0) >= 70)

    const backgroundContext = highFitJobs.length > 0
      ? `Based on high-fit job matches (${highFitJobs.length} jobs with 70+ fit score), the user has shown interest in roles like: ${highFitJobs.slice(0, 5).map(j => j.title).join(', ')}`
      : 'Analyzing resume for potential career opportunities'

    const prompt = `You are a career advisor analyzing a professional's background to suggest ideal job roles that would be a 100% match.

CONTEXT:
${backgroundContext}

SKILLS DEMONSTRATED:
${allSkills.slice(0, 30).join(', ')}

TASK:
Suggest 5-8 specific job roles that would be perfect matches for this professional. For each role, explain why it's an ideal fit and what makes it a 100% match.

Provide your suggestions in this JSON format:
{
  "profileSummary": "<2-3 sentence summary of the professional's strengths and career stage>",
  "idealRoles": [
    {
      "title": "<specific job title>",
      "level": "<entry/mid/senior/lead/executive>",
      "industries": ["industry1", "industry2"],
      "whyPerfectFit": "<why this is 100% match - 2-3 sentences>",
      "keyResponsibilities": ["responsibility1", "responsibility2", "responsibility3"],
      "targetCompanies": ["type of company 1", "type of company 2"],
      "salaryRange": "<typical salary range for this role>",
      "growthPotential": "<career growth trajectory from this role>"
    }
  ],
  "careerPaths": [
    {
      "path": "<career path name>",
      "description": "<how to progress in this direction>",
      "timeline": "<typical timeline>"
    }
  ],
  "skillsToHighlight": ["skill1", "skill2", "skill3"],
  "marketDemand": "<overall assessment of market demand for these roles>"
}

Be specific, realistic, and actionable. Focus on roles where the professional would truly excel. Return ONLY the JSON, no other text.`

    const startTime = Date.now()
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
    const elapsed = Date.now() - startTime

    console.log(`✅ Role suggestions generated (${elapsed}ms)`)

    const responseText = message.content[0].text.trim()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Failed to parse role suggestions response')
    }

    const suggestions = JSON.parse(jsonMatch[0])

    res.json(suggestions)
  } catch (error) {
    console.error('Error generating role suggestions:', error)
    res.status(500).json({ error: error.message || 'Failed to generate role suggestions' })
  }
})

module.exports = router
