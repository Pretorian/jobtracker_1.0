const Anthropic = require('@anthropic-ai/sdk')
const mammoth = require('mammoth')
const fs = require('fs')
const path = require('path')

// Validate API key
if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
  console.error('\n❌ ANTHROPIC_API_KEY is not set or invalid!')
  console.error('💡 Add your API key to .env file:')
  console.error('   ANTHROPIC_API_KEY=sk-ant-your-key-here\n')
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Extract text from master resume template
 * @returns {Promise<string|null>} - Resume text or null if not found
 */
async function getResumeContext() {
  const templatePath = path.join(__dirname, '../../data/master-resume-template.docx')

  if (!fs.existsSync(templatePath)) {
    console.log('  ℹ️  No master resume found, using default profile')
    return null
  }

  try {
    const buffer = fs.readFileSync(templatePath)
    const result = await mammoth.extractRawText({ buffer })
    const resumeText = result.value.trim()

    if (resumeText.length > 0) {
      console.log(`  ✅ Loaded resume content (${resumeText.length} characters)`)
      return resumeText
    }

    return null
  } catch (error) {
    console.error('  ⚠️  Failed to read resume:', error.message)
    return null
  }
}

/**
 * Parse job description using Claude API
 * @param {string} content - The job description text or URL
 * @param {boolean} isUrl - Whether the content is a URL
 * @returns {Promise<Object>} - Parsed job data
 */
async function parseWithClaude(content, isUrl = false) {
  // Validate API key before making request
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY is not configured. Please add your API key to .env file.')
  }

  console.log(`\n🤖 Calling Claude API to parse job ${isUrl ? 'URL' : 'description'}...`)

  // Get resume context
  const resumeText = await getResumeContext()

  const candidateProfile = resumeText
    ? `Based on the candidate's resume:\n\n${resumeText}`
    : `based on general role clarity and seniority (no resume is on file yet, so the score is not personalized)`

  const prompt = isUrl
    ? `You are a job description parser. The user has given you this job posting URL: ${content}

       Since you cannot fetch URLs directly, extract as much as you can from the URL itself (company name, job title) and provide reasonable defaults.

       Return ONLY a JSON object (no markdown, no backticks) with these exact fields:
       {
         "company": "Company name (extracted from URL if possible)",
         "title": "Job title (extracted from URL if possible)",
         "location": "Remote",
         "type": "Full-time",
         "salary": null,
         "keySkills": ["skill1", "skill2", "skill3"],
         "summary": "Unable to fetch full job description. Please paste the job description text for better analysis.",
         "fitScore": 50,
         "fitReason": "Limited information available from URL alone.",
         "needsMoreInfo": true
       }

       fitScore is 0-100 ${candidateProfile}.`
    : `You are a job description parser. Parse this job description and return ONLY a JSON object (no markdown, no backticks, no explanation):
       {
         "company": "Company name",
         "title": "Job title",
         "location": "City, State or Remote",
         "type": "Full-time / Contract / Part-time",
         "salary": "Salary range if mentioned, else null",
         "keySkills": ["skill1", "skill2", "skill3", "up to 8 skills"],
         "summary": "2-3 sentence summary of the role",
         "fitScore": 85,
         "fitReason": "One sentence on fit and alignment with the candidate's background",
         "needsMoreInfo": false
       }

       fitScore is 0-100 ${candidateProfile}.

       Job description:
       ${content}`

  try {
    const startTime = Date.now()

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    const elapsed = Date.now() - startTime
    console.log(`✅ Claude API response received (${elapsed}ms)`)

    const text = response.content.find(b => b.type === 'text')?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    console.log(`📊 Parsed job: ${parsed.title} at ${parsed.company} (Fit: ${parsed.fitScore}/100)`)

    return parsed
  } catch (error) {
    console.error('❌ Claude API error:', error.message)

    if (error.message?.includes('401') || error.message?.includes('authentication')) {
      console.error('🔑 Authentication failed - check your ANTHROPIC_API_KEY')
    }

    throw new Error(`Failed to parse with Claude: ${error.message}`)
  }
}

module.exports = { parseWithClaude }
