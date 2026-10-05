const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
const Docxtemplater = require('docxtemplater')
const PizZip = require('pizzip')
const { logCoverLetterGeneration } = require('../db/database')

async function generateCoverLetter(job) {
  try {
    console.log(`\n📝 Generating cover letter for: ${job.title} at ${job.company}`)

    // Initialize Anthropic client
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Generate cover letter content using AI
    const coverLetterContent = await generateCoverLetterContent(job, client)

    // Check if template exists
    const templatePath = path.join(__dirname, '../../data/cover-letter-template.docx')
    let filePath, relativePath, filename

    if (fs.existsSync(templatePath)) {
      // Use template if available
      console.log('  ✅ Using cover letter template')
      const content = fs.readFileSync(templatePath, 'binary')
      const zip = new PizZip(content)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      })

      // Prepare template data
      const templateData = {
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        company: job.company || 'Company',
        role: job.title || 'Position',
        location: job.location || 'Location',
        hiringManager: 'Hiring Manager',
        opening: coverLetterContent.opening,
        body: coverLetterContent.body,
        closing: coverLetterContent.closing,
        signature: 'Your Name',
      }

      // Render the document
      doc.render(templateData)

      // Generate buffer
      const buf = doc.getZip().generate({ type: 'nodebuffer' })

      // Save to file
      const timestamp = Date.now()
      const safeCompany = (job.company || 'company').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const safeRole = (job.title || 'role').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      filename = `cover_letter_${safeCompany}_${safeRole}_${timestamp}.docx`
      const outputDir = path.join(__dirname, '../../public/resumes')
      filePath = path.join(outputDir, filename)
      relativePath = `/resumes/${filename}`

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      fs.writeFileSync(filePath, buf)
    } else {
      // Generate plain text if no template
      console.log('  ⚠️  No template found, generating plain text')
      const timestamp = Date.now()
      const safeCompany = (job.company || 'company').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const safeRole = (job.title || 'role').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      filename = `cover_letter_${safeCompany}_${safeRole}_${timestamp}.txt`
      const outputDir = path.join(__dirname, '../../public/resumes')
      filePath = path.join(outputDir, filename)
      relativePath = `/resumes/${filename}`

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const plainText = `${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${job.company || 'Company'}
${job.location || 'Location'}

Dear Hiring Manager,

${coverLetterContent.opening}

${coverLetterContent.body}

${coverLetterContent.closing}

Sincerely,
Your Name`

      fs.writeFileSync(filePath, plainText)
    }

    console.log(`  ✅ Cover letter generated: ${filename}\n`)

    // Log generation to database
    logCoverLetterGeneration(job.id, filePath)

    const port = process.env.PORT || 3000;
    return {
      success: true,
      url: `http://localhost:${port}${relativePath}`,
      filePath: relativePath,
      filename,
      hasTemplate: fs.existsSync(templatePath),
    }
  } catch (error) {
    console.error('❌ Error generating cover letter:', error)
    throw error
  }
}

async function generateCoverLetterContent(job, client) {
  const prompt = `You are writing a professional cover letter for a job application.

JOB DETAILS:
Company: ${job.company}
Role: ${job.title}
Location: ${job.location || 'Not specified'}
Fit Score: ${job.fitScore || 0}%

JOB DESCRIPTION:
${job.description || 'No description provided'}

KEY SKILLS REQUIRED:
${(job.keySkills || []).join(', ') || 'Not specified'}

ROLE SUMMARY:
${job.roleSummary || 'Not specified'}

TASK:
Write a professional, compelling cover letter that:
1. Opens with enthusiasm and mentions how you learned about the role
2. Highlights 2-3 key qualifications that make you an excellent fit
3. Demonstrates knowledge of the company and role
4. Shows genuine interest and cultural fit
5. Closes with a call to action

The tone should be professional yet personable. Focus on value you bring, not just what you want.

Provide your response in this JSON format:
{
  "opening": "<1-2 paragraphs expressing interest and mentioning how you found the role>",
  "body": "<2-3 paragraphs highlighting qualifications, relevant experience, and why you're excited about this specific opportunity>",
  "closing": "<1 paragraph thanking them and expressing eagerness to discuss further>"
}

Return ONLY the JSON, no other text.`

  console.log('  🤖 Generating AI cover letter content...')
  const startTime = Date.now()

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const elapsed = Date.now() - startTime
  console.log(`  ✅ AI content generated (${elapsed}ms)`)

  const responseText = message.content[0].text.trim()
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('Failed to parse cover letter content')
  }

  return JSON.parse(jsonMatch[0])
}

module.exports = { generateCoverLetter }
