const Anthropic = require('@anthropic-ai/sdk')
const { generateResumeForJob } = require('../resume/generator')
const { generateCoverLetter } = require('../cover-letter/generator')
const { v4: uuidv4 } = require('uuid')
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder')

const dbPath = process.env.JOBS_DB_PATH || path.join(__dirname, '../../data/jobs.db')

/**
 * Intelligent Agent for Automated Job Applications
 * Uses AI to make decisions, handle different workflows, and report progress
 */
class AutoApplyAgent {
  constructor(job, userData, options = {}) {
    this.job = job
    this.userData = userData
    this.options = options
    this.sessionId = uuidv4()
    if (process.env.JOBS_DB_PATH) {
      // In test environments, reuse the shared database.js connection so
      // foreign-key visibility is consistent across the codebase.
      // eslint-disable-next-line global-require
      this.db = require('../db/database').db
    } else {
      this.db = new Database(dbPath)
    }
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // Initialize tracking
    this.attemptId = null
    this.currentStep = 'initializing'
    this.progress = 0
    this.totalSteps = 5
    this.logs = []
    this.decisions = []
    this.tokensUsed = 0
    this.apiCalls = 0
    this.startTime = Date.now()

    // Video recording
    this.recorder = null
    this.videoPath = null
    this.videoStartTime = null

    // Test mode tracking
    this.fieldsAnalysis = []
    this.testModeReport = null
  }

  /**
   * Main execution method
   */
  async execute() {
    try {
      // Create agent session
      this.createSession()

      // Create application attempt
      this.attemptId = this.createAttempt()

      this.log('info', 'initialization', `🤖 Agent started for ${this.job.title} at ${this.job.company}`)

      // Step 1: Generate documents
      await this.generateDocuments()

      // Step 2: Analyze application platform
      await this.analyzeApplicationPlatform()

      // Step 3: Generate application strategy
      await this.generateApplicationStrategy()

      // Step 4: Execute application
      if (!this.options.dryRun) {
        await this.executeApplication()
      } else {
        this.log('info', 'execution', '⏸️  Dry run mode - skipping application execution')
      }

      // Step 5: Report results
      const results = this.generateReport()

      this.completeAttempt(true)
      this.updateSession('completed')

      return results
    } catch (error) {
      this.log('error', 'execution', `❌ Agent failed: ${error.message}`, { stack: error.stack })
      this.completeAttempt(false, error.message)
      this.updateSession('failed')
      throw error
    }
  }

  /**
   * Step 1: Generate tailored resume and cover letter
   */
  async generateDocuments() {
    this.updateProgress('generating_documents', 1)
    this.log('info', 'documents', '📄 Generating tailored documents...')

    try {
      // Generate resume
      this.log('info', 'documents', '  → Generating resume...')
      const resumeResult = await generateResumeForJob(this.job)
      this.resumePath = resumeResult.filePath
      this.log('success', 'documents', `  ✅ Resume: ${path.basename(resumeResult.filePath)}`)

      // Generate cover letter
      this.log('info', 'documents', '  → Generating cover letter...')
      const coverLetterResult = await generateCoverLetter(this.job)
      this.coverLetterPath = coverLetterResult.filePath
      this.log('success', 'documents', `  ✅ Cover Letter: ${path.basename(coverLetterResult.filePath)}`)

      // Update attempt
      this.db.prepare(`
        UPDATE application_attempts
        SET resumePath = ?, coverLetterPath = ?
        WHERE id = ?
      `).run(this.resumePath, this.coverLetterPath, this.attemptId)

    } catch (error) {
      this.log('error', 'documents', `Failed to generate documents: ${error.message}`)
      throw error
    }
  }

  /**
   * Step 2: AI analyzes the application platform and requirements
   */
  async analyzeApplicationPlatform() {
    this.updateProgress('analyzing_platform', 2)
    this.log('info', 'analysis', '🔍 Analyzing application platform...')

    const prompt = `You are analyzing a job application URL to determine the application platform and strategy.

JOB DETAILS:
- Title: ${this.job.title}
- Company: ${this.job.company}
- URL: ${this.job.url}
- Description: ${this.job.description || 'Not provided'}

TASK:
Analyze the URL and job details to determine:
1. What application platform is being used (e.g., LinkedIn, Greenhouse, Lever, company ATS, direct email, etc.)
2. What type of application process is likely required
3. What documents or information will be needed
4. Any special considerations or challenges

Provide your analysis in this JSON format:
{
  "platform": "<platform name>",
  "platformType": "ats|linkedin|email|direct|unknown",
  "estimatedComplexity": "simple|moderate|complex",
  "requiredDocuments": ["resume", "cover_letter", etc],
  "likelyFields": ["name", "email", "phone", etc],
  "specialConsiderations": ["consideration1", "consideration2"],
  "recommendedStrategy": "<brief description of recommended approach>",
  "confidence": "high|medium|low"
}

Return ONLY the JSON, no other text.`

    try {
      this.apiCalls++
      const message = await this.client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })

      this.tokensUsed += message.usage?.input_tokens || 0
      this.tokensUsed += message.usage?.output_tokens || 0

      const responseText = message.content[0].text.trim()
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('Failed to parse platform analysis')
      }

      this.platformAnalysis = JSON.parse(jsonMatch[0])

      this.log('success', 'analysis', `  Platform: ${this.platformAnalysis.platform}`)
      this.log('success', 'analysis', `  Complexity: ${this.platformAnalysis.estimatedComplexity}`)
      this.log('success', 'analysis', `  Strategy: ${this.platformAnalysis.recommendedStrategy}`)

      this.decisions.push({
        step: 'platform_analysis',
        decision: this.platformAnalysis.recommendedStrategy,
        confidence: this.platformAnalysis.confidence
      })

    } catch (error) {
      this.log('error', 'analysis', `Failed to analyze platform: ${error.message}`)
      // Fallback to basic analysis
      this.platformAnalysis = {
        platform: 'unknown',
        platformType: 'unknown',
        estimatedComplexity: 'moderate',
        requiredDocuments: ['resume', 'cover_letter'],
        recommendedStrategy: 'Manual browser-based application',
        confidence: 'low'
      }
    }
  }

  /**
   * Step 3: Generate application strategy using AI
   */
  async generateApplicationStrategy() {
    this.updateProgress('generating_strategy', 3)
    this.log('info', 'strategy', '🎯 Generating application strategy...')

    const prompt = `You are a job application automation expert. Generate a detailed strategy for applying to this job.

JOB DETAILS:
- Title: ${this.job.title}
- Company: ${this.job.company}
- URL: ${this.job.url}

PLATFORM ANALYSIS:
${JSON.stringify(this.platformAnalysis, null, 2)}

AVAILABLE RESOURCES:
- Resume: ${this.resumePath ? 'Generated' : 'Not available'}
- Cover Letter: ${this.coverLetterPath ? 'Generated' : 'Not available'}
- User Data: ${JSON.stringify(this.userData, null, 2)}

TASK:
Create a step-by-step strategy for successfully applying to this job. Consider:
1. How to navigate to the application
2. What information to fill in each step
3. How to handle common obstacles (sign-ups, assessments, etc.)
4. Quality checks before submission

Provide your strategy in this JSON format:
{
  "steps": [
    {
      "step": 1,
      "action": "<action name>",
      "description": "<what to do>",
      "type": "navigate|fill_form|upload|submit|wait",
      "data": {<any data needed for this step>},
      "fallback": "<what to do if this fails>"
    }
  ],
  "estimatedTime": "<time estimate>",
  "riskLevel": "low|medium|high",
  "successProbability": "high|medium|low",
  "recommendations": ["rec1", "rec2"]
}

Return ONLY the JSON, no other text.`

    try {
      this.apiCalls++
      const message = await this.client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })

      this.tokensUsed += message.usage?.input_tokens || 0
      this.tokensUsed += message.usage?.output_tokens || 0

      const responseText = message.content[0].text.trim()
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('Failed to parse application strategy')
      }

      this.strategy = JSON.parse(jsonMatch[0])

      this.log('success', 'strategy', `  Generated ${this.strategy.steps.length} step strategy`)
      this.log('success', 'strategy', `  Estimated time: ${this.strategy.estimatedTime}`)
      this.log('success', 'strategy', `  Success probability: ${this.strategy.successProbability}`)

      this.decisions.push({
        step: 'strategy_generation',
        decision: `${this.strategy.steps.length} steps, ${this.strategy.riskLevel} risk`,
        confidence: this.strategy.successProbability
      })

    } catch (error) {
      this.log('error', 'strategy', `Failed to generate strategy: ${error.message}`)
      throw error
    }
  }

  /**
   * Step 4: Execute the application strategy
   * Supports TEST MODE (analyze only) and LIVE MODE (with video recording)
   */
  async executeApplication() {
    this.updateProgress('executing_application', 4)

    // TEST MODE: Analyze form and log what would be done
    if (this.options.testMode) {
      return await this.executeTestMode()
    }

    // LIVE MODE: Actually apply with optional video recording
    return await this.executeLiveMode()
  }

  /**
   * TEST MODE: Analyze the application form without filling it
   */
  async executeTestMode() {
    this.log('info', 'test_mode', '🧪 TEST MODE: Analyzing application form...')

    const puppeteer = require('puppeteer')
    let browser = null
    let videoRecorder = null

    try {
      // Launch browser for analysis
      browser = await puppeteer.launch({
        headless: false, // Show browser in test mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setViewport({ width: 1920, height: 1080 })

      // Start video recording if requested
      if (this.options.recordVideo) {
        await this.startVideoRecording(page)
      }

      // Navigate to job URL
      this.log('info', 'test_mode', `  → Navigating to ${this.job.url}`)
      await page.goto(this.job.url, { waitUntil: 'networkidle2', timeout: 60000 })
      await page.waitForTimeout(2000) // Wait for page to fully load

      // Analyze all form fields on the page
      this.log('info', 'test_mode', '  → Analyzing form fields...')
      const fields = await page.evaluate(() => {
        const allFields = []

        // Get all input fields
        document.querySelectorAll('input, textarea, select').forEach((field, index) => {
          allFields.push({
            index: index + 1,
            type: field.tagName.toLowerCase(),
            inputType: field.type || 'text',
            name: field.name || '',
            id: field.id || '',
            placeholder: field.placeholder || '',
            label: field.labels?.[0]?.textContent?.trim() || '',
            required: field.required || field.hasAttribute('required'),
            value: field.value || '',
            selector: field.id ? `#${field.id}` : field.name ? `[name="${field.name}"]` : ''
          })
        })

        return allFields
      })

      this.log('success', 'test_mode', `  ✅ Found ${fields.length} form fields`)

      // Use AI to determine what value should go in each field
      this.log('info', 'test_mode', '  → Using AI to determine field values...')
      const fieldAnalysis = await this.analyzeFieldsWithAI(fields)

      this.fieldsAnalysis = fieldAnalysis

      // Log each field and what would be filled
      this.log('info', 'test_mode', '\n  📋 FIELD ANALYSIS:')
      fieldAnalysis.forEach((field, i) => {
        this.log('info', 'test_mode', `\n  Field ${i + 1}:`)
        this.log('info', 'test_mode', `    Label: ${field.label || field.placeholder || field.name}`)
        this.log('info', 'test_mode', `    Type: ${field.inputType}`)
        this.log('info', 'test_mode', `    Required: ${field.required ? 'Yes' : 'No'}`)
        this.log('info', 'test_mode', `    Would fill with: ${field.suggestedValue || '(empty)'}`)
        this.log('info', 'test_mode', `    Reason: ${field.reason}`)
      })

      // Look for file upload fields
      const uploadFields = fields.filter(f => f.inputType === 'file')
      if (uploadFields.length > 0) {
        this.log('info', 'test_mode', `\n  📎 UPLOAD FIELDS:`)
        uploadFields.forEach((field, i) => {
          this.log('info', 'test_mode', `\n  Upload ${i + 1}:`)
          this.log('info', 'test_mode', `    Label: ${field.label || 'Resume/Document'}`)
          this.log('info', 'test_mode', `    Would upload: ${field.label.toLowerCase().includes('resume') ? this.resumePath : this.coverLetterPath}`)
        })
      }

      // Stop video recording
      if (this.options.recordVideo) {
        await this.stopVideoRecording()
      }

      // Store results in database
      this.db.prepare(`
        UPDATE application_attempts
        SET
          totalFields = ?,
          fieldsAnalysis = ?
        WHERE id = ?
      `).run(
        fields.length,
        JSON.stringify(fieldAnalysis),
        this.attemptId
      )

      this.testModeReport = {
        totalFields: fields.length,
        requiredFields: fields.filter(f => f.required).length,
        uploadFields: uploadFields.length,
        fieldsAnalysis: fieldAnalysis
      }

      this.log('success', 'test_mode', `\n  ✅ Test mode complete - No fields were actually filled`)

      await browser.close()

      return {
        testMode: true,
        analyzed: true,
        ...this.testModeReport
      }

    } catch (error) {
      this.log('error', 'test_mode', `Test mode failed: ${error.message}`)
      if (browser) await browser.close()
      throw error
    }
  }

  /**
   * LIVE MODE: Actually fill and submit the application with video recording
   */
  async executeLiveMode() {
    this.log('info', 'live_mode', '🚀 LIVE MODE: Applying to job...')

    const puppeteer = require('puppeteer')
    let browser = null

    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: this.options.headless || false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()
      await page.setViewport({ width: 1920, height: 1080 })

      // Start video recording if requested
      if (this.options.recordVideo) {
        await this.startVideoRecording(page)
      }

      // Use existing auto-applier logic
      const { autoApplyToJob } = require('./auto-applier')

      const result = await autoApplyToJob(this.job, this.userData, {
        ...this.options,
        dryRun: false
      })

      this.executionResult = result

      // Stop video recording
      if (this.options.recordVideo) {
        await this.stopVideoRecording()
      }

      // Update database
      this.db.prepare(`
        UPDATE application_attempts
        SET
          fieldsFilled = ?,
          totalFields = ?,
          formAnalysis = ?,
          submitted = ?
        WHERE id = ?
      `).run(
        result.fieldMapping ? Object.keys(result.fieldMapping).length : 0,
        result.formData ? result.formData.fields.length : 0,
        result.formData ? JSON.stringify(result.formData) : null,
        result.submitted ? 1 : 0,
        this.attemptId
      )

      this.log('success', 'live_mode', `  ✅ Application ${result.submitted ? 'submitted' : 'filled (awaiting review)'}`)

      await browser.close()

      return result

    } catch (error) {
      this.log('error', 'live_mode', `Live application failed: ${error.message}`)
      if (browser) await browser.close()
      throw error
    }
  }

  /**
   * Use AI to analyze fields and determine what values should be filled
   */
  async analyzeFieldsWithAI(fields) {
    const prompt = `You are analyzing form fields for a job application. For each field, determine what value should be filled based on the field information and user data.

USER DATA:
${JSON.stringify(this.userData, null, 2)}

JOB:
- Title: ${this.job.title}
- Company: ${this.job.company}

FORM FIELDS:
${JSON.stringify(fields.map((f, i) => ({
  index: i + 1,
  label: f.label || f.placeholder || f.name,
  type: f.inputType,
  required: f.required
})), null, 2)}

For each field, provide:
1. The suggested value to fill
2. A brief reason why

Return as JSON array:
[
  {
    "fieldIndex": 1,
    "suggestedValue": "value here",
    "reason": "why this value",
    "confidence": "high|medium|low"
  }
]

Return ONLY the JSON array, no other text.`

    try {
      this.apiCalls++
      const message = await this.client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })

      this.tokensUsed += message.usage?.input_tokens || 0
      this.tokensUsed += message.usage?.output_tokens || 0

      const responseText = message.content[0].text.trim()
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)

      if (!jsonMatch) {
        throw new Error('Failed to parse field analysis')
      }

      const analysis = JSON.parse(jsonMatch[0])

      // Merge analysis with original fields
      return fields.map((field, i) => {
        const aiAnalysis = analysis.find(a => a.fieldIndex === i + 1) || {}
        return {
          ...field,
          suggestedValue: aiAnalysis.suggestedValue || '',
          reason: aiAnalysis.reason || 'No analysis available',
          confidence: aiAnalysis.confidence || 'low'
        }
      })

    } catch (error) {
      this.log('warning', 'test_mode', `AI field analysis failed: ${error.message}`)
      // Return fields without AI analysis
      return fields.map(field => ({
        ...field,
        suggestedValue: '',
        reason: 'AI analysis unavailable',
        confidence: 'low'
      }))
    }
  }

  /**
   * Start video recording
   */
  async startVideoRecording(page) {
    try {
      // Create recordings directory
      const recordingsDir = path.join(__dirname, '../../public/recordings')
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true })
      }

      // Generate video filename
      const timestamp = Date.now()
      const safeCompany = this.job.company.replace(/[^a-z0-9]/gi, '_')
      const safeRole = this.job.title.replace(/[^a-z0-9]/gi, '_')
      const filename = `apply_${safeCompany}_${safeRole}_${timestamp}.mp4`
      const fullPath = path.join(recordingsDir, filename)

      this.videoPath = `/recordings/${filename}`
      this.videoStartTime = Date.now()

      // Start recording
      this.recorder = new PuppeteerScreenRecorder(page, {
        followNewTab: true,
        fps: 30,
        videoFrame: {
          width: 1920,
          height: 1080
        },
        aspectRatio: '16:9'
      })

      await this.recorder.start(fullPath)

      this.log('success', 'video', `  🎥 Recording started: ${filename}`)

    } catch (error) {
      this.log('warning', 'video', `Failed to start recording: ${error.message}`)
    }
  }

  /**
   * Stop video recording and save
   */
  async stopVideoRecording() {
    if (!this.recorder) return

    try {
      await this.recorder.stop()

      const videoDuration = Date.now() - this.videoStartTime

      // Get video file size
      const fullPath = path.join(__dirname, '../../public', this.videoPath)
      const stats = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null
      const videoSize = stats ? stats.size : null

      // Update database
      this.db.prepare(`
        UPDATE application_attempts
        SET videoPath = ?, videoDuration = ?, videoSize = ?
        WHERE id = ?
      `).run(this.videoPath, videoDuration, videoSize, this.attemptId)

      this.log('success', 'video', `  ✅ Recording saved: ${this.videoPath}`)
      this.log('success', 'video', `  Duration: ${(videoDuration / 1000).toFixed(1)}s, Size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`)

    } catch (error) {
      this.log('warning', 'video', `Failed to stop recording: ${error.message}`)
    }
  }

  /**
   * Generate final report
   */
  generateReport() {
    this.updateProgress('generating_report', 5)

    const duration = Date.now() - this.startTime

    const report = {
      success: true,
      sessionId: this.sessionId,
      attemptId: this.attemptId,
      mode: this.options.testMode ? 'test' : 'live',
      job: {
        id: this.job.id,
        title: this.job.title,
        company: this.job.company
      },
      documents: {
        resume: this.resumePath,
        coverLetter: this.coverLetterPath
      },
      platform: this.platformAnalysis,
      strategy: this.strategy,
      execution: this.executionResult,
      video: this.videoPath ? {
        path: this.videoPath,
        url: `http://localhost:${process.env.PORT || 4001}${this.videoPath}`,
        duration: this.videoStartTime ? Date.now() - this.videoStartTime : null
      } : null,
      testMode: this.options.testMode ? {
        report: this.testModeReport,
        fieldsAnalysis: this.fieldsAnalysis
      } : null,
      metadata: {
        duration,
        tokensUsed: this.tokensUsed,
        apiCalls: this.apiCalls,
        decisions: this.decisions,
        logs: this.logs
      }
    }

    if (this.options.testMode) {
      this.log('success', 'report', `🧪 Test mode complete in ${(duration / 1000).toFixed(1)}s`)
      if (this.videoPath) {
        this.log('success', 'report', `🎥 Test recording saved: ${this.videoPath}`)
      }
    } else {
      this.log('success', 'report', `📊 Application complete in ${(duration / 1000).toFixed(1)}s`)
      if (this.videoPath) {
        this.log('success', 'report', `🎥 Recording saved: ${this.videoPath}`)
      }
    }

    return report
  }

  /**
   * Database and tracking methods
   */
  createSession() {
    this.db.prepare(`
      INSERT INTO agent_sessions (id, jobId, status, currentAction)
      VALUES (?, ?, ?, ?)
    `).run(this.sessionId, this.job.id, 'running', 'initializing')
  }

  updateSession(status) {
    this.db.prepare(`
      UPDATE agent_sessions
      SET
        status = ?,
        updatedAt = CURRENT_TIMESTAMP,
        currentAction = ?,
        context = ?,
        decisions = ?,
        tokensUsed = ?,
        apiCalls = ?,
        duration = ?
      WHERE id = ?
    `).run(
      status,
      this.currentStep,
      JSON.stringify(this.platformAnalysis || {}),
      JSON.stringify(this.decisions),
      this.tokensUsed,
      this.apiCalls,
      Date.now() - this.startTime,
      this.sessionId
    )
  }

  createAttempt() {
    const result = this.db.prepare(`
      INSERT INTO application_attempts (
        jobId, status, agentSessionId, currentStep, progress, totalSteps
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      this.job.id,
      'in_progress',
      this.sessionId,
      this.currentStep,
      this.progress,
      this.totalSteps
    )

    return result.lastInsertRowid
  }

  updateProgress(step, progress) {
    this.currentStep = step
    this.progress = progress

    if (this.attemptId) {
      this.db.prepare(`
        UPDATE application_attempts
        SET currentStep = ?, progress = ?
        WHERE id = ?
      `).run(step, progress, this.attemptId)
    }

    this.updateSession('running')
  }

  completeAttempt(success, error = null) {
    this.db.prepare(`
      UPDATE application_attempts
      SET
        status = ?,
        success = ?,
        completedAt = CURRENT_TIMESTAMP,
        error = ?,
        logs = ?,
        metadata = ?
      WHERE id = ?
    `).run(
      success ? 'completed' : 'failed',
      success ? 1 : 0,
      error,
      JSON.stringify(this.logs),
      JSON.stringify({
        platformAnalysis: this.platformAnalysis,
        strategy: this.strategy,
        decisions: this.decisions,
        tokensUsed: this.tokensUsed,
        apiCalls: this.apiCalls
      }),
      this.attemptId
    )
  }

  log(level, step, message, data = null) {
    const logEntry = {
      level,
      step,
      message,
      timestamp: new Date().toISOString(),
      data
    }

    this.logs.push(logEntry)

    // Also log to database
    if (this.attemptId) {
      this.db.prepare(`
        INSERT INTO application_logs (attemptId, level, step, message, data)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        this.attemptId,
        level,
        step,
        message,
        data ? JSON.stringify(data) : null
      )
    }

    // Console output
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[level] || '📝'

    console.log(`${emoji} [${step}] ${message}`)
  }

  /**
   * Get current status (for real-time monitoring)
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      attemptId: this.attemptId,
      currentStep: this.currentStep,
      progress: this.progress,
      totalSteps: this.totalSteps,
      progressPercent: Math.round((this.progress / this.totalSteps) * 100),
      logs: this.logs.slice(-10), // Last 10 logs
      decisions: this.decisions
    }
  }
}

module.exports = { AutoApplyAgent }
