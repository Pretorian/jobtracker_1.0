const fs = require('fs')
const path = require('path')
const PizZip = require('pizzip')
const Docxtemplater = require('docxtemplater')
const { logResumeGeneration } = require('../db/database')
const Anthropic = require('@anthropic-ai/sdk')

/**
 * Generate a 100% match optimized resume for a specific job
 * Uses AI to strategically enhance resume content to maximize job fit
 * @param {Object} job - The job object from the database
 * @returns {Promise<Object>} - Object with url and filePath
 */
async function generateOptimizedResume(job) {
  console.log(`\n🎯 Generating 100% MATCH resume for: ${job.title} at ${job.company}`)

  try {
    // Path to master resume template
    const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      console.error('  ❌ Master resume template not found!')
      console.error(`  💡 Expected location: ${templatePath}`)
      throw new Error(
        'Master resume template not found. Please add your resume template at: data/master-resume-template.docx'
      )
    }

    console.log('  ✅ Template found')

    // Initialize Anthropic client
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Step 1: Perform gap analysis
    console.log('  🔍 Analyzing gaps for 100% match...')
    const gapAnalysis = await analyzeGaps(job, client)
    console.log(`     Found ${gapAnalysis.missingSkills?.length || 0} skills to emphasize`)

    // Step 2: Generate optimized resume content
    console.log('  ✨ Generating AI-optimized content...')
    const optimizedContent = await generateOptimizedContent(job, gapAnalysis, client)
    console.log('     Content optimization complete')

    // Step 3: Read and render template
    console.log('  📄 Rendering optimized resume...')
    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)

    // Guard against a placeholder-less template: docxtemplater would silently
    // produce a byte-for-byte copy of the master, dropping all AI content.
    const documentXml = zip.file('word/document.xml').asText()
    if (!/\{[^}]+\}/.test(documentXml.replace(/<[^>]+>/g, ''))) {
      throw new Error(
        'Master template contains no merge fields ({objective}, {summary}, {skills}, ' +
          '{keyAchievements}, {relevantExperience}, etc.). The generated resume would be ' +
          'identical to the master. Add the placeholder tags to data/master-resume-template.docx.'
      )
    }

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    // Prepare enhanced resume data
    const resumeData = {
      targetCompany: job.company,
      targetRole: job.title,
      targetLocation: job.location || 'Remote',
      skills: optimizedContent.skills,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      objective: optimizedContent.objective,
      summary: optimizedContent.summary,
      keyAchievements: optimizedContent.keyAchievements,
      relevantExperience: optimizedContent.relevantExperience,
    }

    console.log('  📋 Optimized template data prepared')

    // Render the document
    try {
      doc.render(resumeData)
    } catch (renderError) {
      // docxtemplater attaches per-tag detail on .properties.errors
      const detail = renderError.properties?.errors
        ?.map((e) => e.properties?.explanation || e.message)
        .join('; ')
      throw new Error(
        `Template render failed${detail ? `: ${detail}` : `: ${renderError.message}`}`
      )
    }

    // Generate the output
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    // Create output filename
    const timestamp = Date.now()
    const safeCompany = job.company.replace(/[^a-z0-9]/gi, '_')
    const safeRole = job.title.replace(/[^a-z0-9]/gi, '_')
    const filename = `resume_optimized_${safeCompany}_${safeRole}_${timestamp}.docx`

    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../../public/resumes')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save the file
    const outputPath = path.join(outputDir, filename)
    fs.writeFileSync(outputPath, buf)
    console.log(`  ✅ Optimized resume saved: ${filename}`)

    // Log in database
    const relativePath = `/resumes/${filename}`
    logResumeGeneration(job.id, outputPath, 'optimized')
    console.log(`  📊 Database updated\n`)

    const port = process.env.PORT || 3000;
    return {
      success: true,
      url: `http://localhost:${port}${relativePath}`,
      filePath: relativePath,
      filename,
      optimizationApplied: true,
      gapsClosed: gapAnalysis.missingSkills?.length || 0,
    }
  } catch (error) {
    console.error('  ❌ Optimized resume generation error:', error.stack || error.message)
    throw new Error(`Failed to generate optimized resume: ${error.message}`)
  }
}

/**
 * Analyze gaps for the job posting
 */
async function analyzeGaps(job, client) {
  const jobDescription = `
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Type: ${job.type || 'Not specified'}
Salary: ${job.salary || 'Not specified'}
Summary: ${job.summary || 'Not provided'}
Key Skills: ${job.keySkills?.join(', ') || 'Not specified'}
Current Fit Score: ${job.fitScore || 0}/100
  `.trim()

  const prompt = `You are a career advisor performing a gap analysis. Analyze this job posting and identify what's needed to achieve a 100% match.

Job Description:
${jobDescription}

Provide your analysis in this JSON format:
{
  "currentScore": ${job.fitScore || 0},
  "targetScore": 100,
  "missingSkills": ["skill1", "skill2", "skill3"],
  "experienceGaps": ["gap1", "gap2"],
  "certifications": ["cert1", "cert2"],
  "recommendations": ["action1", "action2", "action3"],
  "emphasisAreas": ["area1", "area2", "area3"]
}

Be specific and actionable. Return ONLY the JSON, no other text.`

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }]
  })

  const responseText = message.content[0].text.trim()
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('Failed to parse gap analysis response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Generate optimized resume content using AI
 */
async function generateOptimizedContent(job, gapAnalysis, client) {
  const prompt = `You are an expert resume writer creating a strategically optimized resume for a job application.

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Summary: ${job.summary || 'Not provided'}
Key Skills: ${job.keySkills?.join(', ') || 'Not specified'}

GAP ANALYSIS:
Missing Skills: ${gapAnalysis.missingSkills?.join(', ') || 'None'}
Experience Gaps: ${gapAnalysis.experienceGaps?.join(', ') || 'None'}
Areas to Emphasize: ${gapAnalysis.emphasisAreas?.join(', ') || 'All relevant experience'}

TASK:
Generate optimized resume content that maximizes match with this position. Be strategic but honest - reframe existing experience to highlight relevance, emphasize transferable skills, and use industry-specific terminology from the job posting.

Provide your content in this JSON format:
{
  "objective": "<2-3 sentence career objective specifically tailored to this role>",
  "summary": "<3-4 sentence professional summary emphasizing relevant experience and skills>",
  "skills": "<comma-separated list of skills, prioritizing those mentioned in job posting>",
  "keyAchievements": "<3-5 bullet points of achievements relevant to this role>",
  "relevantExperience": "<2-3 paragraphs highlighting most relevant experience for this position>"
}

GUIDELINES:
1. Use keywords and terminology from the job posting
2. Emphasize skills that match the requirements
3. Frame experience to show relevance to target role
4. Be confident but truthful - reframe, don't fabricate
5. Use action verbs and quantify achievements when possible
6. Focus on transferable skills for any gaps

Return ONLY the JSON, no other text.`

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  })

  const responseText = message.content[0].text.trim()
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('Failed to parse optimized content response')
  }

  return JSON.parse(jsonMatch[0])
}

module.exports = {
  generateOptimizedResume,
}
